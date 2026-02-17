# Frontend Integration Guide - Product Identification API

## Quick Start

The Product Identification API allows users to snap a photo of their product and automatically get all the details filled in.

## Implementation Steps

### 1. Add API Service Function

Create or update `src/services/api.ts`:

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/coverkeep-af231/us-central1/api';

export interface ProductIdentificationResult {
  success: boolean;
  product?: {
    name: string;
    brand?: string;
    category?: string;
    model?: string;
    color?: string;
    estimatedYear?: number;
    confidence: number;
    suggestedWarranty?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export async function identifyProductFromImage(
  imageData: string,
  userId: string
): Promise<ProductIdentificationResult> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/products/identify`,
      {
        image: imageData,
        userId: userId
      },
      {
        timeout: 30000 // 30 second timeout for AI processing
      }
    );
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      return error.response.data;
    }
    
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server'
      }
    };
  }
}
```

### 2. Create Product Scanner Component

Create `src/components/ProductScanner.tsx`:

```typescript
import React, { useState, useRef } from 'react';
import { identifyProductFromImage } from '../services/api';
import { useAuth } from '../contexts/AuthContext'; // Your auth context

interface ProductScannerProps {
  onProductIdentified: (product: any) => void;
  onCancel: () => void;
}

export function ProductScanner({ onProductIdentified, onCancel }: ProductScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Please select an image under 10MB');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      // Convert to base64
      const base64 = await fileToBase64(file);
      setPreview(base64);
      
      // Identify product
      const result = await identifyProductFromImage(
        base64,
        currentUser?.uid || 'anonymous'
      );
      
      if (result.success && result.product) {
        // Success! Pass product data to parent
        onProductIdentified(result.product);
      } else {
        setError(result.error?.message || 'Unable to identify product');
      }
    } catch (err: any) {
      setError('An error occurred. Please try again.');
      console.error('Product identification error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const handleRetry = () => {
    setError(null);
    setPreview(null);
    fileInputRef.current?.click();
  };
  
  return (
    <div className="product-scanner">
      <h2>Scan Your Product</h2>
      <p>Take a clear photo of your product to auto-fill details</p>
      
      {!loading && !preview && (
        <div className="upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"  // Use camera on mobile
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
          >
            📷 Take Photo / Upload Image
          </button>
          
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      )}
      
      {loading && (
        <div className="loading-state">
          {preview && <img src={preview} alt="Product preview" />}
          <div className="spinner" />
          <p>Identifying product...</p>
          <p className="text-muted">This may take a few seconds</p>
        </div>
      )}
      
      {error && !loading && (
        <div className="error-state">
          {preview && <img src={preview} alt="Product preview" />}
          <div className="error-message">
            <p>⚠️ {error}</p>
          </div>
          <div className="actions">
            <button onClick={handleRetry} className="btn-primary">
              Try Again
            </button>
            <button onClick={onCancel} className="btn-secondary">
              Enter Manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. Add to Product Form

Update `src/pages/AddProduct.tsx`:

```typescript
import React, { useState } from 'react';
import { ProductScanner } from '../components/ProductScanner';

export function AddProductPage() {
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    model: '',
    color: '',
    purchaseDate: '',
    warrantyYears: 1
  });
  
  const handleProductIdentified = (product: any) => {
    // Pre-fill form with identified product data
    setFormData({
      ...formData,
      name: product.name || '',
      brand: product.brand || '',
      category: product.category || '',
      model: product.model || '',
      color: product.color || ''
    });
    
    // Parse suggested warranty
    if (product.suggestedWarranty) {
      const years = parseWarrantyYears(product.suggestedWarranty);
      if (years) {
        setFormData(prev => ({ ...prev, warrantyYears: years }));
      }
    }
    
    setShowScanner(false);
    
    // Show success message
    alert(`✅ Found: ${product.name}\nConfidence: ${(product.confidence * 100).toFixed(0)}%`);
  };
  
  const parseWarrantyYears = (warranty: string): number | null => {
    const match = warranty.match(/(\d+)\s*year/i);
    return match ? parseInt(match[1]) : null;
  };
  
  if (showScanner) {
    return (
      <ProductScanner
        onProductIdentified={handleProductIdentified}
        onCancel={() => setShowScanner(false)}
      />
    );
  }
  
  return (
    <div className="add-product-page">
      <h1>Add New Product</h1>
      
      <div className="scan-option">
        <button
          onClick={() => setShowScanner(true)}
          className="btn-scan"
        >
          📷 Scan Product with AI
        </button>
        <p className="text-muted">Or enter details manually below</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Product Name"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          required
        />
        
        <input
          type="text"
          placeholder="Brand"
          value={formData.brand}
          onChange={e => setFormData({ ...formData, brand: e.target.value })}
        />
        
        {/* More form fields... */}
        
        <button type="submit">Add Product</button>
      </form>
    </div>
  );
}
```

### 4. Styling

Add to your CSS file:

```css
.product-scanner {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.upload-area {
  margin: 2rem 0;
}

.upload-area button {
  display: block;
  width: 100%;
  padding: 1rem;
  margin: 0.5rem 0;
  font-size: 1.1rem;
}

.loading-state {
  padding: 2rem;
}

.loading-state img {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  margin: 1rem auto;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  padding: 2rem;
}

.error-state img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  margin-bottom: 1rem;
  opacity: 0.7;
}

.error-message {
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  padding: 1rem;
  margin: 1rem 0;
}

.actions button {
  margin: 0.5rem;
}
```

## Mobile Optimization

### Camera Access

The `capture="environment"` attribute on the file input will:
- Open the camera directly on mobile devices
- Use the rear camera by default (better for scanning)
- Fall back to file picker on desktop

### Image Compression

For mobile users, compress images before sending:

```typescript
async function compressImage(base64: string, maxWidth = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64;
  });
}

// Use it:
const compressed = await compressImage(base64, 1024);
const result = await identifyProductFromImage(compressed, userId);
```

## User Experience Tips

### 1. Show Confidence Score

```typescript
if (result.product && result.product.confidence < 0.85) {
  return (
    <div className="low-confidence-warning">
      ⚠️ We're {(result.product.confidence * 100).toFixed(0)}% confident about this identification.
      Please verify the details below.
    </div>
  );
}
```

### 2. Loading States

```typescript
<div className="loading-tips">
  <p>💡 Tips for better results:</p>
  <ul>
    <li>Ensure good lighting</li>
    <li>Keep product in focus</li>
    <li>Include brand logos if visible</li>
  </ul>
</div>
```

### 3. Error Recovery

```typescript
const ERROR_MESSAGES = {
  'NO_PRODUCT': {
    title: 'No Product Found',
    tip: 'Try taking a clearer photo with better lighting',
    retry: true
  },
  'IMAGE_TOO_SMALL': {
    title: 'Image Too Small',
    tip: 'Take a closer photo of the product',
    retry: true
  },
  'RATE_LIMIT': {
    title: 'Too Many Requests',
    tip: 'Please wait a moment and try again',
    retry: true
  }
};
```

## Testing Checklist

- [ ] Upload image from file picker works
- [ ] Camera capture works on mobile
- [ ] Loading state displays correctly
- [ ] Success state pre-fills form
- [ ] Error state shows user-friendly messages
- [ ] Retry functionality works
- [ ] Manual entry fallback works
- [ ] Image compression works on mobile
- [ ] Confidence score is displayed
- [ ] Warranty suggestion is applied

## Performance Considerations

1. **Image Size**: Compress images before sending (target ~500KB)
2. **Timeout**: Set 30-second timeout for AI processing
3. **Caching**: Consider caching results for identical images
4. **Fallback**: Always provide manual entry option

## Analytics

Track usage for improvement:

```typescript
import { logEvent } from './analytics';

// On success
logEvent('product_identified', {
  confidence: result.product.confidence,
  category: result.product.category,
  duration_ms: identificationTime
});

// On error
logEvent('product_identification_failed', {
  error_code: result.error.code,
  retry_count: retryCount
});
```

## Troubleshooting

### Issue: "No product detected"
- **Solution**: Ensure product is clearly visible, well-lit, and in focus

### Issue: "Image too small"
- **Solution**: Check compression settings, ensure minimum 200x200px

### Issue: "Rate limit exceeded"
- **Solution**: Implement retry with exponential backoff, show queue position

### Issue: Slow response times
- **Solution**: Show progress indicator, compress images, check network

## Next Steps

1. Implement the ProductScanner component
2. Add to your AddProduct page
3. Test with various products
4. Gather user feedback
5. Monitor success rates via analytics

## Questions?

Contact the backend team or check the full API documentation in `PRODUCT_IDENTIFICATION_API.md`.
