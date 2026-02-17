# Barcode Lookup API Integration

## Overview

CoverKeep now includes automatic product information lookup via barcode scanning! When users scan a product barcode, the app automatically fetches:
- Product name
- Brand/manufacturer
- Category
- Model/variant (when available)

## Implementation Details

### Endpoint

**POST** `/api/v1/products/lookup-barcode`

### Request

```json
{
  "barcode": "5901234123457"
}
```

### Response (Success)

```json
{
  "success": true,
  "data": {
    "name": "Grandeur Cotton Hospitality 6-piece Towel Set",
    "brand": "WestPoint Home, Inc.",
    "category": "Home & Garden > Linens & Bedding > Towels",
    "model": null,
    "confidence": "high",
    "cached": false
  }
}
```

### Response (Not Found)

```json
{
  "success": false,
  "error": {
    "code": "BARCODE_NOT_FOUND",
    "message": "Product information not found for this barcode. Please enter details manually."
  }
}
```

## API Strategy

### Multi-API Fallback System

The implementation uses **three free APIs** with intelligent fallback:

#### 1. UPCitemdb.com (Primary)
- **Quality**: ⭐⭐⭐⭐⭐ High
- **Coverage**: General products, electronics, household items
- **Rate Limit**: 100 requests/day (free tier)
- **Confidence**: High

#### 2. Open Food Facts (Secondary)
- **Quality**: ⭐⭐⭐⭐ Medium-High
- **Coverage**: Food and beverage products
- **Rate Limit**: Unlimited
- **Confidence**: Medium

#### 3. EAN-Search.org (Tertiary)
- **Quality**: ⭐⭐⭐ Medium
- **Coverage**: General EAN/UPC codes
- **Rate Limit**: Free
- **Confidence**: Medium

### Why This Approach?

1. **Best Quality First**: UPCitemdb has the most complete product information
2. **Fallback Coverage**: If UPCitemdb is rate-limited or doesn't have the product, Open Food Facts covers food items
3. **Maximum Coverage**: EAN-Search provides additional coverage for products not in the first two databases
4. **Cost-Free**: All three APIs are free to use

## Caching Strategy

### Firestore Cache Collection

To avoid hitting rate limits and improve response times, all successful lookups are cached in Firestore:

**Collection**: `barcode_cache`

**Document ID**: The barcode (e.g., "5901234123457")

**Fields**:
```javascript
{
  barcode: "5901234123457",
  name: "Product Name",
  brand: "Brand Name",
  category: "Category",
  model: "Model Number",
  confidence: "high",
  source: "UPCitemdb",
  cachedAt: Timestamp
}
```

**Cache TTL**: 30 days

### Benefits

- ✅ No duplicate API calls for same barcode
- ✅ Faster response times (cached results instant)
- ✅ Avoids rate limits on free APIs
- ✅ Reduces external API dependency

## Testing

### Test Results

Tested with multiple barcodes:

| Barcode | Product | Result | Source |
|---------|---------|--------|--------|
| 5901234123457 | Towel Set | ✅ Found | UPCitemdb |
| 012345678905 | Ravioli | ✅ Found | UPCitemdb |
| 3017620422003 | Nutella | ✅ Found | Open Food Facts |
| 0051000012510 | Generic | ❌ Not Found | - |

**Success Rate**: 75% (3/4 barcodes found)

### Run Tests

```bash
cd functions
node test-barcode-lookup.js
```

## Usage Example

### From Mobile App (React Native)

```javascript
async function scanBarcode(barcodeValue) {
  setLoading(true);
  
  try {
    const response = await fetch(
      'https://YOUR-API-URL/api/v1/products/lookup-barcode',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ barcode: barcodeValue })
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      // Auto-populate product form
      setProductName(data.data.name);
      setProductBrand(data.data.brand || '');
      setProductCategory(data.data.category || '');
      
      console.log('✅ Product info auto-filled!');
    } else {
      // Show manual entry form
      console.log('❌ Product not found, enter manually');
      setShowManualEntry(true);
    }
  } catch (error) {
    console.error('Barcode lookup failed:', error);
    setShowManualEntry(true);
  } finally {
    setLoading(false);
  }
}
```

### From curl (Testing)

```bash
# Test barcode lookup
curl -X POST http://localhost:5001/coverkeep-af231/us-central1/api/v1/products/lookup-barcode \
  -H "Content-Type: application/json" \
  -d '{"barcode":"5901234123457"}'

# Expected response:
{
  "success": true,
  "data": {
    "name": "Grandeur Cotton Hospitality 6-piece Towel Set",
    "brand": "WestPoint Home, Inc.",
    "category": "Home & Garden > Linens & Bedding > Towels",
    "model": null,
    "confidence": "high",
    "cached": false
  }
}
```

## Error Handling

The endpoint handles:

1. **Invalid barcode format** → 400 Bad Request
2. **Barcode not found** → 404 Not Found (with helpful message)
3. **API failures** → Tries fallback APIs
4. **Server errors** → 500 with generic error

All error responses include a user-friendly message suggesting manual entry.

## Security

- ✅ No authentication required (barcode lookup is public data)
- ✅ Rate limiting handled via caching
- ✅ Input sanitization (removes spaces, dashes)
- ✅ Timeout protection (5s per API call)

## Future Enhancements

Potential improvements:

1. **User-contributed data**: Allow users to submit product info for barcodes not in databases
2. **Image recognition**: Use product images to improve matching
3. **More APIs**: Add Barcode Lookup, UPC Database, etc.
4. **Analytics**: Track which products are commonly scanned
5. **Offline mode**: Cache common products locally in mobile app

## Deployment

### Environment Variables

No API keys required! All three APIs used are free and don't require authentication.

### Firestore Security Rules

Add rule for barcode cache collection:

```javascript
match /barcode_cache/{barcodeId} {
  // Anyone can read cached barcode data (public product information)
  allow read: if true;
  
  // Only backend can write to cache
  allow write: if false;
}
```

### Deploy to Production

```bash
cd coverkeep-backend
firebase deploy --only functions
```

The endpoint will be available at:
```
https://us-central1-coverkeep-af231.cloudfunctions.net/api/v1/products/lookup-barcode
```

## Support

Questions or issues? Contact KP3 Ventures or open a GitHub issue.

---

**Implementation Date**: February 17, 2026
**Developer**: Backend Dev Agent (via OpenClaw)
**Status**: ✅ Production Ready
