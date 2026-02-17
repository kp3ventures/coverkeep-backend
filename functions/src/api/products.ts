import { Router } from 'express';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';
import { identifyProduct } from '../services/productIdentification';

const router = Router();

// Cache expiry: 30 days
const BARCODE_CACHE_TTL_DAYS = 30;

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

/**
 * Barcode Lookup Service
 * Tries multiple free APIs with fallback support
 */
interface BarcodeProduct {
  name: string;
  brand?: string;
  category?: string;
  model?: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

async function lookupUPCItemDB(barcode: string): Promise<BarcodeProduct | null> {
  try {
    const response = await axios.get(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
      { timeout: 5000 }
    );
    
    if (response.data?.items && response.data.items.length > 0) {
      const item = response.data.items[0];
      return {
        name: item.title || '',
        brand: item.brand || undefined,
        category: item.category || undefined,
        model: item.model || undefined,
        confidence: 'high',
        source: 'UPCitemdb'
      };
    }
    return null;
  } catch (error: any) {
    console.warn('UPCitemdb lookup failed:', error.message);
    return null;
  }
}

async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeProduct | null> {
  try {
    const response = await axios.get(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { timeout: 5000 }
    );
    
    if (response.data?.status === 1 && response.data.product) {
      const product = response.data.product;
      return {
        name: product.product_name || product.generic_name || '',
        brand: product.brands || undefined,
        category: product.categories || undefined,
        model: undefined,
        confidence: 'medium',
        source: 'Open Food Facts'
      };
    }
    return null;
  } catch (error: any) {
    console.warn('Open Food Facts lookup failed:', error.message);
    return null;
  }
}

async function lookupEANSearch(barcode: string): Promise<BarcodeProduct | null> {
  try {
    const response = await axios.get(
      `https://ean-search.org/api/ean/${barcode}`,
      { timeout: 5000 }
    );
    
    if (response.data && response.data.name) {
      return {
        name: response.data.name || '',
        brand: response.data.brand || undefined,
        category: response.data.category || undefined,
        model: undefined,
        confidence: 'medium',
        source: 'EAN-Search'
      };
    }
    return null;
  } catch (error: any) {
    console.warn('EAN-Search lookup failed:', error.message);
    return null;
  }
}

async function lookupBarcodeWithFallback(barcode: string): Promise<BarcodeProduct | null> {
  // Try UPCitemdb first (best quality, but rate limited)
  let result = await lookupUPCItemDB(barcode);
  if (result) return result;
  
  // Fallback to Open Food Facts (unlimited, but food-focused)
  result = await lookupOpenFoodFacts(barcode);
  if (result) return result;
  
  // Final fallback to EAN-Search
  result = await lookupEANSearch(barcode);
  if (result) return result;
  
  return null;
}

/**
 * POST /api/v1/products/lookup-barcode
 * Look up product information by barcode
 */
router.post('/lookup-barcode', async (req, res) => {
  try {
    const { barcode } = req.body;
    
    // Validate barcode
    if (!barcode || typeof barcode !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BARCODE',
          message: 'Barcode is required and must be a string'
        }
      });
    }
    
    // Sanitize barcode (remove spaces, dashes)
    const cleanBarcode = barcode.replace(/[\s-]/g, '');
    
    if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BARCODE_LENGTH',
          message: 'Barcode must be between 8 and 14 digits'
        }
      });
    }
    
    const db = admin.firestore();
    const cacheRef = db.collection('barcode_cache').doc(cleanBarcode);
    
    // Check cache first
    const cachedDoc = await cacheRef.get();
    if (cachedDoc.exists) {
      const cachedData = cachedDoc.data();
      const cacheAge = Date.now() - cachedData!.cachedAt.toMillis();
      const cacheTTL = BARCODE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
      
      if (cacheAge < cacheTTL) {
        console.log(`Cache hit for barcode ${cleanBarcode}`);
        return res.json({
          success: true,
          data: {
            name: cachedData!.name,
            brand: cachedData!.brand,
            category: cachedData!.category,
            model: cachedData!.model,
            confidence: cachedData!.confidence,
            cached: true
          }
        });
      }
    }
    
    // Cache miss or expired - lookup from APIs
    console.log(`Cache miss for barcode ${cleanBarcode}, querying APIs...`);
    const productInfo = await lookupBarcodeWithFallback(cleanBarcode);
    
    if (!productInfo) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BARCODE_NOT_FOUND',
          message: 'Product information not found for this barcode. Please enter details manually.'
        }
      });
    }
    
    // Cache the result
    await cacheRef.set({
      barcode: cleanBarcode,
      name: productInfo.name,
      brand: productInfo.brand || null,
      category: productInfo.category || null,
      model: productInfo.model || null,
      confidence: productInfo.confidence,
      source: productInfo.source,
      cachedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return res.json({
      success: true,
      data: {
        name: productInfo.name,
        brand: productInfo.brand,
        category: productInfo.category,
        model: productInfo.model,
        confidence: productInfo.confidence,
        cached: false
      }
    });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'LOOKUP_FAILED',
        message: 'Failed to lookup barcode. Please try again or enter details manually.'
      }
    });
  }
});

/**
 * POST /api/v1/products/identify
 * Identify product from image using GPT-4 Vision
 */
router.post('/identify', async (req, res) => {
  try {
    const { image, userId } = req.body;
    
    // Validate required fields
    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IMAGE',
          message: 'Image is required and must be a base64 string or URL'
        }
      });
    }
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'userId is required for logging and analytics'
        }
      });
    }
    
    // Call product identification service
    const result = await identifyProduct(image, userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        product: null,
        error: result.error
      });
    }
    
    // Return successful identification
    return res.json({
      success: true,
      product: {
        name: result.result!.name,
        brand: result.result!.brand || null,
        category: result.result!.category || null,
        model: result.result!.model || null,
        color: result.result!.color || null,
        estimatedYear: result.result!.estimatedYear || null,
        confidence: result.result!.confidence,
        suggestedWarranty: result.result!.suggestedWarranty || null
      },
      error: null
    });
  } catch (error) {
    console.error('Product identification endpoint error:', error);
    return res.status(500).json({
      success: false,
      product: null,
      error: {
        code: 'SERVER_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
});

export default router;
