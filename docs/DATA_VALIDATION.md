# CoverKeep Data Validation Rules

**Project**: coverkeep-af231  
**Version**: 1.0  
**Last Updated**: 2026-02-17

## Overview

This document defines validation rules for all data written to Firestore. These rules are enforced at multiple levels:

1. **Client-side validation** (React/TypeScript) - UX feedback
2. **API validation** (Cloud Functions) - Business logic enforcement
3. **Security rules** (Firestore Rules) - Final authorization layer

---

## Table of Contents

1. [Field Validation Rules](#field-validation-rules)
2. [Enum Values](#enum-values)
3. [Timestamp Validation](#timestamp-validation)
4. [Currency Validation](#currency-validation)
5. [String Validation](#string-validation)
6. [Array Validation](#array-validation)
7. [File Upload Validation](#file-upload-validation)
8. [Business Logic Validation](#business-logic-validation)

---

## Field Validation Rules

### Users Collection

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| `userId` | string | ✅ | Must match Firebase Auth UID |
| `email` | string | ✅ | Valid email format, max 254 chars |
| `displayName` | string\|null | ❌ | Max 100 chars, no special chars except `-`, `_`, `.` |
| `photoURL` | string\|null | ❌ | Valid URL, HTTPS only |
| `phoneNumber` | string\|null | ❌ | E.164 format (e.g., `+14155552671`) |
| `subscriptionTier` | enum | ✅ | One of: `free`, `premium`, `family` |
| `subscriptionStatus` | enum | ✅ | One of: `active`, `canceled`, `expired`, `trial` |
| `subscriptionStartDate` | Timestamp\|null | ❌ | Must be <= now |
| `subscriptionEndDate` | Timestamp\|null | ❌ | Must be > subscriptionStartDate |
| `trialEndDate` | Timestamp\|null | ❌ | Max 30 days from now |
| `productsCount` | number | ✅ | Integer >= 0 |
| `productsLimit` | number | ✅ | 5 (free), 100 (premium), 500 (family) |
| `notificationsEnabled` | boolean | ✅ | true/false |
| `reminderDaysBefore` | number[] | ✅ | Array of integers, max 5 values, each 1-365 |
| `timezone` | string | ✅ | Valid IANA timezone (e.g., `America/Los_Angeles`) |
| `createdAt` | Timestamp | ✅ | Must be set to server time on create |
| `updatedAt` | Timestamp | ✅ | Must be set to server time on write |

### Products Collection

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| `productId` | string | ✅ | Auto-generated Firestore ID |
| `userId` | string | ✅ | Must match authenticated user |
| `productName` | string | ✅ | 1-200 chars, no leading/trailing spaces |
| `brand` | string\|null | ❌ | Max 100 chars |
| `model` | string\|null | ❌ | Max 100 chars |
| `serialNumber` | string\|null | ❌ | Max 100 chars, alphanumeric + hyphens |
| `category` | string\|null | ❌ | Max 50 chars |
| `warrantyType` | enum | ✅ | One of: `manufacturer`, `extended`, `store`, `credit_card` |
| `warrantyProvider` | string\|null | ❌ | Max 200 chars |
| `warrantyStartDate` | Timestamp | ✅ | Valid timestamp, 2000-2050 |
| `warrantyEndDate` | Timestamp | ✅ | Must be > warrantyStartDate |
| `warrantyDurationMonths` | number | ✅ | Integer 1-600 (50 years max) |
| `warrantyStatus` | enum | ✅ | One of: `active`, `expired`, `claimed`, `archived` |
| `purchaseDate` | Timestamp | ✅ | Must be <= warrantyStartDate |
| `purchasePrice` | number\|null | ❌ | Integer >= 0 (cents), max $1,000,000 |
| `purchaseLocation` | string\|null | ❌ | Max 200 chars |
| `purchaseReceiptURL` | string\|null | ❌ | Valid Cloud Storage URL |
| `warrantyDocumentURL` | string\|null | ❌ | Valid Cloud Storage URL |
| `photos` | string[] | ✅ | Max 10 URLs, each valid Cloud Storage URL |
| `aiDetected` | boolean | ✅ | true/false |
| `aiConfidence` | number\|null | ❌ | Float 0.0-1.0 |
| `notes` | string\|null | ❌ | Max 2000 chars |
| `isArchived` | boolean | ✅ | true/false |
| `archivedAt` | Timestamp\|null | ❌ | Must be set when isArchived = true |
| `createdAt` | Timestamp | ✅ | Server time |
| `updatedAt` | Timestamp | ✅ | Server time |

### Warranties Collection

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| `warrantyId` | string | ✅ | Auto-generated |
| `productId` | string | ✅ | Must exist in products collection |
| `userId` | string | ✅ | Must match authenticated user |
| `warrantyProvider` | string | ✅ | 1-200 chars |
| `warrantyPolicyNumber` | string | ✅ | 1-100 chars, alphanumeric |
| `coverageDetails` | string | ✅ | 1-5000 chars |
| `deductible` | number\|null | ❌ | Integer >= 0 (cents) |
| `maxClaimAmount` | number\|null | ❌ | Integer >= 0 (cents) |
| `claimsAllowed` | number\|null | ❌ | Integer >= 0 |
| `claimsUsed` | number | ✅ | Integer >= 0, <= claimsAllowed |
| `startDate` | Timestamp | ✅ | Valid timestamp |
| `endDate` | Timestamp | ✅ | Must be > startDate |
| `purchasePrice` | number | ✅ | Integer > 0 (cents) |
| `status` | enum | ✅ | One of: `active`, `expired`, `canceled` |

### Reminders Collection

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| `reminderId` | string | ✅ | Auto-generated |
| `productId` | string | ✅ | Must exist in products |
| `userId` | string | ✅ | Must match product owner |
| `reminderType` | enum | ✅ | One of: `email`, `push`, `sms` |
| `reminderDaysBefore` | number | ✅ | Integer 1-365 |
| `scheduledDate` | Timestamp | ✅ | Must be < warrantyExpirationDate |
| `warrantyExpirationDate` | Timestamp | ✅ | Match product's warrantyEndDate |
| `status` | enum | ✅ | One of: `pending`, `sent`, `failed`, `canceled` |
| `sentAt` | Timestamp\|null | ❌ | Set when status = sent |
| `message` | string | ✅ | 1-500 chars |

### Claims Collection

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| `claimId` | string | ✅ | Auto-generated |
| `productId` | string | ✅ | Must exist in products |
| `userId` | string | ✅ | Must match authenticated user |
| `claimNumber` | string\|null | ❌ | Max 100 chars |
| `claimDate` | Timestamp | ✅ | Valid timestamp |
| `issueDescription` | string | ✅ | 10-5000 chars |
| `claimStatus` | enum | ✅ | One of: `draft`, `submitted`, `in_review`, `approved`, `denied`, `completed`, `canceled` |
| `claimDocuments` | string[] | ✅ | Max 10 URLs |
| `photos` | string[] | ✅ | Max 10 URLs |
| `userNotes` | string\|null | ❌ | Max 2000 chars |
| `adminNotes` | string\|null | ❌ | Max 2000 chars (admin only) |

### Activities Collection

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| `activityId` | string | ✅ | Auto-generated |
| `userId` | string | ✅ | Must exist |
| `activityType` | enum | ✅ | Valid activity type |
| `description` | string | ✅ | 1-500 chars |
| `metadata` | object | ❌ | Max 10 KB serialized |
| `createdAt` | Timestamp | ✅ | Server time |

---

## Enum Values

### Subscription Tiers
```typescript
type SubscriptionTier = "free" | "premium" | "family";
```

### Subscription Status
```typescript
type SubscriptionStatus = "active" | "canceled" | "expired" | "trial";
```

### Warranty Types
```typescript
type WarrantyType = "manufacturer" | "extended" | "store" | "credit_card";
```

### Warranty Status
```typescript
type WarrantyStatus = "active" | "expired" | "claimed" | "archived";
```

### Reminder Types
```typescript
type ReminderType = "email" | "push" | "sms";
```

### Reminder Status
```typescript
type ReminderStatus = "pending" | "sent" | "failed" | "canceled";
```

### Claim Status
```typescript
type ClaimStatus = 
  | "draft" 
  | "submitted" 
  | "in_review" 
  | "approved" 
  | "denied" 
  | "completed" 
  | "canceled";
```

### Activity Types
```typescript
type ActivityType = 
  | "product_added"
  | "product_updated"
  | "product_archived"
  | "claim_created"
  | "claim_updated"
  | "reminder_sent"
  | "warranty_expired"
  | "subscription_changed"
  | "user_login";
```

---

## Timestamp Validation

### Rules
- All timestamps must be Firestore `Timestamp` type
- Valid range: `2020-01-01` to `2050-12-31`
- Always store in **UTC**
- Convert to user timezone only for display

### Special Timestamp Rules

| Field | Rule |
|-------|------|
| `createdAt` | Must equal server time on create, immutable after |
| `updatedAt` | Must equal server time on every write |
| `warrantyEndDate` | Must be after `warrantyStartDate` |
| `purchaseDate` | Must be <= `warrantyStartDate` |
| `scheduledDate` | Must be < `warrantyExpirationDate` |

### Validation Function (TypeScript)
```typescript
function isValidTimestamp(ts: any): boolean {
  if (!(ts instanceof Timestamp)) return false;
  const date = ts.toDate();
  const minDate = new Date('2020-01-01');
  const maxDate = new Date('2050-12-31');
  return date >= minDate && date <= maxDate;
}
```

---

## Currency Validation

### Storage Format
- **Always store in cents (integer)** to avoid floating-point errors
- Example: $99.99 → `9999` cents

### Validation Rules
- Must be non-negative integer
- Maximum: `100000000` (= $1,000,000.00)
- No decimals (already in cents)

### Validation Function
```typescript
function isValidCurrency(cents: number): boolean {
  return Number.isInteger(cents) && 
         cents >= 0 && 
         cents <= 100000000;
}
```

### Display Conversion
```typescript
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Usage: centsToDollars(9999) → "99.99"
```

---

## String Validation

### General Rules
- No leading or trailing whitespace
- No control characters (ASCII 0-31)
- UTF-8 encoding
- Max length enforced per field

### Email Validation
```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_REGEX.test(email);
}
```

### Phone Number Validation (E.164)
```typescript
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

function isValidPhoneNumber(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}
```

### Serial Number Validation
```typescript
const SERIAL_REGEX = /^[A-Z0-9-]+$/;

function isValidSerialNumber(serial: string): boolean {
  return serial.length <= 100 && SERIAL_REGEX.test(serial);
}
```

### URL Validation
```typescript
function isValidURL(url: string, httpsOnly: boolean = true): boolean {
  try {
    const parsed = new URL(url);
    return httpsOnly ? parsed.protocol === 'https:' : true;
  } catch {
    return false;
  }
}
```

---

## Array Validation

### Photos/Documents Arrays
- **Max items**: 10 per array
- **Each item**: Valid Cloud Storage URL
- **Format**: `gs://coverkeep-af231-uploads/{userId}/{productId}/{filename}`
- **No duplicates**

### Validation Function
```typescript
function isValidPhotoArray(photos: string[]): boolean {
  if (!Array.isArray(photos)) return false;
  if (photos.length > 10) return false;
  
  const uniquePhotos = new Set(photos);
  if (uniquePhotos.size !== photos.length) return false; // Duplicates
  
  return photos.every(url => 
    isValidURL(url) && url.startsWith('gs://coverkeep-af231-uploads/')
  );
}
```

### Reminder Days Before Array
- **Max items**: 5
- **Each item**: Integer between 1-365
- **No duplicates**

```typescript
function isValidReminderDays(days: number[]): boolean {
  if (!Array.isArray(days)) return false;
  if (days.length > 5) return false;
  
  const uniqueDays = new Set(days);
  if (uniqueDays.size !== days.length) return false;
  
  return days.every(day => 
    Number.isInteger(day) && day >= 1 && day <= 365
  );
}
```

---

## File Upload Validation

### Storage Path Structure
```
gs://coverkeep-af231-uploads/
  ├── {userId}/
  │   ├── products/
  │   │   └── {productId}/
  │   │       ├── receipts/
  │   │       ├── warranties/
  │   │       ├── manuals/
  │   │       └── photos/
  │   ├── claims/
  │   │   └── {claimId}/
  │   │       ├── documents/
  │   │       └── photos/
  │   └── profile/
  │       └── avatar.jpg
```

### File Type Restrictions

| Category | Allowed Types | Max Size |
|----------|---------------|----------|
| Photos | JPG, PNG, HEIC, WebP | 10 MB |
| Documents | PDF, DOC, DOCX | 25 MB |
| Receipts | PDF, JPG, PNG | 10 MB |
| Profile Photos | JPG, PNG | 2 MB |

### Validation Function
```typescript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

function isValidFileUpload(file: File, category: 'photo' | 'document'): boolean {
  const allowedTypes = category === 'photo' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOC_TYPES;
  const maxSize = category === 'photo' ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
  
  return allowedTypes.includes(file.type) && file.size <= maxSize;
}
```

---

## Business Logic Validation

### Product Limits by Subscription Tier

| Tier | Products Limit | Enforcement |
|------|----------------|-------------|
| Free | 5 | Client + API + Security Rules |
| Premium | 100 | Client + API + Security Rules |
| Family | 500 | Client + API + Security Rules |

**Validation**:
```typescript
async function canAddProduct(userId: string): Promise<boolean> {
  const userDoc = await db.collection('users').doc(userId).get();
  const user = userDoc.data();
  
  return user.productsCount < user.productsLimit;
}
```

### Warranty Date Consistency

**Rule**: `purchaseDate <= warrantyStartDate < warrantyEndDate`

```typescript
function isValidWarrantyDates(
  purchaseDate: Timestamp,
  startDate: Timestamp,
  endDate: Timestamp
): boolean {
  return purchaseDate.toMillis() <= startDate.toMillis() &&
         startDate.toMillis() < endDate.toMillis();
}
```

### Claims Per Warranty Limit

**Rule**: `claimsUsed <= claimsAllowed`

```typescript
async function canCreateClaim(warrantyId: string): Promise<boolean> {
  const warrantyDoc = await db.collection('warranties').doc(warrantyId).get();
  const warranty = warrantyDoc.data();
  
  if (!warranty.claimsAllowed) return true; // Unlimited
  return warranty.claimsUsed < warranty.claimsAllowed;
}
```

### Reminder Scheduling Logic

**Rule**: Schedule reminder `reminderDaysBefore` days before `warrantyEndDate`

```typescript
function calculateReminderDate(
  warrantyEndDate: Timestamp,
  daysBefore: number
): Timestamp {
  const expirationDate = warrantyEndDate.toDate();
  const reminderDate = new Date(expirationDate);
  reminderDate.setDate(reminderDate.getDate() - daysBefore);
  
  return Timestamp.fromDate(reminderDate);
}
```

---

## Client-Side Validation (React)

### Example: Product Form Validation

```typescript
import { z } from 'zod';

const productSchema = z.object({
  productName: z.string().min(1).max(200).trim(),
  brand: z.string().max(100).nullable(),
  model: z.string().max(100).nullable(),
  serialNumber: z.string().regex(/^[A-Z0-9-]+$/).max(100).nullable(),
  warrantyType: z.enum(['manufacturer', 'extended', 'store', 'credit_card']),
  warrantyStartDate: z.date(),
  warrantyEndDate: z.date(),
  purchaseDate: z.date(),
  purchasePrice: z.number().int().min(0).max(100000000).nullable(),
  photos: z.array(z.string().url()).max(10),
}).refine(data => data.warrantyEndDate > data.warrantyStartDate, {
  message: "Warranty end date must be after start date",
  path: ["warrantyEndDate"],
}).refine(data => data.purchaseDate <= data.warrantyStartDate, {
  message: "Purchase date must be before or equal to warranty start date",
  path: ["purchaseDate"],
});

type ProductFormData = z.infer<typeof productSchema>;
```

---

## API Validation (Cloud Functions)

### Example: Validate Product Creation

```typescript
import * as functions from 'firebase-functions';
import { z } from 'zod';

const createProductSchema = z.object({
  productName: z.string().min(1).max(200),
  warrantyType: z.enum(['manufacturer', 'extended', 'store', 'credit_card']),
  warrantyStartDate: z.string().datetime(),
  warrantyEndDate: z.string().datetime(),
  purchaseDate: z.string().datetime(),
  // ... other fields
});

export const createProduct = functions.https.onCall(async (data, context) => {
  // 1. Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  // 2. Validate input
  try {
    createProductSchema.parse(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid product data');
  }
  
  // 3. Check product limit
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  const user = userDoc.data();
  
  if (user.productsCount >= user.productsLimit) {
    throw new functions.https.HttpsError('resource-exhausted', 'Product limit reached');
  }
  
  // 4. Create product
  // ...
});
```

---

## Error Messages

### User-Friendly Validation Messages

| Field | Error Condition | Message |
|-------|----------------|---------|
| `productName` | Empty | "Product name is required" |
| `productName` | Too long | "Product name must be less than 200 characters" |
| `email` | Invalid format | "Please enter a valid email address" |
| `warrantyEndDate` | Before start date | "Warranty end date must be after start date" |
| `purchasePrice` | Negative | "Price cannot be negative" |
| `photos` | Too many | "Maximum 10 photos allowed" |
| `serialNumber` | Invalid chars | "Serial number can only contain letters, numbers, and hyphens" |

---

## Testing Validation

### Unit Tests (Jest)

```typescript
describe('Validation Functions', () => {
  test('isValidEmail accepts valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });
  
  test('isValidEmail rejects invalid email', () => {
    expect(isValidEmail('invalid')).toBe(false);
  });
  
  test('isValidCurrency rejects negative values', () => {
    expect(isValidCurrency(-100)).toBe(false);
  });
  
  test('isValidPhotoArray rejects more than 10 photos', () => {
    const photos = Array(11).fill('https://example.com/photo.jpg');
    expect(isValidPhotoArray(photos)).toBe(false);
  });
});
```

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial validation rules |

---

**Document Owner**: DATABASE-ADMIN Agent  
**Review Cycle**: Weekly during development  
**Next Review**: 2026-02-24
