import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';

const router = Router();

/**
 * POST /api/v1/claims/draft
 * Create warranty claim draft
 */
router.post('/draft',
  authenticateUser,
  validate(schemas.createClaim),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.uid;
      const { productId, warrantyId, issueDescription, estimatedValue, attachments } = req.body;
      
      // Verify product ownership
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
      
      if (productData?.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        });
      }
      
      // Verify warranty if provided
      if (warrantyId) {
        const warrantyDoc = await admin.firestore()
          .collection('warranties')
          .doc(warrantyId)
          .get();
        
        if (!warrantyDoc.exists) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'WARRANTY_NOT_FOUND',
              message: 'Warranty not found'
            }
          });
        }
        
        const warrantyData = warrantyDoc.data();
        
        if (warrantyData?.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Access denied to warranty'
            }
          });
        }
      }
      
      // Create claim
      const claimRef = admin.firestore().collection('claims').doc();
      const claimData = {
        claimId: claimRef.id,
        productId,
        userId,
        warrantyId: warrantyId || null,
        claimDate: admin.firestore.FieldValue.serverTimestamp(),
        claimStatus: 'draft',
        issueDescription,
        notes: '',
        estimatedValue: estimatedValue || null,
        attachments: attachments || [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await claimRef.set(claimData);
      
      // Get the created document
      const createdDoc = await claimRef.get();
      
      res.status(201).json({
        success: true,
        data: createdDoc.data()
      });
    } catch (error) {
      console.error('Create claim error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create claim'
        }
      });
    }
  }
);

/**
 * GET /api/v1/claims/:id
 * Get claim details
 */
router.get('/:id', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    
    const claimDoc = await admin.firestore()
      .collection('claims')
      .doc(id)
      .get();
    
    if (!claimDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Claim not found'
        }
      });
    }
    
    const claimData = claimDoc.data();
    
    // Check ownership
    if (claimData?.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
    
    res.json({
      success: true,
      data: claimData
    });
  } catch (error) {
    console.error('Get claim error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch claim'
      }
    });
  }
});

/**
 * GET /api/v1/claims/user/:userId
 * List all claims for a user
 */
router.get('/user/:userId', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user!.uid;
    
    // Users can only list their own claims
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
      .collection('claims')
      .where('userId', '==', userId)
      .orderBy('claimDate', 'desc');
    
    // Filter by status if provided
    const status = req.query.status as string;
    if (status) {
      query = query.where('claimStatus', '==', status);
    }
    
    const snapshot = await query.get();
    const claims = snapshot.docs.map(doc => doc.data());
    
    res.json({
      success: true,
      data: {
        claims
      }
    });
  } catch (error) {
    console.error('List claims error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch claims'
      }
    });
  }
});

/**
 * PUT /api/v1/claims/:id
 * Update claim
 */
router.put('/:id',
  authenticateUser,
  validate(schemas.updateClaim),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.uid;
      
      const claimRef = admin.firestore().collection('claims').doc(id);
      const claimDoc = await claimRef.get();
      
      if (!claimDoc.exists) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Claim not found'
          }
        });
      }
      
      const claimData = claimDoc.data();
      
      // Check ownership
      if (claimData?.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        });
      }
      
      // Prevent editing of paid or denied claims
      if (claimData?.claimStatus === 'paid' || claimData?.claimStatus === 'denied') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CLAIM_CLOSED',
            message: 'Cannot edit closed claims'
          }
        });
      }
      
      const updateData = {
        ...req.body,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await claimRef.update(updateData);
      
      // Get updated document
      const updatedDoc = await claimRef.get();
      
      res.json({
        success: true,
        data: updatedDoc.data()
      });
    } catch (error) {
      console.error('Update claim error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update claim'
        }
      });
    }
  }
);

/**
 * DELETE /api/v1/claims/:id
 * Delete claim (draft only)
 */
router.delete('/:id', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    
    const claimRef = admin.firestore().collection('claims').doc(id);
    const claimDoc = await claimRef.get();
    
    if (!claimDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Claim not found'
        }
      });
    }
    
    const claimData = claimDoc.data();
    
    // Check ownership
    if (claimData?.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
    
    // Only allow deletion of draft claims
    if (claimData?.claimStatus !== 'draft') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_DELETE',
          message: 'Only draft claims can be deleted'
        }
      });
    }
    
    await claimRef.delete();
    
    res.json({
      success: true,
      message: 'Claim deleted successfully'
    });
  } catch (error) {
    console.error('Delete claim error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete claim'
      }
    });
  }
});

export default router;
