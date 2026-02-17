import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    isPremium?: boolean;
    premiumExpiresAt?: Date;
  };
}

/**
 * Middleware to verify Firebase Auth JWT token
 */
export const authenticateUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authorization header required'
        }
      });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get user data from Firestore
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    const userData = userDoc.data();
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isPremium: userData?.isPremium || false,
      premiumExpiresAt: userData?.premiumExpiresAt?.toDate()
    };
    
    next();
  } catch (error: any) {
    console.error('Authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_EXPIRED',
          message: 'Token expired'
        }
      });
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_INVALID',
        message: 'Invalid authentication token'
      }
    });
  }
};

/**
 * Middleware to require premium subscription
 */
export const requirePremium = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      }
    });
  }
  
  const now = new Date();
  const isPremiumActive = req.user.isPremium && 
    (!req.user.premiumExpiresAt || req.user.premiumExpiresAt > now);
  
  if (!isPremiumActive) {
    return res.status(402).json({
      success: false,
      error: {
        code: 'PREMIUM_REQUIRED',
        message: 'Premium subscription required'
      }
    });
  }
  
  next();
};
