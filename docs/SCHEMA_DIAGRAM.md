# CoverKeep Database Schema Diagram

**Project**: coverkeep-af231  
**Version**: 1.0  
**Last Updated**: 2026-02-17

---

## Full Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          COVERKEEP DATABASE SCHEMA                           │
│                        Firebase Firestore (NoSQL)                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                  USERS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK: userId (string)                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ • email                         (string, indexed)                            │
│ • displayName                   (string | null)                              │
│ • photoURL                      (string | null)                              │
│ • phoneNumber                   (string | null)                              │
│ • subscriptionTier              (enum: free|premium|family, indexed)         │
│ • subscriptionStatus            (enum: active|canceled|expired|trial)        │
│ • subscriptionStartDate         (Timestamp | null)                           │
│ • subscriptionEndDate           (Timestamp | null)                           │
│ • productsCount                 (number)                                     │
│ • productsLimit                 (number)                                     │
│ • notificationsEnabled          (boolean)                                    │
│ • emailNotifications            (boolean)                                    │
│ • pushNotifications             (boolean)                                    │
│ • reminderDaysBefore            (number[])                                   │
│ • timezone                      (string, IANA)                               │
│ • isDeleted                     (boolean, indexed)                           │
│ • deletedAt                     (Timestamp | null)                           │
│ • createdAt                     (Timestamp)                                  │
│ • updatedAt                     (Timestamp)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1:N (owns)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                PRODUCTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK: productId (string, auto)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ FK: userId                      (→ users.userId, indexed)                    │
│ FK: aiWarrantyTemplateId        (→ warranty_database.templateId, nullable)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ • productName                   (string, 1-200 chars)                        │
│ • brand                         (string | null)                              │
│ • model                         (string | null)                              │
│ • serialNumber                  (string | null)                              │
│ • category                      (string | null)                              │
│ • warrantyType                  (enum: manufacturer|extended|store|cc)       │
│ • warrantyProvider              (string | null)                              │
│ • warrantyStartDate             (Timestamp, indexed)                         │
│ • warrantyEndDate               (Timestamp, indexed)                         │
│ • warrantyDurationMonths        (number)                                     │
│ • warrantyStatus                (enum: active|expired|claimed|archived)      │
│ • purchaseDate                  (Timestamp)                                  │
│ • purchasePrice                 (number | null, in cents)                    │
│ • purchaseLocation              (string | null)                              │
│ • purchaseReceiptURL            (string | null, Cloud Storage)               │
│ • warrantyDocumentURL           (string | null, Cloud Storage)               │
│ • manualURL                     (string | null)                              │
│ • proofOfPurchaseURL            (string | null, Cloud Storage)               │
│ • photos                        (string[], Cloud Storage URLs, max 10)       │
│ • aiDetected                    (boolean)                                    │
│ • aiConfidence                  (number | null, 0.0-1.0)                     │
│ • notes                         (string | null, max 2000 chars)              │
│ • isArchived                    (boolean, indexed)                           │
│ • archivedAt                    (Timestamp | null)                           │
│ • createdAt                     (Timestamp)                                  │
│ • updatedAt                     (Timestamp)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                │                           │
                │                           │ 0..1:1 (optional extended warranty)
                │                           │
                │                           ▼
                │         ┌─────────────────────────────────────────────────────┐
                │         │              WARRANTIES                             │
                │         ├─────────────────────────────────────────────────────┤
                │         │ PK: warrantyId (string, auto)                       │
                │         ├─────────────────────────────────────────────────────┤
                │         │ FK: productId      (→ products.productId, indexed)  │
                │         │ FK: userId         (→ users.userId, indexed)        │
                │         ├─────────────────────────────────────────────────────┤
                │         │ • warrantyProvider        (string)                  │
                │         │ • warrantyPolicyNumber    (string)                  │
                │         │ • warrantyType            (enum: extended|service)  │
                │         │ • coverageDetails         (string, max 5000)        │
                │         │ • deductible              (number | null, cents)    │
                │         │ • maxClaimAmount          (number | null, cents)    │
                │         │ • claimsAllowed           (number | null)           │
                │         │ • claimsUsed              (number)                  │
                │         │ • startDate               (Timestamp)               │
                │         │ • endDate                 (Timestamp, indexed)      │
                │         │ • renewalDate             (Timestamp | null)        │
                │         │ • autoRenew               (boolean)                 │
                │         │ • purchasePrice           (number, cents)           │
                │         │ • monthlyPrice            (number | null, cents)    │
                │         │ • providerPhone           (string | null)           │
                │         │ • providerEmail           (string | null)           │
                │         │ • providerWebsite         (string | null)           │
                │         │ • claimURL                (string | null)           │
                │         │ • policyDocumentURL       (string | null)           │
                │         │ • termsDocumentURL        (string | null)           │
                │         │ • status                  (enum: active|expired|canceled) │
                │         │ • createdAt               (Timestamp)               │
                │         │ • updatedAt               (Timestamp)               │
                │         └─────────────────────────────────────────────────────┘
                │
                ├──────────────────────┐
                │                      │
                │ 1:N (has reminders)  │ 1:N (has claims)
                │                      │
                ▼                      ▼
┌───────────────────────────────┐  ┌────────────────────────────────────────────┐
│        REMINDERS              │  │              CLAIMS                        │
├───────────────────────────────┤  ├────────────────────────────────────────────┤
│ PK: reminderId (string, auto) │  │ PK: claimId (string, auto)                 │
├───────────────────────────────┤  ├────────────────────────────────────────────┤
│ FK: productId  (→ products)   │  │ FK: productId   (→ products.productId)     │
│ FK: userId     (→ users)      │  │ FK: userId      (→ users.userId, indexed)  │
├───────────────────────────────┤  │ FK: warrantyId  (→ warranties, nullable)   │
│ • reminderType                │  ├────────────────────────────────────────────┤
│   (enum: email|push|sms)      │  │ • claimNumber           (string | null)    │
│ • reminderDaysBefore (number) │  │ • claimDate             (Timestamp)        │
│ • scheduledDate    (Timestamp)│  │ • issueDescription      (string, 10-5000)  │
│ • warrantyExpirationDate      │  │ • issueCategory         (string | null)    │
│   (Timestamp, denormalized)   │  │ • claimStatus           (enum, indexed)    │
│ • status                      │  │   (draft|submitted|in_review|approved|     │
│   (enum: pending|sent|failed| │  │    denied|completed|canceled)              │
│    canceled, indexed)         │  │ • statusUpdatedAt       (Timestamp)        │
│ • sentAt      (Timestamp|null)│  │ • submittedAt           (Timestamp | null) │
│ • failedAt    (Timestamp|null)│  │ • submittedVia          (string | null)    │
│ • failureReason (string|null) │  │ • approvedAt            (Timestamp | null) │
│ • subject     (string | null) │  │ • deniedAt              (Timestamp | null) │
│ • message            (string) │  │ • denialReason          (string | null)    │
│ • recipientEmail     (string) │  │ • completedAt           (Timestamp | null) │
│ • recipientPhone     (string) │  │ • resolutionType        (enum | null)      │
│ • pushToken          (string) │  │   (repair|replacement|refund)              │
│ • createdAt       (Timestamp) │  │ • resolutionAmount      (number | null)    │
│ • updatedAt       (Timestamp) │  │ • claimDocuments        (string[], max 10) │
└───────────────────────────────┘  │ • photos                (string[], max 10) │
                                   │ • claimRepName          (string | null)    │
                                   │ • claimRepEmail         (string | null)    │
                                   │ • claimRepPhone         (string | null)    │
                                   │ • userNotes             (string | null)    │
                                   │ • adminNotes            (string | null)    │
                                   │ • createdAt             (Timestamp)        │
                                   │ • updatedAt             (Timestamp)        │
                                   └────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                               ACTIVITIES                                     │
│                          (Audit Log / Activity Feed)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK: activityId (string, auto)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ FK: userId        (→ users.userId, indexed)                                  │
│ FK: productId     (→ products.productId, nullable, indexed)                  │
│ FK: claimId       (→ claims.claimId, nullable)                               │
│ FK: reminderId    (→ reminders.reminderId, nullable)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ • activityType    (enum: product_added|product_updated|product_archived|     │
│                    claim_created|claim_updated|reminder_sent|                │
│                    warranty_expired|subscription_changed|user_login)         │
│ • description     (string, human-readable summary)                           │
│ • metadata        (object, flexible JSON)                                    │
│ • ipAddress       (string | null)                                            │
│ • userAgent       (string | null)                                            │
│ • createdAt       (Timestamp, indexed DESC)                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         WARRANTY_DATABASE                                    │
│                  (Public Read-Only Warranty Templates)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK: templateId (string, auto)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ • brand                      (string, indexed)                               │
│ • productName                (string, indexed)                               │
│ • model                      (string | null)                                 │
│ • category                   (string, indexed)                               │
│ • defaultWarrantyMonths      (number)                                        │
│ • warrantyProvider           (string)                                        │
│ • warrantyType               (enum: manufacturer|limited)                    │
│ • coverageDescription        (string)                                        │
│ • exclusions                 (string | null)                                 │
│ • supportPhone               (string | null)                                 │
│ • supportEmail               (string | null)                                 │
│ • supportWebsite             (string | null)                                 │
│ • warrantyRegistrationURL    (string | null)                                 │
│ • warrantyDocumentURL        (string | null)                                 │
│ • termsURL                   (string | null)                                 │
│ • isActive                   (boolean, indexed)                              │
│ • verifiedBy                 (string | null, admin userId)                   │
│ • verifiedAt                 (Timestamp | null)                              │
│ • createdAt                  (Timestamp)                                     │
│ • updatedAt                  (Timestamp)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Simplified View (Core Collections Only)

```
     ┌─────────┐
     │  USERS  │
     └────┬────┘
          │
          │ owns (1:N)
          │
     ┌────▼────────┐
     │  PRODUCTS   │────────┐
     └────┬────────┘        │
          │                 │ has extended (0..1:1)
          │                 │
          ├─────────────────┘
          │                 ▼
          │            ┌──────────┐
          │            │WARRANTIES│
          │            └──────────┘
          │
          ├────────────┬─────────────┐
          │            │             │
          │ has        │ has         │ has
          │ reminders  │ claims      │ activities
          │ (1:N)      │ (1:N)       │ (1:N)
          │            │             │
     ┌────▼────┐  ┌────▼────┐  ┌────▼──────┐
     │REMINDERS│  │ CLAIMS  │  │ACTIVITIES │
     └─────────┘  └─────────┘  └───────────┘
```

---

## Indexes Visualization

### Products Collection Indexes

```
INDEX 1: userId + warrantyEndDate (ASC)
┌──────────┬────────────────────┐
│  userId  │ warrantyEndDate    │
├──────────┼────────────────────┤
│ user123  │ 2026-03-01         │
│ user123  │ 2026-06-15         │
│ user123  │ 2027-01-10         │
│ user456  │ 2026-02-20         │
│ user456  │ 2026-12-31         │
└──────────┴────────────────────┘
Query: Get user's products sorted by expiration

INDEX 2: userId + isArchived + warrantyEndDate
┌──────────┬────────────┬────────────────────┐
│  userId  │ isArchived │ warrantyEndDate    │
├──────────┼────────────┼────────────────────┤
│ user123  │ false      │ 2026-03-01         │
│ user123  │ false      │ 2026-06-15         │
│ user123  │ true       │ 2025-01-01         │
└──────────┴────────────┴────────────────────┘
Query: Get user's active products only
```

### Reminders Collection Indexes

```
INDEX 3: status + scheduledDate (ASC)
┌──────────┬────────────────────┐
│  status  │  scheduledDate     │
├──────────┼────────────────────┤
│ pending  │ 2026-02-18 09:00   │
│ pending  │ 2026-02-19 10:30   │
│ pending  │ 2026-02-20 15:00   │
│ sent     │ 2026-02-17 08:00   │
└──────────┴────────────────────┘
Query: Get pending reminders to send (cron job)

INDEX 4: productId + reminderType + sentAt
┌────────────┬──────────────┬─────────────────┐
│ productId  │ reminderType │    sentAt       │
├────────────┼──────────────┼─────────────────┤
│ prod123    │ email        │ 2026-02-15      │
│ prod123    │ push         │ 2026-02-15      │
│ prod123    │ sms          │ null (pending)  │
└────────────┴──────────────┴─────────────────┘
Query: Check which reminders sent for a product
```

### Claims Collection Indexes

```
INDEX 5: userId + claimStatus + claimDate (DESC)
┌──────────┬──────────────┬─────────────────┐
│  userId  │ claimStatus  │   claimDate     │
├──────────┼──────────────┼─────────────────┤
│ user123  │ in_review    │ 2026-02-15      │
│ user123  │ in_review    │ 2026-01-20      │
│ user123  │ approved     │ 2025-12-01      │
│ user123  │ completed    │ 2025-11-15      │
└──────────┴──────────────┴─────────────────┘
Query: Get user's claims by status, newest first
```

---

## Data Flow Diagram

```
┌─────────────┐
│   CLIENT    │
│  (React)    │
└──────┬──────┘
       │
       │ API Calls (Firebase SDK or Cloud Functions)
       │
       ▼
┌──────────────────────────────────────────────┐
│         FIREBASE AUTHENTICATION              │
│  - Login / Signup                            │
│  - JWT Token Generation                      │
│  - Custom Claims (subscriptionTier, admin)   │
└──────────────┬───────────────────────────────┘
               │
               │ Authenticated User ID
               │
               ▼
┌──────────────────────────────────────────────┐
│         FIRESTORE SECURITY RULES             │
│  - Validate user identity (auth.uid)         │
│  - Check subscription tier for premium ops   │
│  - Enforce data ownership (userId checks)    │
│  - Validate enum values & data types         │
└──────────────┬───────────────────────────────┘
               │
               │ Authorized Request
               │
               ▼
┌──────────────────────────────────────────────┐
│              FIRESTORE DATABASE              │
│  - users                                     │
│  - products                                  │
│  - warranties                                │
│  - reminders                                 │
│  - claims                                    │
│  - activities                                │
│  - warranty_database                         │
└──────────────┬───────────────────────────────┘
               │
               │ Triggers (onWrite, onCreate, onUpdate)
               │
               ▼
┌──────────────────────────────────────────────┐
│          CLOUD FUNCTIONS                     │
│  - onProductCreate → schedule reminders      │
│  - onProductUpdate → update reminders        │
│  - onReminderScheduled → send notification   │
│  - onUserDelete → cleanup user data          │
│  - Cron: cleanupOldActivities (daily)        │
│  - Cron: sendPendingReminders (hourly)       │
└──────────────┬───────────────────────────────┘
               │
               ├────────────────┬─────────────────┐
               │                │                 │
               ▼                ▼                 ▼
     ┌─────────────────┐  ┌──────────┐  ┌────────────────┐
     │ CLOUD STORAGE   │  │  EMAIL   │  │  PUSH NOTIFS   │
     │ (photos, docs)  │  │ (SendGrid)│  │   (FCM)        │
     └─────────────────┘  └──────────┘  └────────────────┘
```

---

## Collection Size Estimates (1000 Active Users)

```
Collection        Docs/User    Total Docs    Avg Doc Size    Total Storage
────────────────────────────────────────────────────────────────────────────
users                 1           1,000          2 KB             2 MB
products             10          10,000          3 KB            30 MB
warranties            2           2,000          4 KB             8 MB
reminders            30          30,000          1 KB            30 MB
claims                5           5,000          5 KB            25 MB
activities          100         100,000        0.5 KB           50 MB
warranty_database     -           1,000          2 KB             2 MB
────────────────────────────────────────────────────────────────────────────
TOTAL                           149,000                         147 MB
```

**Scaling to 10K users**: ~1.5 GB (well within free tier)  
**Scaling to 100K users**: ~15 GB (~$2.70/month storage cost)

---

## Query Complexity Matrix

| Query | Collections | Indexes Required | Est. Latency | Cost (reads) |
|-------|-------------|------------------|--------------|--------------|
| Get user's products | 1 (products) | userId + warrantyEndDate | <100ms | 10-50 |
| Get product details | 1 (products) | None (direct get) | <50ms | 1 |
| Get claims by user | 1 (claims) | userId + claimStatus + claimDate | <150ms | 5-20 |
| Get pending reminders | 1 (reminders) | status + scheduledDate | <200ms | 100-500 |
| Get user activity feed | 1 (activities) | userId + createdAt | <100ms | 20-50 |
| Dashboard summary | 3 (products, claims, reminders) | Multiple | <500ms | 50-100 |

---

## Schema Evolution Plan

### v1.0 (Launch) - Current Schema
- Basic collections: users, products, warranties, reminders, claims, activities
- Core indexes for common queries
- Soft delete support

### v1.1 (Post-Launch Optimization)
- Add `categories` collection (if needed for filtering)
- Add `notifications` collection (push notification history)
- Optimize indexes based on real query patterns

### v2.0 (Family Plan Features)
- Add `families` collection (family groups)
- Add `family_members` subcollection
- Add `shared_products` collection (products shared within family)

### v3.0 (AI Enhancements)
- Add `ai_training_data` collection (user feedback on AI detection)
- Add `warranty_suggestions` collection (AI-suggested warranty info)
- Expand `warranty_database` with community contributions

---

**Document Owner**: DATABASE-ADMIN Agent  
**Created**: 2026-02-17  
**Last Updated**: 2026-02-17
