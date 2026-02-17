# Frontend Integration Guide - Barcode Lookup

## Quick Start

The barcode lookup API is now live and ready to integrate with the mobile app!

## API Endpoint

**URL**: `POST /api/v1/products/lookup-barcode`

**Production**: `https://us-central1-coverkeep-af231.cloudfunctions.net/api/v1/products/lookup-barcode`

**Local Dev**: `http://localhost:5001/coverkeep-af231/us-central1/api/v1/products/lookup-barcode`

## Integration Steps

### 1. When Barcode is Scanned

After the camera scans a barcode, call the API:

```javascript
async function handleBarcodeScanned(barcodeData) {
  // Show loading state
  setLoadingProductInfo(true);
  
  try {
    const response = await fetch(API_URL + '/api/v1/products/lookup-barcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No auth required for barcode lookup
      },
      body: JSON.stringify({
        barcode: barcodeData.value
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // ✅ Product found - auto-populate form
      handleProductFound(result.data);
    } else {
      // ❌ Product not found - show manual entry
      handleProductNotFound(barcodeData.value);
    }
  } catch (error) {
    console.error('Barcode lookup failed:', error);
    // Fallback to manual entry
    handleProductNotFound(barcodeData.value);
  } finally {
    setLoadingProductInfo(false);
  }
}
```

### 2. Auto-Populate Product Form

```javascript
function handleProductFound(productData) {
  // Auto-fill form fields
  setProductName(productData.name);
  setProductBrand(productData.brand || '');
  setProductCategory(productData.category || '');
  
  // Show success message
  showToast({
    type: 'success',
    message: `Found: ${productData.name}`,
    duration: 3000
  });
  
  // Navigate to product form with pre-filled data
  navigation.navigate('AddProduct', {
    prefilled: {
      name: productData.name,
      brand: productData.brand,
      category: productData.category,
      barcode: barcodeData.value
    }
  });
}
```

### 3. Handle Not Found

```javascript
function handleProductNotFound(barcode) {
  // Show helpful message
  showToast({
    type: 'info',
    message: 'Product not found. Please enter details manually.',
    duration: 4000
  });
  
  // Navigate to manual entry with barcode saved
  navigation.navigate('AddProduct', {
    barcode: barcode,
    requiresManualEntry: true
  });
}
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "name": "Product Name Here",
    "brand": "Brand Name",
    "category": "Electronics > Cameras",
    "model": "Model-123",
    "confidence": "high",
    "cached": false
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "BARCODE_NOT_FOUND",
    "message": "Product information not found for this barcode. Please enter details manually."
  }
}
```

## UI/UX Recommendations

### Loading State

While fetching barcode data (usually 1-5 seconds):

```jsx
{loadingProductInfo && (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>
      Looking up product info...
    </Text>
  </View>
)}
```

### Success State

Show a brief success animation/toast before navigating:

```jsx
<Toast
  visible={showSuccessToast}
  type="success"
  message={`Found: ${productName}`}
  icon="checkmark-circle"
/>
```

### Not Found State

Show a helpful message and proceed to manual entry:

```jsx
<Alert
  title="Product Not Found"
  message="We couldn't find this product in our database. Please enter the details manually."
  buttons={[
    {
      text: 'Enter Manually',
      onPress: () => navigation.navigate('AddProduct', { barcode })
    },
    {
      text: 'Try Another Scan',
      onPress: () => navigation.goBack()
    }
  ]}
/>
```

## Example: Complete Flow

```javascript
// In your BarcodeScanner component

import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Camera } from 'react-native-vision-camera';

const BarcodeScanner = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  
  const onBarcodeDetected = async (codes) => {
    if (codes.length === 0 || loading) return;
    
    const barcode = codes[0].value;
    setLoading(true);
    
    try {
      const response = await fetch(
        'https://us-central1-coverkeep-af231.cloudfunctions.net/api/v1/products/lookup-barcode',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcode })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        // Success - auto-populate
        navigation.navigate('AddProduct', {
          barcode,
          name: data.data.name,
          brand: data.data.brand,
          category: data.data.category,
          autoFilled: true
        });
      } else {
        // Not found - manual entry
        navigation.navigate('AddProduct', {
          barcode,
          manualEntry: true
        });
      }
    } catch (error) {
      console.error('Lookup failed:', error);
      navigation.navigate('AddProduct', {
        barcode,
        manualEntry: true
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={{ flex: 1 }}
        device={device}
        isActive={true}
        onCodeScanned={onBarcodeDetected}
      />
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>
            Looking up product...
          </Text>
        </View>
      )}
    </View>
  );
};
```

## Testing

### Test Barcodes

These barcodes are confirmed working:

| Barcode | Product | Expected Result |
|---------|---------|----------------|
| 5901234123457 | Towel Set | ✅ Found via UPCitemdb |
| 3017620422003 | Nutella | ✅ Found via Open Food Facts |
| 012345678905 | Ravioli | ✅ Found via UPCitemdb |

### Manual Testing

1. Run the backend locally or use production URL
2. Open the mobile app
3. Navigate to "Add Product"
4. Tap "Scan Barcode"
5. Scan one of the test barcodes above
6. Verify product info auto-populates

## Error Handling

The API handles these scenarios:

1. **Invalid barcode format** → 400 error
2. **Barcode not found** → 404 with helpful message
3. **API timeout** → 500 error (fallback to manual entry)
4. **Network error** → Handle in client (fallback to manual entry)

Always fallback to manual entry if the lookup fails!

## Performance

- **Cold start**: 2-5 seconds (first time)
- **Cached lookup**: <100ms (instant)
- **API timeout**: 5 seconds per source
- **Total max time**: 15 seconds (tries 3 APIs)

## Analytics (Optional)

Consider tracking:

```javascript
// Log barcode scan event
analytics.logEvent('barcode_scanned', {
  barcode: barcode,
  found: result.success,
  source: result.data?.source || 'none',
  cached: result.data?.cached || false
});
```

## Support

Questions? Check:
- Backend docs: `coverkeep-backend/BARCODE_API_INTEGRATION.md`
- Test script: `coverkeep-backend/functions/test-barcode-lookup.js`
- GitHub: https://github.com/kp3ventures/coverkeep-backend

---

**Happy coding!** 🎉
