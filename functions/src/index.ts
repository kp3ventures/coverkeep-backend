import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
admin.initializeApp();

// Create Express app
const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({ origin: true })); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(morgan('combined')); // Logging

// Import routes
import authRoutes from './api/auth';
import productRoutes from './api/products';
import aiRoutes from './api/ai';
import reminderRoutes from './api/reminders';
import claimRoutes from './api/claims';
import dashboardRoutes from './api/dashboard';

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/reminders', reminderRoutes);
app.use('/api/v1/claims', claimRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Internal server error'
    }
  });
});

// Export the Express app as a Cloud Function
export const api = functions.https.onRequest(app);

// Scheduled function for sending reminders (runs daily at 9am)
export const sendReminders = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    console.log('Running scheduled reminder job');
    
    const db = admin.firestore();
    const now = new Date();
    
    // Get reminders scheduled for today that haven't been sent
    const remindersSnapshot = await db.collection('reminders')
      .where('scheduledDate', '<=', now)
      .where('sentDate', '==', null)
      .limit(100)
      .get();
    
    console.log(`Found ${remindersSnapshot.size} reminders to send`);
    
    const batch = db.batch();
    
    remindersSnapshot.forEach((doc) => {
      // Update sentDate
      batch.update(doc.ref, {
        sentDate: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // TODO: Send actual notification (email, push, etc.)
      console.log(`Sending reminder ${doc.id}`);
    });
    
    await batch.commit();
    console.log('Reminder job completed');
  });

// Scheduled function for cleanup of old reminders (runs weekly)
export const cleanupReminders = functions.pubsub
  .schedule('0 2 * * 0')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    console.log('Running reminder cleanup job');
    
    const db = admin.firestore();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Delete acknowledged reminders older than 6 months
    const oldRemindersSnapshot = await db.collection('reminders')
      .where('acknowledged', '==', true)
      .where('sentDate', '<=', sixMonthsAgo)
      .limit(500)
      .get();
    
    console.log(`Deleting ${oldRemindersSnapshot.size} old reminders`);
    
    const batch = db.batch();
    oldRemindersSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('Cleanup job completed');
  });
