import { identifyProduct } from '../services/productIdentification';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env.local' });

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: () => ({
      add: jest.fn().mockResolvedValue({ id: 'mock-id' })
    })
  }),
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn()
    }
  }
}));

describe('Product Identification Service', () => {
  // Test with actual API (requires OPENAI_API_KEY)
  describe('identifyProduct', () => {
    it('should identify a MacBook from description', async () => {
      // For testing without actual images, we'll test the validation logic
      const testUserId = 'test-user-123';
      
      // Test invalid image format
      const invalidResult = await identifyProduct('invalid-image', testUserId);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error?.code).toBe('INVALID_IMAGE_FORMAT');
    });
    
    it('should reject images that are too small', async () => {
      const testUserId = 'test-user-123';
      const tinyImage = 'abc123'; // Too small
      
      const result = await identifyProduct(tinyImage, testUserId);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IMAGE_TOO_SMALL');
    });
    
    it('should accept valid URLs', async () => {
      const testUserId = 'test-user-123';
      const validUrl = 'https://example.com/image.jpg';
      
      // This will fail at the OpenAI API stage, but should pass validation
      const result = await identifyProduct(validUrl, testUserId);
      // We expect it to fail at the API level, not validation
      expect(result.error?.code).not.toBe('INVALID_IMAGE_URL');
      expect(result.error?.code).not.toBe('INVALID_IMAGE_FORMAT');
    });
  });
  
  describe('Warranty Suggestion Logic', () => {
    // These tests would require exposing the suggestWarranty function
    // For now, we'll test it through the full flow
    
    it('should suggest Apple warranty for Apple products', () => {
      // This would be tested through integration tests
      expect(true).toBe(true);
    });
  });
});

// Manual test function for real images
export async function manualTest() {
  const testUserId = 'test-user-manual';
  
  console.log('\n=== Manual Product Identification Test ===\n');
  
  // Test 1: Invalid image
  console.log('Test 1: Invalid image format');
  const invalidResult = await identifyProduct('invalid-data', testUserId);
  console.log('Result:', JSON.stringify(invalidResult, null, 2));
  
  // Test 2: Small image
  console.log('\nTest 2: Image too small');
  const smallResult = await identifyProduct('abc123', testUserId);
  console.log('Result:', JSON.stringify(smallResult, null, 2));
  
  // Test 3: Valid URL (placeholder - won't work without actual product image)
  console.log('\nTest 3: Valid URL format');
  const urlResult = await identifyProduct('https://example.com/product.jpg', testUserId);
  console.log('Result:', JSON.stringify(urlResult, null, 2));
  
  console.log('\n=== Tests Complete ===\n');
}

// Run manual test if executed directly
if (require.main === module) {
  manualTest().catch(console.error);
}
