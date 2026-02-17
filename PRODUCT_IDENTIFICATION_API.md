# Product Identification API Documentation

## Overview

The Product Identification API uses GPT-4 Vision to automatically identify products from images and suggest appropriate warranty information. This eliminates the need for manual data entry when adding products to CoverKeep.

## Endpoint

```
POST /api/v1/products/identify
```

## Authentication

No authentication required for this endpoint (considers userId for logging purposes).

## Request

### Headers

```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type   | Required | Description                                           |
|-----------|--------|----------|-------------------------------------------------------|
| `image`   | string | Yes      | Base64-encoded image string or public image URL       |
| `userId`  | string | Yes      | User ID for logging and analytics                     |

### Example Request (URL)

```json
{
  "image": "https://example.com/product-image.jpg",
  "userId": "user123"
}
```

### Example Request (Base64)

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "userId": "user123"
}
```

### Example Request (Raw Base64)

```json
{
  "image": "/9j/4AAQSkZJRgABAQAAAQ...",
  "userId": "user123"
}
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "product": {
    "name": "MacBook Pro 14-inch",
    "brand": "Apple",
    "category": "Electronics",
    "model": "M3 Max",
    "color": "Space Black",
    "estimatedYear": 2023,
    "confidence": 0.95,
    "suggestedWarranty": "1 year (Apple standard warranty)"
  },
  "error": null
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "product": null,
  "error": {
    "code": "NO_PRODUCT",
    "message": "No product detected, please photograph the product clearly"
  }
}
```

## Response Fields

### Product Object

| Field               | Type   | Description                                          |
|---------------------|--------|------------------------------------------------------|
| `name`              | string | Product name (e.g., "MacBook Pro 14-inch")           |
| `brand`             | string | Brand name (e.g., "Apple")                           |
| `category`          | string | Product category (e.g., "Electronics")               |
| `model`             | string | Model number or name                                 |
| `color`             | string | Product color                                        |
| `estimatedYear`     | number | Estimated year of manufacture                        |
| `confidence`        | number | Confidence score (0.0 - 1.0)                         |
| `suggestedWarranty` | string | Suggested warranty period based on product type      |

## Error Codes

| Code                    | HTTP Status | Description                                          |
|-------------------------|-------------|------------------------------------------------------|
| `INVALID_IMAGE`         | 400         | Image parameter missing or invalid format            |
| `INVALID_USER_ID`       | 400         | userId parameter missing or invalid                  |
| `INVALID_IMAGE_URL`     | 400         | Provided URL is not valid                            |
| `INVALID_IMAGE_FORMAT`  | 400         | Image is not a valid base64 string or URL            |
| `IMAGE_TOO_SMALL`       | 400         | Image data too small, likely corrupted               |
| `LOW_CONFIDENCE`        | 400         | Confidence below 0.7 threshold                       |
| `NO_PRODUCT`            | 400         | No product visible in image                          |
| `RATE_LIMIT`            | 400         | OpenAI API rate limit exceeded, try again later      |
| `SERVER_ERROR`          | 500         | Unexpected server error                              |

## Warranty Suggestion Logic

The API automatically suggests warranty periods based on product category and brand:

| Product Type           | Suggested Warranty                    |
|------------------------|---------------------------------------|
| Apple products         | 1 year (Apple standard warranty)      |
| Samsung products       | 1 year (Samsung standard warranty)    |
| Electronics (general)  | 1-2 years (manufacturer standard)     |
| Appliances             | 2-5 years (varies by type)            |
| Furniture              | 1-3 years (varies by manufacturer)    |
| Clothing/Apparel       | 30-90 days (return policy varies)     |
| Other                  | Check manufacturer website            |

## Usage Examples

### JavaScript/TypeScript (Axios)

```typescript
import axios from 'axios';

async function identifyProduct(imageUrl: string, userId: string) {
  try {
    const response = await axios.post(
      'https://your-api-url/api/v1/products/identify',
      {
        image: imageUrl,
        userId: userId
      }
    );
    
    if (response.data.success) {
      console.log('Identified:', response.data.product.name);
      console.log('Confidence:', response.data.product.confidence);
      console.log('Warranty:', response.data.product.suggestedWarranty);
      return response.data.product;
    } else {
      console.error('Identification failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('API error:', error);
    return null;
  }
}

// Usage
const product = await identifyProduct(
  'https://example.com/product.jpg',
  'user123'
);
```

### JavaScript (Fetch API)

```javascript
async function identifyProduct(imageUrl, userId) {
  const response = await fetch(
    'https://your-api-url/api/v1/products/identify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageUrl,
        userId: userId
      })
    }
  );
  
  const data = await response.json();
  
  if (data.success) {
    return data.product;
  } else {
    throw new Error(data.error.message);
  }
}
```

### React Component Example

```typescript
import React, { useState } from 'react';
import axios from 'axios';

function ProductIdentifier() {
  const [image, setImage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImage(base64);
      
      // Identify product
      await identifyProduct(base64);
    };
    reader.readAsDataURL(file);
  };
  
  const identifyProduct = async (imageData: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/v1/products/identify', {
        image: imageData,
        userId: 'current-user-id' // Replace with actual user ID
      });
      
      if (response.data.success) {
        setResult(response.data.product);
      } else {
        setError(response.data.error.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to identify product');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileUpload} />
      
      {loading && <p>Identifying product...</p>}
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {result && (
        <div>
          <h3>{result.name}</h3>
          <p>Brand: {result.brand}</p>
          <p>Category: {result.category}</p>
          <p>Confidence: {(result.confidence * 100).toFixed(0)}%</p>
          <p>Warranty: {result.suggestedWarranty}</p>
        </div>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Image Quality

- Use clear, well-lit photos
- Ensure product is visible and in focus
- Avoid blurry or too-small images
- Center the product in the frame

### 2. Error Handling

Always handle errors gracefully:

```typescript
try {
  const result = await identifyProduct(image, userId);
  if (result.success) {
    // Handle success
  } else {
    // Show user-friendly error message
    showError(result.error.message);
  }
} catch (error) {
  // Handle network or server errors
  showError('Unable to connect to server');
}
```

### 3. User Feedback

- Show loading state while identifying
- Display confidence score to user
- Allow manual correction if confidence is low
- Offer manual entry as fallback

### 4. Rate Limiting

The API uses OpenAI's GPT-4 Vision, which has rate limits:
- Implement retry logic with exponential backoff
- Cache results when possible
- Show appropriate error messages during rate limiting

### 5. Privacy

- Only send images that users have explicitly uploaded
- Don't store images longer than necessary
- Inform users that images are processed by AI

## Testing

### Manual Testing

Run the test script:

```bash
cd functions
node test-product-identification.js
```

### Integration Testing

```typescript
import { identifyProduct } from './services/productIdentification';

describe('Product Identification', () => {
  it('should identify a MacBook', async () => {
    const result = await identifyProduct(
      'https://example.com/macbook.jpg',
      'test-user'
    );
    
    expect(result.success).toBe(true);
    expect(result.result?.brand).toBe('Apple');
    expect(result.result?.confidence).toBeGreaterThan(0.7);
  });
});
```

## Limitations

1. **Confidence Threshold**: Only returns results with >0.7 confidence
2. **Rate Limits**: Subject to OpenAI API rate limits
3. **Image Size**: Very large images may need compression
4. **Product Types**: Works best with clearly visible, well-known products
5. **Cost**: Each identification uses OpenAI API credits

## Analytics & Logging

All product identifications are logged to Firestore for:
- Improving accuracy over time
- User history and patterns
- Analytics and reporting

Logged data includes:
- Product name, brand, category
- Confidence score
- Timestamp
- User ID (for analytics, not stored with images)

## Future Enhancements

- [ ] Batch identification for multiple products
- [ ] Caching of previously identified products
- [ ] Fine-tuned model for specific product categories
- [ ] Integration with barcode database for validation
- [ ] User feedback loop to improve accuracy
- [ ] Support for multiple products in one image

## Support

For issues or questions:
- GitHub Issues: [coverkeep-backend](https://github.com/your-repo/coverkeep-backend)
- Email: support@coverkeep.app
- Documentation: https://docs.coverkeep.app

## Version History

### v1.0.0 (2026-02-17)
- Initial release
- GPT-4 Vision integration
- Warranty suggestion logic
- Error handling and validation
- Analytics and logging
