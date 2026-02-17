import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Middleware factory for request validation
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors
        }
      });
    }
    
    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  signup: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(2).max(100).required()
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  
  createProduct: Joi.object({
    barcode: Joi.string().optional().allow(''),
    name: Joi.string().required(),
    manufacturer: Joi.string().optional().allow(''),
    purchaseDate: Joi.date().iso().required(),
    warrantyExpirationDate: Joi.date().iso().optional(),
    warrantyInfo: Joi.string().optional().allow(''),
    warrantyType: Joi.string().valid('limited', 'extended', 'full', 'lifetime').optional(),
    imageUrl: Joi.string().uri().optional().allow(''),
    receiptUrl: Joi.string().uri().optional().allow('')
  }),
  
  updateProduct: Joi.object({
    barcode: Joi.string().optional().allow(''),
    name: Joi.string().optional(),
    manufacturer: Joi.string().optional().allow(''),
    purchaseDate: Joi.date().iso().optional(),
    warrantyExpirationDate: Joi.date().iso().optional(),
    warrantyInfo: Joi.string().optional().allow(''),
    warrantyType: Joi.string().valid('limited', 'extended', 'full', 'lifetime').optional(),
    imageUrl: Joi.string().uri().optional().allow(''),
    receiptUrl: Joi.string().uri().optional().allow('')
  }).min(1),
  
  aiIdentify: Joi.object({
    imageUrl: Joi.string().uri().optional(),
    imageBase64: Joi.string().optional()
  }).xor('imageUrl', 'imageBase64'),
  
  scheduleReminders: Joi.object({
    productId: Joi.string().required(),
    reminderTypes: Joi.array()
      .items(Joi.string().valid('6mo', '3mo', '1mo', '1week'))
      .min(1)
      .required()
  }),
  
  createClaim: Joi.object({
    productId: Joi.string().required(),
    warrantyId: Joi.string().optional().allow(''),
    issueDescription: Joi.string().required(),
    estimatedValue: Joi.number().positive().optional(),
    attachments: Joi.array().items(Joi.string().uri()).optional()
  }),
  
  updateClaim: Joi.object({
    claimStatus: Joi.string().valid('draft', 'submitted', 'approved', 'paid', 'denied').optional(),
    notes: Joi.string().optional().allow(''),
    estimatedValue: Joi.number().positive().optional(),
    attachments: Joi.array().items(Joi.string().uri()).optional()
  }).min(1)
};
