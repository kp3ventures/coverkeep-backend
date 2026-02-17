import { Router } from 'express';
import { authenticateUser, requirePremium, AuthRequest } from '../middleware/auth';
import { validate, schemas } from '../middleware/validation';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * POST /api/v1/ai/identify
 * Identify product from image using OpenAI Vision
 */
router.post('/identify',
  authenticateUser,
  requirePremium, // Premium feature
  validate(schemas.aiIdentify),
  async (req: AuthRequest, res) => {
    try {
      const { imageUrl, imageBase64 } = req.body;
      
      // Prepare image for OpenAI
      const imageContent = imageUrl || imageBase64;
      
      // Call OpenAI Vision API
      const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this product image and provide the following information in JSON format:
{
  "productName": "Full product name with model number if visible",
  "manufacturer": "Brand/manufacturer name",
  "category": "Product category (e.g., Electronics - Television)",
  "confidence": "high/medium/low",
  "suggestions": {
    "warrantyType": "Typical warranty type (limited/extended/full)",
    "typicalWarranty": "Typical warranty duration for this product"
  }
}

Be as specific as possible. If you can see the model number, brand, or any identifying text, include it in the productName.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageContent
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });
      
      // Parse the response
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'AI_NO_RESPONSE',
            message: 'AI service did not return a response'
          }
        });
      }
      
      try {
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const productInfo = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        
        if (!productInfo) {
          return res.status(500).json({
            success: false,
            error: {
              code: 'AI_PARSE_ERROR',
              message: 'Failed to parse AI response'
            }
          });
        }
        
        res.json({
          success: true,
          data: productInfo
        });
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        
        // Return raw response if JSON parsing fails
        res.json({
          success: true,
          data: {
            productName: 'Unknown Product',
            manufacturer: 'Unknown',
            category: 'Unknown',
            confidence: 'low',
            rawResponse: content,
            suggestions: {
              warrantyType: 'limited',
              typicalWarranty: '1 year manufacturer'
            }
          }
        });
      }
    } catch (error: any) {
      console.error('AI identify error:', error);
      
      if (error.code === 'insufficient_quota') {
        return res.status(503).json({
          success: false,
          error: {
            code: 'AI_QUOTA_EXCEEDED',
            message: 'AI service quota exceeded'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'AI_SERVICE_ERROR',
          message: 'Failed to identify product'
        }
      });
    }
  }
);

export default router;
