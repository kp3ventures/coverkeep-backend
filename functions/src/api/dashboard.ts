import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticateUser, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/dashboard/summary
 * Get user dashboard summary with key metrics
 */
router.get('/summary', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.uid;
    const db = admin.firestore();
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    const ninetyDaysFromNow = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    
    // Fetch all user's products
    const productsSnapshot = await db.collection('products')
      .where('userId', '==', userId)
      .get();
    
    const totalProducts = productsSnapshot.size;
    
    // Count active warranties (not expired)
    let activeWarranties = 0;
    let expiringWithin30Days = 0;
    let expiringWithin90Days = 0;
    const upcomingExpirations: any[] = [];
    
    productsSnapshot.forEach(doc => {
      const product = doc.data();
      
      if (product.warrantyExpirationDate) {
        const expirationDate = product.warrantyExpirationDate.toDate();
        
        if (expirationDate > now) {
          activeWarranties++;
          
          // Check if expiring within 30 days
          if (expirationDate <= thirtyDaysFromNow) {
            expiringWithin30Days++;
            
            const daysUntilExpiration = Math.ceil(
              (expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
            );
            
            upcomingExpirations.push({
              productId: product.productId,
              name: product.name,
              warrantyExpirationDate: expirationDate.toISOString(),
              daysUntilExpiration
            });
          } else if (expirationDate <= ninetyDaysFromNow) {
            expiringWithin90Days++;
          }
        }
      }
    });
    
    // Sort upcoming expirations by date
    upcomingExpirations.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
    
    // Fetch pending reminders
    const pendingRemindersSnapshot = await db.collection('reminders')
      .where('userId', '==', userId)
      .where('acknowledged', '==', false)
      .where('sentDate', '!=', null)
      .get();
    
    const pendingReminders = pendingRemindersSnapshot.size;
    
    // Fetch active and draft claims
    const claimsSnapshot = await db.collection('claims')
      .where('userId', '==', userId)
      .where('claimStatus', 'in', ['draft', 'submitted', 'approved'])
      .get();
    
    let activeClaims = 0;
    let claimsDrafts = 0;
    
    claimsSnapshot.forEach(doc => {
      const claim = doc.data();
      if (claim.claimStatus === 'draft') {
        claimsDrafts++;
      } else {
        activeClaims++;
      }
    });
    
    // Get recent products (last 5)
    const recentProductsSnapshot = await db.collection('products')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    const recentProducts = recentProductsSnapshot.docs.map(doc => {
      const product = doc.data();
      return {
        productId: product.productId,
        name: product.name,
        purchaseDate: product.purchaseDate?.toDate().toISOString(),
        warrantyExpirationDate: product.warrantyExpirationDate?.toDate().toISOString()
      };
    });
    
    // Compile summary
    const summary = {
      totalProducts,
      activeWarranties,
      expiringWithin30Days,
      expiringWithin90Days,
      pendingReminders,
      activeClaims,
      claimsDrafts,
      recentProducts,
      upcomingExpirations: upcomingExpirations.slice(0, 5) // Top 5 upcoming expirations
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch dashboard summary'
      }
    });
  }
});

/**
 * GET /api/v1/dashboard/stats
 * Get detailed statistics
 */
router.get('/stats', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.uid;
    const db = admin.firestore();
    
    // Fetch all user data
    const [productsSnapshot, claimsSnapshot, remindersSnapshot] = await Promise.all([
      db.collection('products').where('userId', '==', userId).get(),
      db.collection('claims').where('userId', '==', userId).get(),
      db.collection('reminders').where('userId', '==', userId).get()
    ]);
    
    // Product statistics
    const productStats = {
      total: productsSnapshot.size,
      byWarrantyType: {} as { [key: string]: number },
      byManufacturer: {} as { [key: string]: number },
      averageWarrantyDuration: 0
    };
    
    let totalWarrantyDays = 0;
    let warrantyCount = 0;
    
    productsSnapshot.forEach(doc => {
      const product = doc.data();
      
      // Count by warranty type
      const type = product.warrantyType || 'unknown';
      productStats.byWarrantyType[type] = (productStats.byWarrantyType[type] || 0) + 1;
      
      // Count by manufacturer
      const manufacturer = product.manufacturer || 'unknown';
      productStats.byManufacturer[manufacturer] = (productStats.byManufacturer[manufacturer] || 0) + 1;
      
      // Calculate average warranty duration
      if (product.purchaseDate && product.warrantyExpirationDate) {
        const purchaseDate = product.purchaseDate.toDate();
        const expirationDate = product.warrantyExpirationDate.toDate();
        const days = Math.ceil((expirationDate.getTime() - purchaseDate.getTime()) / (24 * 60 * 60 * 1000));
        totalWarrantyDays += days;
        warrantyCount++;
      }
    });
    
    if (warrantyCount > 0) {
      productStats.averageWarrantyDuration = Math.round(totalWarrantyDays / warrantyCount);
    }
    
    // Claim statistics
    const claimStats = {
      total: claimsSnapshot.size,
      byStatus: {} as { [key: string]: number },
      totalValue: 0,
      approvedValue: 0
    };
    
    claimsSnapshot.forEach(doc => {
      const claim = doc.data();
      
      // Count by status
      const status = claim.claimStatus;
      claimStats.byStatus[status] = (claimStats.byStatus[status] || 0) + 1;
      
      // Sum values
      if (claim.estimatedValue) {
        claimStats.totalValue += claim.estimatedValue;
        
        if (claim.claimStatus === 'approved' || claim.claimStatus === 'paid') {
          claimStats.approvedValue += claim.estimatedValue;
        }
      }
    });
    
    // Reminder statistics
    const reminderStats = {
      total: remindersSnapshot.size,
      sent: 0,
      pending: 0,
      acknowledged: 0
    };
    
    remindersSnapshot.forEach(doc => {
      const reminder = doc.data();
      
      if (reminder.sentDate) {
        reminderStats.sent++;
      } else {
        reminderStats.pending++;
      }
      
      if (reminder.acknowledged) {
        reminderStats.acknowledged++;
      }
    });
    
    res.json({
      success: true,
      data: {
        products: productStats,
        claims: claimStats,
        reminders: reminderStats
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch statistics'
      }
    });
  }
});

export default router;
