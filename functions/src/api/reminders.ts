import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';

const router = Router();

/**
 * POST /api/v1/reminders/schedule
 * Schedule warranty expiration reminders
 */
router.post('/schedule',
  authenticateUser,
  validate(schemas.scheduleReminders),
  async (req: AuthRequest, res) => {
    try {
      const { productId, reminderTypes } = req.body;
      const userId = req.user!.uid;
      
      // Get product to verify ownership and get warranty expiration date
      const productDoc = await admin.firestore()
        .collection('products')
        .doc(productId)
        .get();
      
      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found'
          }
        });
      }
      
      const productData = productDoc.data();
      
      // Check ownership
      if (productData?.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        });
      }
      
      // Check if product has warranty expiration date
      if (!productData?.warrantyExpirationDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_WARRANTY_DATE',
            message: 'Product does not have a warranty expiration date'
          }
        });
      }
      
      const expirationDate = productData.warrantyExpirationDate.toDate();
      const createdAt = admin.firestore.FieldValue.serverTimestamp();
      
      // Calculate reminder dates based on type
      const reminderDurations: { [key: string]: number } = {
        '6mo': 6 * 30 * 24 * 60 * 60 * 1000, // 6 months in ms
        '3mo': 3 * 30 * 24 * 60 * 60 * 1000, // 3 months in ms
        '1mo': 30 * 24 * 60 * 60 * 1000,      // 1 month in ms
        '1week': 7 * 24 * 60 * 60 * 1000      // 1 week in ms
      };
      
      const reminders = [];
      const batch = admin.firestore().batch();
      
      for (const type of reminderTypes) {
        const duration = reminderDurations[type];
        const scheduledDate = new Date(expirationDate.getTime() - duration);
        
        // Only schedule if the reminder date is in the future
        if (scheduledDate > new Date()) {
          const reminderRef = admin.firestore().collection('reminders').doc();
          const reminderData = {
            reminderId: reminderRef.id,
            productId,
            userId,
            reminderType: type,
            scheduledDate: admin.firestore.Timestamp.fromDate(scheduledDate),
            sentDate: null,
            acknowledged: false,
            createdAt
          };
          
          batch.set(reminderRef, reminderData);
          
          reminders.push({
            reminderId: reminderRef.id,
            reminderType: type,
            scheduledDate: scheduledDate.toISOString()
          });
        }
      }
      
      await batch.commit();
      
      res.status(201).json({
        success: true,
        data: {
          reminders
        }
      });
    } catch (error) {
      console.error('Schedule reminders error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SCHEDULE_FAILED',
          message: 'Failed to schedule reminders'
        }
      });
    }
  }
);

/**
 * GET /api/v1/reminders/user/:userId
 * Get all reminders for a user
 */
router.get('/user/:userId', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user!.uid;
    
    // Users can only list their own reminders
    if (userId !== requestingUserId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
    
    // Build query
    let query = admin.firestore()
      .collection('reminders')
      .where('userId', '==', userId)
      .orderBy('scheduledDate', 'asc');
    
    // Filter by acknowledgment status if provided
    const acknowledged = req.query.acknowledged;
    if (acknowledged === 'true' || acknowledged === 'false') {
      query = query.where('acknowledged', '==', acknowledged === 'true');
    }
    
    const snapshot = await query.get();
    const reminders = snapshot.docs.map(doc => doc.data());
    
    res.json({
      success: true,
      data: {
        reminders
      }
    });
  } catch (error) {
    console.error('List reminders error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch reminders'
      }
    });
  }
});

/**
 * PATCH /api/v1/reminders/:id/acknowledge
 * Acknowledge a reminder
 */
router.patch('/:id/acknowledge', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    
    const reminderRef = admin.firestore().collection('reminders').doc(id);
    const reminderDoc = await reminderRef.get();
    
    if (!reminderDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Reminder not found'
        }
      });
    }
    
    const reminderData = reminderDoc.data();
    
    // Check ownership
    if (reminderData?.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
    
    await reminderRef.update({
      acknowledged: true
    });
    
    res.json({
      success: true,
      message: 'Reminder acknowledged'
    });
  } catch (error) {
    console.error('Acknowledge reminder error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to acknowledge reminder'
      }
    });
  }
});

export default router;
