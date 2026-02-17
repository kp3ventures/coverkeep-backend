/**
 * Standalone test script for barcode lookup API
 * Tests the barcode lookup functions without needing Firebase emulators
 */

const axios = require('axios');

// Test barcodes
const TEST_BARCODES = [
  '5901234123457', // Generic EAN-13
  '012345678905',  // Generic UPC
  '3017620422003', // Nutella (food product - good for Open Food Facts)
  '0051000012510', // Coca-Cola
];

// Barcode lookup functions (copied from products.ts)
async function lookupUPCItemDB(barcode) {
  try {
    console.log(`  Trying UPCitemdb.com...`);
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
    console.log(`  ❌ UPCitemdb: No results`);
    return null;
  } catch (error) {
    console.log(`  ❌ UPCitemdb: ${error.message}`);
    return null;
  }
}

async function lookupOpenFoodFacts(barcode) {
  try {
    console.log(`  Trying Open Food Facts...`);
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
    console.log(`  ❌ Open Food Facts: No results`);
    return null;
  } catch (error) {
    console.log(`  ❌ Open Food Facts: ${error.message}`);
    return null;
  }
}

async function lookupEANSearch(barcode) {
  try {
    console.log(`  Trying EAN-Search.org...`);
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
    console.log(`  ❌ EAN-Search: No results`);
    return null;
  } catch (error) {
    console.log(`  ❌ EAN-Search: ${error.message}`);
    return null;
  }
}

async function lookupBarcodeWithFallback(barcode) {
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

// Run tests
async function runTests() {
  console.log('🧪 Testing Barcode Lookup API Integration\n');
  console.log('Testing with multiple free APIs:');
  console.log('1. UPCitemdb.com (100 requests/day)');
  console.log('2. Open Food Facts (unlimited, food-focused)');
  console.log('3. EAN-Search.org (free)\n');
  
  for (const barcode of TEST_BARCODES) {
    console.log(`\n📊 Testing barcode: ${barcode}`);
    console.log('─'.repeat(50));
    
    const result = await lookupBarcodeWithFallback(barcode);
    
    if (result) {
      console.log(`\n✅ SUCCESS via ${result.source}:`);
      console.log(`   Name:       ${result.name}`);
      console.log(`   Brand:      ${result.brand || 'N/A'}`);
      console.log(`   Category:   ${result.category || 'N/A'}`);
      console.log(`   Model:      ${result.model || 'N/A'}`);
      console.log(`   Confidence: ${result.confidence}`);
    } else {
      console.log(`\n❌ FAILED: Product not found in any API`);
    }
  }
  
  console.log('\n\n✨ Test complete!\n');
  console.log('Summary:');
  console.log('- Endpoint will be: POST /api/v1/products/lookup-barcode');
  console.log('- Input: { "barcode": "123456789" }');
  console.log('- Output: { "success": true, "data": { ... } }');
  console.log('- Caching: 30-day Firestore cache to avoid rate limits');
  console.log('- Fallback: 3 APIs tried in sequence for best coverage\n');
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
