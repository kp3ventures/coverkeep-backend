# CoverKeep Firestore Database Schema

**Project**: coverkeep-af231  
**Database**: Google Cloud Firestore  
**Version**: 1.0  
**Last Updated**: 2026-02-17

## Table of Contents
1. [Collections Overview](#collections-overview)
2. [Detailed Schema](#detailed-schema)
3. [Relationships](#relationships)
4. [Indexes](#indexes)
5. [Query Patterns](#query-patterns)
6. [Data Types Reference](#data-types-reference)

---

## Collections Overview

```
firestore/
├── users/                          # User accounts and profiles
│   └── {userId}/
│       └── preferences/            # User preferences (subcollection)
│           └── {prefId}
├── products/                       # Warranty-tracked products
│   └── {productId}
├── warranties/                     # Extended warranty details
│   └── {warrantyId}
├── reminders/                      # Warranty expiration alerts
│   └── {reminderId}
├── claims/                         # Warranty claims
│   └── {claimId}
├── activities/                     # Audit log / activity feed
│   └── {activityId}
└── warranty_database/              # Public warranty info (read-only)
    └── {templateId}
```

---

## Detailed Schema

### 1. `users` Collection

**Purpose**: Store user authentication data, profile information, and subscription status.

**Document ID**: `userId` (Firebase Auth UID)

**Schema**:
```typescript
{
  // Identity
  userId: string;                    // Firebase Auth UID (matches document ID)
  email: string;                     // User email (indexed)
  displayName: string | null;        // User display name
  photoURL: string | null;           // Profile photo URL
  phoneNumber: string | null;        // Optional phone for SMS reminders
  
  // Subscription
  subscriptionTier: "free" | "premium" | "family";  // User plan
  subscriptionStatus: "active" | "canceled" | "expired" | "trial";
  subscriptionStartDate: Timestamp | null;
  subscriptionEndDate: Timestamp | null;
  trialEndDate: Timestamp | null;
  stripeCustomerId: string | null;
  
  // Limits (enforced by tier)
  productsCount: number;             // Current product count
  productsLimit: number;             // Max products (5 free, 100 premium, 500 family)
  
  // Preferences
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  reminderDaysBefore: number[];      // Default: [30, 14, 7, 1]
  timezone: string;                  // IANA timezone (e.g., "America/Los_Angeles")
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp;
  isDeleted: boolean;                // Soft delete flag
  deletedAt: Timestamp | null;
}
```

**Indexes**:
- Single-field: `email` (ascending)
- Single-field: `subscriptionTier` (ascending)
- Single-field: `isDeleted` (ascending)

**Subcollection**: `users/{userId}/preferences/{prefId}`
```typescript
{
  prefId: string;
  category: string;                  // "notifications", "ui", "data"
  key: string;
  value: any;
  updatedAt: Timestamp;
}
```

---

### 2. `products` Collection

**Purpose**: Store all warranty-tracked products owned by users.

**Document ID**: Auto-generated Firestore ID

**Schema**:
```typescript
{
  // Ownership
  productId: string;                 // Document ID
  userId: string;                    // Owner (indexed)
  
  // Product Information
  productName: string;               // User-defined or AI-detected
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  category: string | null;           // Electronics, Appliance, Vehicle, etc.
  
  // Warranty Details
  warrantyType: "manufacturer" | "extended" | "store" | "credit_card";
  warrantyProvider: string | null;   // Manufacturer or warranty company
  warrantyStartDate: Timestamp;
  warrantyEndDate: Timestamp;        // CRITICAL for reminders
  warrantyDurationMonths: number;
  warrantyStatus: "active" | "expired" | "claimed" | "archived";
  
  // Purchase Information
  purchaseDate: Timestamp;
  purchasePrice: number | null;      // In cents (USD)
  purchaseLocation: string | null;   // Store name or URL
  purchaseReceiptURL: string | null; // Cloud Storage URL
  
  // Documentation
  warrantyDocumentURL: string | null; // Cloud Storage URL
  manualURL: string | null;
  proofOfPurchaseURL: string | null;
  photos: string[];                  // Array of Cloud Storage URLs
  
  // AI-Detected Data
  aiDetected: boolean;               // Was product identified by AI?
  aiConfidence: number | null;       // 0.0 - 1.0
  aiWarrantyTemplateId: string | null; // Reference to warranty_database
  
  // Notes
  notes: string | null;              // User notes
  
  // Status
  isArchived: boolean;               // Soft delete / archive
  archivedAt: Timestamp | null;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes**:
- Composite: `userId` (asc) + `warrantyEndDate` (asc)
- Composite: `userId` (asc) + `warrantyStatus` (asc)
- Composite: `userId` (asc) + `isArchived` (asc) + `warrantyEndDate` (asc)
- Single-field: `warrantyEndDate` (asc) - for admin reminder scheduling

---

### 3. `warranties` Collection

**Purpose**: Detailed extended warranty information (separate from products for flexibility).

**Document ID**: Auto-generated Firestore ID

**Schema**:
```typescript
{
  // Identity
  warrantyId: string;                // Document ID
  productId: string;                 // Reference to products collection
  userId: string;                    // Owner
  
  // Extended Warranty Details
  warrantyProvider: string;          // Company name
  warrantyPolicyNumber: string;
  warrantyType: "extended" | "service_plan" | "protection_plan";
  
  // Coverage
  coverageDetails: string;           // What's covered
  deductible: number | null;         // In cents
  maxClaimAmount: number | null;     // In cents
  claimsAllowed: number | null;      // Max number of claims
  claimsUsed: number;                // Current claims filed
  
  // Terms
  startDate: Timestamp;
  endDate: Timestamp;
  renewalDate: Timestamp | null;
  autoRenew: boolean;
  
  // Cost
  purchasePrice: number;             // In cents
  monthlyPrice: number | null;       // If subscription-based
  
  // Contact
  providerPhone: string | null;
  providerEmail: string | null;
  providerWebsite: string | null;
  claimURL: string | null;
  
  // Documents
  policyDocumentURL: string | null;
  termsDocumentURL: string | null;
  
  // Status
  status: "active" | "expired" | "canceled";
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes**:
- Composite: `userId` (asc) + `status` (asc)
- Single-field: `productId` (asc)

---

### 4. `reminders` Collection

**Purpose**: Track warranty expiration reminders (scheduled and sent).

**Document ID**: Auto-generated Firestore ID

**Schema**:
```typescript
{
  // Identity
  reminderId: string;                // Document ID
  productId: string;                 // Reference to product
  userId: string;                    // Recipient
  
  // Reminder Configuration
  reminderType: "email" | "push" | "sms";
  reminderDaysBefore: number;        // Days before expiration
  scheduledDate: Timestamp;          // When to send
  warrantyExpirationDate: Timestamp; // Product's warranty end date
  
  // Status
  status: "pending" | "sent" | "failed" | "canceled";
  sentAt: Timestamp | null;
  failedAt: Timestamp | null;
  failureReason: string | null;
  
  // Content
  subject: string | null;
  message: string;
  
  // Delivery
  recipientEmail: string | null;
  recipientPhone: string | null;
  pushToken: string | null;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes**:
- Composite: `productId` (asc) + `reminderType` (asc) + `sentAt` (asc)
- Composite: `userId` (asc) + `status` (asc)
- Composite: `status` (asc) + `scheduledDate` (asc) - for admin cron job

---

### 5. `claims` Collection

**Purpose**: Track warranty claims filed by users.

**Document ID**: Auto-generated Firestore ID

**Schema**:
```typescript
{
  // Identity
  claimId: string;                   // Document ID
  productId: string;                 // Reference to product
  userId: string;                    // Claimant
  warrantyId: string | null;         // If extended warranty
  
  // Claim Information
  claimNumber: string | null;        // From warranty provider
  claimDate: Timestamp;
  issueDescription: string;
  issueCategory: string | null;      // "malfunction", "damage", "defect", etc.
  
  // Status Tracking
  claimStatus: "draft" | "submitted" | "in_review" | "approved" | "denied" | "completed" | "canceled";
  statusUpdatedAt: Timestamp;
  
  // Submission Details
  submittedAt: Timestamp | null;
  submittedVia: "online" | "phone" | "email" | "mail" | null;
  
  // Resolution
  approvedAt: Timestamp | null;
  deniedAt: Timestamp | null;
  denialReason: string | null;
  completedAt: Timestamp | null;
  resolutionType: "repair" | "replacement" | "refund" | null;
  resolutionAmount: number | null;   // In cents
  
  // Documentation
  claimDocuments: string[];          // Array of Cloud Storage URLs
  photos: string[];                  // Damage/issue photos
  
  // Contact
  claimRepName: string | null;
  claimRepEmail: string | null;
  claimRepPhone: string | null;
  
  // Notes
  userNotes: string | null;
  adminNotes: string | null;         // Premium feature
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes**:
- Composite: `userId` (asc) + `claimStatus` (asc) + `claimDate` (desc)
- Composite: `productId` (asc) + `claimStatus` (asc)
- Single-field: `claimStatus` (asc)

---

### 6. `activities` Collection

**Purpose**: Audit log and activity feed for user actions.

**Document ID**: Auto-generated Firestore ID

**Schema**:
```typescript
{
  // Identity
  activityId: string;                // Document ID
  userId: string;                    // Actor
  
  // Activity Details
  activityType: "product_added" | "product_updated" | "product_archived" | 
                "claim_created" | "claim_updated" | "reminder_sent" | 
                "warranty_expired" | "subscription_changed" | "user_login";
  
  // References
  productId: string | null;
  claimId: string | null;
  reminderId: string | null;
  
  // Details
  description: string;               // Human-readable summary
  metadata: {[key: string]: any};    // Flexible JSON data
  
  // Context
  ipAddress: string | null;
  userAgent: string | null;
  
  // Metadata
  createdAt: Timestamp;
}
```

**Indexes**:
- Composite: `userId` (asc) + `createdAt` (desc)
- Composite: `activityType` (asc) + `createdAt` (desc)
- Single-field: `productId` (asc)

**Retention**: Auto-delete activities older than 90 days (free) / 365 days (premium)

---

### 7. `warranty_database` Collection

**Purpose**: Public warranty templates for AI-detected products (read-only for users).

**Document ID**: Auto-generated Firestore ID

**Schema**:
```typescript
{
  // Identity
  templateId: string;                // Document ID
  
  // Product Information
  brand: string;
  productName: string;
  model: string | null;
  category: string;
  
  // Warranty Defaults
  defaultWarrantyMonths: number;
  warrantyProvider: string;
  warrantyType: "manufacturer" | "limited";
  
  // Coverage
  coverageDescription: string;
  exclusions: string | null;
  
  // Contact
  supportPhone: string | null;
  supportEmail: string | null;
  supportWebsite: string | null;
  warrantyRegistrationURL: string | null;
  
  // Documentation
  warrantyDocumentURL: string | null;
  termsURL: string | null;
  
  // Admin Only
  isActive: boolean;
  verifiedBy: string | null;         // Admin who verified
  verifiedAt: Timestamp | null;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes**:
- Composite: `brand` (asc) + `productName` (asc)
- Single-field: `category` (asc)
- Single-field: `isActive` (asc)

**Access**: Read-only for authenticated users, write-only for admins

---

## Relationships

### Entity Relationship Diagram (ASCII)

```
┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────┐      1:1       ┌──────────────┐
│  products   │◄────────────────┤  warranties  │
└──────┬──────┘                 └──────────────┘
       │
       ├──────────┐
       │          │
       │ 1:N      │ 1:N
       │          │
┌──────▼──────┐   │      ┌──────▼──────┐
│  reminders  │   │      │   claims    │
└─────────────┘   │      └─────────────┘
                  │
                  │ 1:N
                  │
           ┌──────▼──────┐
           │ activities  │
           └─────────────┘

┌─────────────────────┐
│ warranty_database   │ (Public, AI reference)
└─────────────────────┘
```

### Reference Fields

- **products.userId** → `users/{userId}`
- **products.aiWarrantyTemplateId** → `warranty_database/{templateId}`
- **warranties.productId** → `products/{productId}`
- **warranties.userId** → `users/{userId}`
- **reminders.productId** → `products/{productId}`
- **reminders.userId** → `users/{userId}`
- **claims.productId** → `products/{productId}`
- **claims.userId** → `users/{userId}`
- **claims.warrantyId** → `warranties/{warrantyId}`
- **activities.userId** → `users/{userId}`
- **activities.productId** → `products/{productId}`
- **activities.claimId** → `claims/{claimId}`

---

## Indexes

### Required Composite Indexes

1. **products**: `userId` (asc) + `warrantyEndDate` (asc)
   - Query: User's products sorted by expiration date
   
2. **products**: `userId` (asc) + `isArchived` (asc) + `warrantyEndDate` (asc)
   - Query: User's active products sorted by expiration
   
3. **reminders**: `status` (asc) + `scheduledDate` (asc)
   - Query: Pending reminders to send (admin cron)
   
4. **reminders**: `productId` (asc) + `reminderType` (asc) + `sentAt` (asc)
   - Query: Reminders for a product by type and status
   
5. **claims**: `userId` (asc) + `claimStatus` (asc) + `claimDate` (desc)
   - Query: User's claims filtered by status, newest first
   
6. **activities**: `userId` (asc) + `createdAt` (desc)
   - Query: User's activity feed (newest first)

See `firestore.indexes.json` for full configuration.

---

## Query Patterns

### Common Queries

#### 1. Get User's Active Products (Expiring Soon)
```javascript
db.collection('products')
  .where('userId', '==', userId)
  .where('isArchived', '==', false)
  .where('warrantyStatus', '==', 'active')
  .orderBy('warrantyEndDate', 'asc')
  .limit(10);
```

#### 2. Get Products Expiring in Next 30 Days (Admin Cron)
```javascript
const now = admin.firestore.Timestamp.now();
const thirtyDaysFromNow = new Date();
thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

db.collection('products')
  .where('warrantyEndDate', '>=', now)
  .where('warrantyEndDate', '<=', admin.firestore.Timestamp.fromDate(thirtyDaysFromNow))
  .where('warrantyStatus', '==', 'active');
```

#### 3. Get Pending Reminders to Send (Cron Job)
```javascript
db.collection('reminders')
  .where('status', '==', 'pending')
  .where('scheduledDate', '<=', admin.firestore.Timestamp.now())
  .limit(100);
```

#### 4. Get User's Claims by Status
```javascript
db.collection('claims')
  .where('userId', '==', userId)
  .where('claimStatus', '==', 'in_review')
  .orderBy('claimDate', 'desc');
```

#### 5. Get Recent User Activity
```javascript
db.collection('activities')
  .where('userId', '==', userId)
  .orderBy('createdAt', 'desc')
  .limit(20);
```

#### 6. Find Warranty Template by Brand + Product
```javascript
db.collection('warranty_database')
  .where('brand', '==', 'Apple')
  .where('productName', '==', 'iPhone 15')
  .where('isActive', '==', true)
  .limit(1);
```

---

## Data Types Reference

### Firestore Types Used

| Type | Description | Example |
|------|-------------|---------|
| `string` | UTF-8 text | `"iPhone 15 Pro"` |
| `number` | 64-bit floating point | `599.99` or `59999` (cents) |
| `boolean` | True/false | `true` |
| `Timestamp` | Date/time | `Timestamp(1708214400, 0)` |
| `GeoPoint` | Lat/lng | `GeoPoint(37.7749, -122.4194)` |
| `array` | Ordered list | `["photo1.jpg", "photo2.jpg"]` |
| `map` | Key-value object | `{key: "value"}` |
| `reference` | Document reference | `DocumentReference` |
| `null` | Null value | `null` |

### Custom Enums (Validated in Security Rules)

```typescript
// Subscription tiers
type SubscriptionTier = "free" | "premium" | "family";

// Warranty types
type WarrantyType = "manufacturer" | "extended" | "store" | "credit_card";

// Warranty status
type WarrantyStatus = "active" | "expired" | "claimed" | "archived";

// Reminder types
type ReminderType = "email" | "push" | "sms";

// Reminder status
type ReminderStatus = "pending" | "sent" | "failed" | "canceled";

// Claim status
type ClaimStatus = "draft" | "submitted" | "in_review" | "approved" | "denied" | "completed" | "canceled";

// Activity types
type ActivityType = "product_added" | "product_updated" | "product_archived" | 
                    "claim_created" | "claim_updated" | "reminder_sent" | 
                    "warranty_expired" | "subscription_changed" | "user_login";
```

### Date/Time Handling

- **All timestamps**: Store as Firestore `Timestamp` (UTC)
- **User timezone**: Store in `users.timezone` (IANA format)
- **Display**: Convert to user timezone in frontend
- **Queries**: Always use UTC for consistency

### Currency Handling

- **Storage**: Store all prices in **cents (integer)** to avoid floating-point errors
- **Example**: `$99.99` → `9999` (cents)
- **Display**: Convert to dollars in frontend: `amount / 100`

---

## Performance Considerations

### Denormalization Strategy

**Duplicated Fields (for query efficiency)**:
- `reminders.userId` - Duplicated from product to avoid joins
- `reminders.warrantyExpirationDate` - Duplicated to enable direct reminder queries
- `claims.userId` - Duplicated from product for user claim queries
- `activities.productId` - Duplicated for product-level activity logs

### Subcollections vs Top-Level Collections

**Top-level collections** (used for):
- `products`, `reminders`, `claims`, `activities` - Need cross-user queries (admin operations)

**Subcollections** (used for):
- `users/{userId}/preferences` - User-specific, no cross-user queries needed

### Collection Group Queries

Not used in v1. If needed in future:
- Enable collection group indexes for subcollections
- Useful for querying all user preferences across users (admin analytics)

---

## Migration & Seeding

### Initial Data Seeding

1. **warranty_database**: Seed with top 100 product templates
   - Apple (iPhone, MacBook, AirPods)
   - Samsung (Galaxy, TVs, appliances)
   - LG, Sony, Whirlpool, etc.

2. **Test users**: Create 3 test accounts (free, premium, family)

3. **Sample products**: Add 2-3 products per test user

### Future Migrations

- **v1 → v2**: If schema changes, use Firebase Functions to batch-migrate
- **Backup strategy**: Daily Firestore exports to Cloud Storage
- **Rollback plan**: Keep backups for 30 days

---

## Backup & Recovery

### Automated Backups

**Schedule**: Daily at 2:00 AM UTC

**Method**: Firestore Managed Export
```bash
gcloud firestore export gs://coverkeep-af231-backups/$(date +%Y-%m-%d)
```

**Retention**:
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months

### Disaster Recovery

**Recovery Time Objective (RTO)**: 4 hours  
**Recovery Point Objective (RPO)**: 24 hours

**Restore Process**:
```bash
gcloud firestore import gs://coverkeep-af231-backups/2026-02-17
```

---

## Appendix: Scaling Considerations

### Current Limits (Firestore)

- **Writes**: 10,000/second per database
- **Document size**: 1 MB max
- **Collection depth**: 100 levels
- **Subcollections**: Unlimited

### Scaling Plan (10K+ Users)

**Phase 1 (0-1K users)**: Current schema sufficient

**Phase 2 (1K-10K users)**:
- Enable caching (Firebase Hosting CDN)
- Optimize reminder cron job (batch processing)
- Add composite indexes as query patterns emerge

**Phase 3 (10K-100K users)**:
- Consider sharding reminders collection by date
- Implement pagination for all list queries
- Add read replicas via Firestore multi-region
- Archive old activities (move to Cloud Storage after 1 year)

**Phase 4 (100K+ users)**:
- Evaluate migrating cold data (old claims, archived products) to BigQuery
- Implement data partitioning by userId hash
- Consider Firestore pricing optimization (bundled reads)

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial schema design |

---

**Document Owner**: DATABASE-ADMIN Agent  
**Review Cycle**: Weekly during sprint, monthly post-launch  
**Next Review**: 2026-02-24
