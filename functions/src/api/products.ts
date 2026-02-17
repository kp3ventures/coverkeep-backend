import { Router } from 'express';
import * as admin from 'firebase-admin';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';

const router = Router();

/**
 * POST /api/v1/products
 * Create new product
 */
router.post('/', 
  authenticateUser, 
  validate(schemas.createProduct), 
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.uid;
      const productData = {
        ...req.body,
        userId,
        productId: '', // Will be set to document ID
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Convert date strings to Firestore timestamps
      if (productData.purchaseDate) {
        productData.purchaseDate = admin.firestore.Timestamp.fromDate(
          new Date(productData.purchaseDate)
        );
      }
      if (productData.warrantyExpirationDate) {
        productData.warrantyExpirationDate = admin.firestore.Timestamp.fromDate(
          new Date(productData.warrantyExpirationDate)
        );
      }
      
      // Create product document
      const productRef = await admin.firestore()
        .collection('products')
        .add(productData);
      
      // Update document with its own ID
      await productRef.update({ productId: productRef.id });
      
      // Get the created document
      const productDoc = await productRef.get();
      
      res.status(201).json({
        success: true,
        data: {
          productId: productRef.id,
          ...productDoc.data()
        }
      });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create product'
        }
      });
    }
  }
);

/**
 * GET /api/v1/products/:id
 * Get product by ID
 */
router.get('/:id', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    
    const productDoc = await admin.firestore()
      .collection('products')
      .doc(id)
      .get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
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
    
    res.json({
      success: true,
      data: productData
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch product'
      }
    });
  }
});

/**
 * GET /api/v1/products/user/:userId
 * List all products for a user
 */
router.get('/user/:userId', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user!.uid;
    
    // Users can only list their own products
    if (userId !== requestingUserId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
    
    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const order = (req.query.order as string) || 'desc';
    
    // Build query
    let query = admin.firestore()
      .collection('products')
      .where('userId', '==', userId)
      .orderBy(sortBy, order as 'asc' | 'desc')
      .limit(limit + 1); // Fetch one extra to check if there are more
    
    const snapshot = await query.get();
    const products = snapshot.docs.slice(0, limit).map(doc => doc.data());
    const hasMore = snapshot.docs.length > limit;
    
    res.json({
      success: true,
      data: {
        products,
        total: products.length,
        hasMore
      }
    });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch products'
      }
    });
  }
});

/**
 * PUT /api/v1/products/:id
 * Update product
 */
router.put('/:id', 
  authenticateUser, 
  validate(schemas.updateProduct), 
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.uid;
      
      const productRef = admin.firestore().collection('products').doc(id);
      const productDoc = await productRef.get();
      
      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
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
      
      const updateData = { ...req.body };
      
      // Convert date strings to Firestore timestamps
      if (updateData.purchaseDate) {
        updateData.purchaseDate = admin.firestore.Timestamp.fromDate(
          new Date(updateData.purchaseDate)
        );
      }
      if (updateData.warrantyExpirationDate) {
        updateData.warrantyExpirationDate = admin.firestore.Timestamp.fromDate(
          new Date(updateData.warrantyExpirationDate)
        );
      }
      
      await productRef.update(updateData);
      
      // Get updated document
      const updatedDoc = await productRef.get();
      
      res.json({
        success: true,
        data: updatedDoc.data()
      });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update product'
        }
      });
    }
  }
);

/**
 * DELETE /api/v1/products/:id
 * Delete product
 */
router.delete('/:id', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    
    const productRef = admin.firestore().collection('products').doc(id);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
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
    
    await productRef.delete();
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete product'
      }
    });
  }
});

export default router;
