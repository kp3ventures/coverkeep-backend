/**
 * Manual test script for Product Identification API
 * Run: node test-product-identification.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test images URLs (publicly accessible product images)
const TEST_IMAGES = {
  macbook: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spacegray-select-202310?wid=904&hei=840&fmt=jpeg&qlt=90',
  iphone: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80',
  lamp: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
  bottle: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800',
  // Can be replaced with local file paths or base64
};

// API endpoint (update if different)
const API_BASE_URL = 'http://localhost:5001/coverkeep-af231/us-central1/api';
const ENDPOINT = `${API_BASE_URL}/api/v1/products/identify`;

/**
 * Test the product identification endpoint
 */
async function testProductIdentification(testName, imageInput) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(60));
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(ENDPOINT, {
      image: imageInput,
      userId: 'test-user-123'
    }, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    
    console.log('✅ SUCCESS');
    console.log(`Duration: ${duration}ms`);
    console.log('\nResponse:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.product) {
      const product = response.data.product;
      console.log('\n--- Product Summary ---');
      console.log(`Name: ${product.name}`);
      console.log(`Brand: ${product.brand || 'N/A'}`);
      console.log(`Category: ${product.category || 'N/A'}`);
      console.log(`Model: ${product.model || 'N/A'}`);
      console.log(`Color: ${product.color || 'N/A'}`);
      console.log(`Year: ${product.estimatedYear || 'N/A'}`);
      console.log(`Confidence: ${(product.confidence * 100).toFixed(1)}%`);
      console.log(`Warranty: ${product.suggestedWarranty || 'N/A'}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ FAILED');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.log('Error: Cannot connect to API. Is the server running?');
      console.log(`Expected URL: ${ENDPOINT}`);
    } else {
      console.log('Error:', error.message);
    }
    
    return false;
  }
}

/**
 * Test error cases
 */
async function testErrorCases() {
  console.log('\n\n' + '='.repeat(60));
  console.log('ERROR HANDLING TESTS');
  console.log('='.repeat(60));
  
  // Test 1: Missing image
  console.log('\nTest: Missing image field');
  try {
    await axios.post(ENDPOINT, { userId: 'test-user' });
    console.log('❌ Should have failed but succeeded');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly rejected:', error.response.data.error.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  // Test 2: Missing userId
  console.log('\nTest: Missing userId field');
  try {
    await axios.post(ENDPOINT, { image: 'test-image' });
    console.log('❌ Should have failed but succeeded');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly rejected:', error.response.data.error.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  // Test 3: Invalid image format
  console.log('\nTest: Invalid image format');
  try {
    await axios.post(ENDPOINT, { image: 'not-a-valid-image!!!', userId: 'test-user' });
    console.log('❌ Should have failed but succeeded');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly rejected:', error.response.data.error.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  // Test 4: Image too small
  console.log('\nTest: Image too small');
  try {
    await axios.post(ENDPOINT, { image: 'abc123', userId: 'test-user' });
    console.log('❌ Should have failed but succeeded');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly rejected:', error.response.data.error.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     CoverKeep Product Identification API Test Suite       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log('\nEndpoint:', ENDPOINT);
  console.log('Note: Make sure Firebase emulator is running!');
  console.log('      Run: cd functions && npm run serve');
  
  // Test error handling first
  await testErrorCases();
  
  // Test with real images (URLs)
  console.log('\n\n' + '='.repeat(60));
  console.log('PRODUCT IDENTIFICATION TESTS');
  console.log('='.repeat(60));
  
  let successCount = 0;
  let totalTests = 0;
  
  // Test each image
  for (const [name, url] of Object.entries(TEST_IMAGES)) {
    totalTests++;
    const success = await testProductIdentification(name.toUpperCase(), url);
    if (success) successCount++;
    
    // Wait a bit between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${successCount}`);
  console.log(`Failed: ${totalTests - successCount}`);
  console.log(`Success Rate: ${((successCount / totalTests) * 100).toFixed(1)}%`);
  
  if (successCount === totalTests) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above.');
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('\n❌ Test suite crashed:', error.message);
    process.exit(1);
  });
}

module.exports = { testProductIdentification, testErrorCases };
