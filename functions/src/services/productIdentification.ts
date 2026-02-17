import OpenAI from 'openai';
import * as admin from 'firebase-admin';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ProductIdentificationResult {
  name: string;
  brand?: string;
  category?: string;
  model?: string;
  color?: string;
  estimatedYear?: number;
  confidence: number;
  suggestedWarranty?: string;
}

export interface ProductIdentificationError {
  code: string;
  message: string;
}

/**
 * Warranty suggestion logic based on product category and brand
 */
function suggestWarranty(brand?: string, category?: string): string {
  const brandLower = brand?.toLowerCase() || '';
  const categoryLower = category?.toLowerCase() || '';
  
  // Apple products
  if (brandLower.includes('apple')) {
    return '1 year (Apple standard warranty)';
  }
  
  // Samsung products
  if (brandLower.includes('samsung')) {
    return '1 year (Samsung standard warranty)';
  }
  
  // Electronics
  if (categoryLower.includes('electronic') || 
      categoryLower.includes('computer') || 
      categoryLower.includes('phone') || 
      categoryLower.includes('tablet') || 
      categoryLower.includes('laptop')) {
    return '1-2 years (manufacturer standard)';
  }
  
  // Appliances
  if (categoryLower.includes('appliance') || 
      categoryLower.includes('refrigerator') || 
      categoryLower.includes('washer') || 
      categoryLower.includes('dryer') || 
      categoryLower.includes('dishwasher') || 
      categoryLower.includes('oven')) {
    return '2-5 years (varies by type)';
  }
  
  // Furniture
  if (categoryLower.includes('furniture')) {
    return '1-3 years (varies by manufacturer)';
  }
  
  // Clothing/Apparel
  if (categoryLower.includes('clothing') || 
      categoryLower.includes('apparel') || 
      categoryLower.includes('shoes')) {
    return '30-90 days (return policy varies)';
  }
  
  // Default
  return 'Check manufacturer website';
}

/**
 * Validate that the image is a valid base64 string or URL
 */
function validateImage(image: string): { isValid: boolean; error?: ProductIdentificationError } {
  // Check if it's a URL
  if (image.startsWith('http://') || image.startsWith('https://')) {
    try {
      new URL(image);
      return { isValid: true };
    } catch {
      return {
        isValid: false,
        error: {
          code: 'INVALID_IMAGE_URL',
          message: 'Invalid image URL provided'
        }
      };
    }
  }
  
  // Check if it's a base64 string (with or without data URL prefix)
  const base64Pattern = /^(?:data:image\/[a-z]+;base64,)?[A-Za-z0-9+/]+={0,2}$/;
  if (!base64Pattern.test(image.replace(/\s/g, ''))) {
    return {
      isValid: false,
      error: {
        code: 'INVALID_IMAGE_FORMAT',
        message: 'Image must be a valid base64 string or URL'
      }
    };
  }
  
  // Check minimum length (too small = probably not a real image)
  const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;
  if (base64Data.length < 100) {
    return {
      isValid: false,
      error: {
        code: 'IMAGE_TOO_SMALL',
        message: 'Image too small, try closer photo'
      }
    };
  }
  
  return { isValid: true };
}

/**
 * Convert base64 string to data URL if needed
 */
function prepareImageForGPT(image: string): string {
  // If it's already a URL, return as-is
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  
  // If it's already a data URL, return as-is
  if (image.startsWith('data:image/')) {
    return image;
  }
  
  // Otherwise, assume it's base64 and add data URL prefix
  // Default to JPEG if not specified
  return `data:image/jpeg;base64,${image}`;
}

/**
 * Parse GPT response and extract product information
 */
function parseGPTResponse(content: string): ProductIdentificationResult | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in GPT response:', content);
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!parsed.name || typeof parsed.confidence !== 'number') {
      console.error('Missing required fields in GPT response:', parsed);
      return null;
    }
    
    return {
      name: parsed.name,
      brand: parsed.brand || undefined,
      category: parsed.category || undefined,
      model: parsed.model || undefined,
      color: parsed.color || undefined,
      estimatedYear: parsed.estimatedYear || parsed.estimated_year || undefined,
      confidence: parsed.confidence
    };
  } catch (error) {
    console.error('Failed to parse GPT response:', error);
    return null;
  }
}

/**
 * Identify product from image using GPT-4 Vision
 */
export async function identifyProduct(
  image: string,
  userId: string
): Promise<{ 
  success: boolean; 
  result?: ProductIdentificationResult; 
  error?: ProductIdentificationError 
}> {
  try {
    // Validate image
    const validation = validateImage(image);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      };
    }
    
    // Prepare image for GPT
    const imageUrl = prepareImageForGPT(image);
    
    // Call GPT-4 Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Updated model name
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Identify this product. Analyze the image carefully and return the following information in JSON format:
{
  "name": "Product name",
  "brand": "Brand name",
  "category": "Product category (e.g., Electronics, Appliances, Furniture)",
  "model": "Model number or name if visible",
  "color": "Product color",
  "estimatedYear": Year as number (e.g., 2023),
  "confidence": Confidence score between 0 and 1 (e.g., 0.95)
}

Important:
- Be specific with the product name (e.g., "MacBook Pro 14-inch" not just "Laptop")
- Only include fields if you can determine them from the image
- Confidence should reflect how certain you are about the identification
- If no product is clearly visible, set confidence to 0 and name to "No product detected"`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.2 // Lower temperature for more consistent results
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: {
          code: 'NO_RESPONSE',
          message: 'Could not identify product, please try again'
        }
      };
    }
    
    // Parse the response
    const productInfo = parseGPTResponse(content);
    if (!productInfo) {
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'Could not identify product, please try again'
        }
      };
    }
    
    // Check confidence threshold
    if (productInfo.confidence < 0.7) {
      return {
        success: false,
        error: {
          code: 'LOW_CONFIDENCE',
          message: 'No product detected, please photograph the product clearly'
        }
      };
    }
    
    // Check if no product detected
    if (productInfo.name.toLowerCase().includes('no product')) {
      return {
        success: false,
        error: {
          code: 'NO_PRODUCT',
          message: 'No product detected, please photograph the product clearly'
        }
      };
    }
    
    // Add warranty suggestion
    productInfo.suggestedWarranty = suggestWarranty(
      productInfo.brand,
      productInfo.category
    );
    
    // Log identification for analytics
    await logProductIdentification(userId, productInfo);
    
    return {
      success: true,
      result: productInfo
    };
    
  } catch (error: any) {
    console.error('Product identification error:', error);
    
    // Handle specific OpenAI errors
    if (error.code === 'rate_limit_exceeded') {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'Too many requests, please try again in a moment'
        }
      };
    }
    
    if (error.code === 'invalid_image_url') {
      return {
        success: false,
        error: {
          code: 'INVALID_IMAGE',
          message: 'Could not process image, please try again'
        }
      };
    }
    
    return {
      success: false,
      error: {
        code: 'IDENTIFICATION_FAILED',
        message: 'Could not identify product, please try again'
      }
    };
  }
}

/**
 * Log product identification for analytics and improvement
 */
async function logProductIdentification(
  userId: string,
  result: ProductIdentificationResult
): Promise<void> {
  try {
    const db = admin.firestore();
    await db.collection('product_identifications').add({
      userId,
      productName: result.name,
      brand: result.brand || null,
      category: result.category || null,
      model: result.model || null,
      color: result.color || null,
      estimatedYear: result.estimatedYear || null,
      confidence: result.confidence,
      suggestedWarranty: result.suggestedWarranty || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log product identification:', error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}
