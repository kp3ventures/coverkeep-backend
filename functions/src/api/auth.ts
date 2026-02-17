import { Router } from 'express';
import * as admin from 'firebase-admin';
import { validate, schemas } from '../middleware/validation';

const router = Router();

/**
 * POST /api/v1/auth/signup
 * Create new user account
 */
router.post('/signup', validate(schemas.signup), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name
    });
    
    // Create user document in Firestore
    const userDoc = {
      uid: userRecord.uid,
      email,
      name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isPremium: false,
      premiumExpiresAt: null
    };
    
    await admin.firestore()
      .collection('users')
      .doc(userRecord.uid)
      .set(userDoc);
    
    // Create custom token for immediate login
    const token = await admin.auth().createCustomToken(userRecord.uid);
    
    res.status(201).json({
      success: true,
      data: {
        uid: userRecord.uid,
        email,
        name,
        token
      }
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already in use'
        }
      });
    }
    
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email address'
        }
      });
    }
    
    if (error.code === 'auth/weak-password') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SIGNUP_FAILED',
        message: 'Failed to create account'
      }
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate user
 * Note: Client should use Firebase Auth SDK for login
 * This endpoint is for demonstration/testing
 */
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email } = req.body;
    
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Get user data from Firestore
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userRecord.uid)
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
    
    // Create custom token
    const token = await admin.auth().createCustomToken(userRecord.uid);
    
    res.json({
      success: true,
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userData?.name,
        isPremium: userData?.isPremium || false,
        token
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Failed to authenticate'
      }
    });
  }
});

export default router;
