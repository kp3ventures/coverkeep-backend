# CoverKeep Data Retention & Cleanup Strategy

**Project**: coverkeep-af231  
**Version**: 1.0  
**Last Updated**: 2026-02-17

## Table of Contents

1. [Retention Policies](#retention-policies)
2. [Soft Delete Strategy](#soft-delete-strategy)
3. [Automated Cleanup Jobs](#automated-cleanup-jobs)
4. [Data Archival](#data-archival)
5. [GDPR & CCPA Compliance](#gdpr--ccpa-compliance)
6. [User Data Export](#user-data-export)
7. [User Data Deletion](#user-data-deletion)

---

## Retention Policies

### Overview

| Data Type | Retention Period | Cleanup Method | Compliance |
|-----------|------------------|----------------|------------|
| Active products | Indefinite | User-controlled | N/A |
| Archived products | 2 years | Auto-archive to Cloud Storage | CCPA |
| Active claims | Indefinite | User-controlled | N/A |
| Completed claims | 2 years | Auto-archive to Cloud Storage | Legal requirement |
| Reminders (pending) | Until sent | Auto-delete after send | N/A |
| Reminders (sent) | 30 days | Auto-delete | Cost optimization |
| Activities (free users) | 90 days | Auto-delete | Cost optimization |
| Activities (premium) | 365 days | Auto-delete | Premium feature |
| User accounts | Indefinite | User-controlled deletion | GDPR/CCPA |
| Deleted user data | 30 days | Hard delete | GDPR "right to erasure" |

---

## Soft Delete Strategy

### Why Soft Delete?

- **Accidental deletion recovery** - Users can restore within 30 days
- **Data integrity** - Prevent orphaned references
- **Compliance** - Allow time for legal holds
- **Analytics** - Understand deletion patterns

### Implementation

#### Products Soft Delete

```typescript
// User archives a product
async function archiveProduct(productId: string, userId: string) {
  const batch = db.batch();
  
  // Mark product as archived
  const productRef = db.collection('products').doc(productId);
  batch.update(productRef, {
    isArchived: true,
    archivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  
  // Log activity
  const activityRef = db.collection('activities').doc();
  batch.set(activityRef, {
    userId,
    activityType: 'product_archived',
    productId,
    description: 'Product archived by user',
    createdAt: FieldValue.serverTimestamp()
  });
  
  await batch.commit();
}

// Restore archived product (within 2 years)
async function restoreProduct(productId: string, userId: string) {
  await db.collection('products').doc(productId).update({
    isArchived: false,
    archivedAt: null,
    updatedAt: FieldValue.serverTimestamp()
  });
}
```

#### User Account Soft Delete

```typescript
// User deletes account
async function deleteUserAccount(userId: string) {
  const batch = db.batch();
  
  // Mark user as deleted (not actually removed)
  const userRef = db.collection('users').doc(userId);
  batch.update(userRef, {
    isDeleted: true,
    deletedAt: FieldValue.serverTimestamp(),
    email: `deleted_${userId}@coverkeep.app`, // Anonymize email
    displayName: null,
    phoneNumber: null,
    photoURL: null
  });
  
  // Revoke Firebase Auth (disable login)
  await admin.auth().updateUser(userId, {
    disabled: true
  });
  
  await batch.commit();
  
  // Schedule hard delete in 30 days
  await scheduleHardDelete(userId, 30);
}
```

---

## Automated Cleanup Jobs

### Cloud Scheduler Configuration

All cleanup jobs run via Cloud Scheduler + Cloud Functions.

```bash
# Create Cloud Scheduler jobs
gcloud scheduler jobs create http cleanup-sent-reminders \
  --schedule="0 2 * * *" \
  --uri="https://us-central1-coverkeep-af231.cloudfunctions.net/cleanupSentReminders" \
  --http-method=POST \
  --time-zone="America/Los_Angeles"

gcloud scheduler jobs create http cleanup-old-activities \
  --schedule="0 3 * * *" \
  --uri="https://us-central1-coverkeep-af231.cloudfunctions.net/cleanupOldActivities" \
  --http-method=POST \
  --time-zone="America/Los_Angeles"

gcloud scheduler jobs create http archive-old-products \
  --schedule="0 4 * * 0" \
  --uri="https://us-central1-coverkeep-af231.cloudfunctions.net/archiveOldProducts" \
  --http-method=POST \
  --time-zone="America/Los_Angeles"

gcloud scheduler jobs create http hard-delete-users \
  --schedule="0 5 * * *" \
  --uri="https://us-central1-coverkeep-af231.cloudfunctions.net/hardDeleteUsers" \
  --http-method=POST \
  --time-zone="America/Los_Angeles"
```

### Cleanup Functions

#### 1. Cleanup Sent Reminders (Daily at 2 AM)

**Purpose**: Delete reminders older than 30 days after being sent

```typescript
export const cleanupSentReminders = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const snapshot = await admin.firestore()
      .collection('reminders')
      .where('status', '==', 'sent')
      .where('sentAt', '<', Timestamp.fromDate(thirtyDaysAgo))
      .limit(500) // Process in batches
      .get();
    
    if (snapshot.empty) {
      console.log('No reminders to clean up');
      return null;
    }
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`Deleted ${snapshot.size} sent reminders`);
    return null;
  });
```

#### 2. Cleanup Old Activities (Daily at 3 AM)

**Purpose**: Delete activities older than retention period (90 days free, 365 days premium)

```typescript
export const cleanupOldActivities = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    // Process in batches by user tier
    await cleanupActivitiesForTier('free', 90);
    await cleanupActivitiesForTier('premium', 365);
    await cleanupActivitiesForTier('family', 365);
    
    return null;
  });

async function cleanupActivitiesForTier(tier: string, retentionDays: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  // Get users with this tier
  const users = await admin.firestore()
    .collection('users')
    .where('subscriptionTier', '==', tier)
    .select('userId')
    .get();
  
  const userIds = users.docs.map(doc => doc.id);
  
  // Delete old activities for these users (batch by 10 users at a time)
  for (let i = 0; i < userIds.length; i += 10) {
    const batchUserIds = userIds.slice(i, i + 10);
    
    const activities = await admin.firestore()
      .collection('activities')
      .where('userId', 'in', batchUserIds)
      .where('createdAt', '<', Timestamp.fromDate(cutoffDate))
      .limit(500)
      .get();
    
    if (!activities.empty) {
      const batch = admin.firestore().batch();
      activities.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      console.log(`Deleted ${activities.size} activities for tier ${tier}`);
    }
  }
}
```

#### 3. Archive Old Products (Weekly on Sunday at 4 AM)

**Purpose**: Move archived products older than 2 years to Cloud Storage

```typescript
export const archiveOldProducts = functions.pubsub
  .schedule('0 4 * * 0')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    const snapshot = await admin.firestore()
      .collection('products')
      .where('isArchived', '==', true)
      .where('archivedAt', '<', Timestamp.fromDate(twoYearsAgo))
      .limit(100)
      .get();
    
    if (snapshot.empty) {
      console.log('No old products to archive');
      return null;
    }
    
    const bucket = admin.storage().bucket('coverkeep-af231-archives');
    const batch = admin.firestore().batch();
    
    for (const doc of snapshot.docs) {
      const product = doc.data();
      
      // Write to Cloud Storage
      const archivePath = `products/${product.userId}/${doc.id}.json`;
      const file = bucket.file(archivePath);
      await file.save(JSON.stringify(product, null, 2), {
        contentType: 'application/json',
        metadata: {
          archivedAt: new Date().toISOString(),
          originalCollection: 'products'
        }
      });
      
      // Delete from Firestore
      batch.delete(doc.ref);
    }
    
    await batch.commit();
    
    console.log(`Archived ${snapshot.size} old products to Cloud Storage`);
    return null;
  });
```

#### 4. Hard Delete Users (Daily at 5 AM)

**Purpose**: Permanently delete user accounts marked for deletion 30+ days ago

```typescript
export const hardDeleteUsers = functions.pubsub
  .schedule('0 5 * * *')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const snapshot = await admin.firestore()
      .collection('users')
      .where('isDeleted', '==', true)
      .where('deletedAt', '<', Timestamp.fromDate(thirtyDaysAgo))
      .limit(10) // Process slowly to avoid rate limits
      .get();
    
    if (snapshot.empty) {
      console.log('No users to hard delete');
      return null;
    }
    
    for (const doc of snapshot.docs) {
      const userId = doc.id;
      
      try {
        // Delete all user data
        await deleteAllUserData(userId);
        
        // Delete Firebase Auth account
        await admin.auth().deleteUser(userId);
        
        console.log(`Hard deleted user: ${userId}`);
      } catch (error) {
        console.error(`Failed to delete user ${userId}:`, error);
      }
    }
    
    return null;
  });

async function deleteAllUserData(userId: string) {
  const batch = admin.firestore().batch();
  
  // Delete user document
  const userRef = admin.firestore().collection('users').doc(userId);
  batch.delete(userRef);
  
  // Delete user's products
  const products = await admin.firestore()
    .collection('products')
    .where('userId', '==', userId)
    .get();
  products.docs.forEach(doc => batch.delete(doc.ref));
  
  // Delete user's reminders
  const reminders = await admin.firestore()
    .collection('reminders')
    .where('userId', '==', userId)
    .get();
  reminders.docs.forEach(doc => batch.delete(doc.ref));
  
  // Delete user's claims
  const claims = await admin.firestore()
    .collection('claims')
    .where('userId', '==', userId)
    .get();
  claims.docs.forEach(doc => batch.delete(doc.ref));
  
  // Delete user's activities
  const activities = await admin.firestore()
    .collection('activities')
    .where('userId', '==', userId)
    .get();
  activities.docs.forEach(doc => batch.delete(doc.ref));
  
  await batch.commit();
  
  // Delete user's files from Cloud Storage
  const bucket = admin.storage().bucket();
  await bucket.deleteFiles({
    prefix: `uploads/${userId}/`
  });
}
```

---

## Data Archival

### Cloud Storage Archive Structure

```
gs://coverkeep-af231-archives/
├── products/
│   └── {userId}/
│       └── {productId}.json
├── claims/
│   └── {userId}/
│       └── {claimId}.json
├── users/
│   └── {userId}/
│       └── account.json
└── backups/
    └── {YYYY-MM-DD}/
        ├── products.json
        ├── claims.json
        └── users.json
```

### Restore from Archive

```typescript
// Admin function to restore archived product
export const restoreArchivedProduct = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth?.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }
  
  const { userId, productId } = data;
  
  // Fetch from Cloud Storage
  const bucket = admin.storage().bucket('coverkeep-af231-archives');
  const file = bucket.file(`products/${userId}/${productId}.json`);
  
  const [contents] = await file.download();
  const product = JSON.parse(contents.toString());
  
  // Restore to Firestore
  await admin.firestore().collection('products').doc(productId).set(product);
  
  // Delete from archive
  await file.delete();
  
  return { success: true, productId };
});
```

---

## GDPR & CCPA Compliance

### Required Features

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Right to Access** | User data export API | ✅ Planned |
| **Right to Erasure** | User deletion flow + 30-day grace | ✅ Planned |
| **Right to Rectification** | User profile update API | ✅ Built-in |
| **Right to Portability** | Export in JSON format | ✅ Planned |
| **Data Minimization** | Only collect necessary data | ✅ By design |
| **Consent Management** | Terms acceptance on signup | ✅ Planned |
| **Data Breach Notification** | Admin alerts + user email | ⏳ Future |

### GDPR Compliance Checklist

- [x] Data retention policies documented
- [x] Soft delete with 30-day grace period
- [x] Hard delete removes all user data
- [ ] User data export API (see below)
- [ ] Privacy policy and terms of service
- [ ] Cookie consent banner
- [ ] Data processing agreement for third parties
- [ ] Security incident response plan

---

## User Data Export

### Export API (GDPR Right to Access)

```typescript
export const exportUserData = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  
  // Gather all user data
  const userData: any = {
    exportDate: new Date().toISOString(),
    userId,
    account: null,
    products: [],
    warranties: [],
    reminders: [],
    claims: [],
    activities: []
  };
  
  // Fetch user account
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  userData.account = userDoc.data();
  
  // Fetch products
  const products = await admin.firestore()
    .collection('products')
    .where('userId', '==', userId)
    .get();
  userData.products = products.docs.map(doc => doc.data());
  
  // Fetch warranties
  const warranties = await admin.firestore()
    .collection('warranties')
    .where('userId', '==', userId)
    .get();
  userData.warranties = warranties.docs.map(doc => doc.data());
  
  // Fetch reminders
  const reminders = await admin.firestore()
    .collection('reminders')
    .where('userId', '==', userId)
    .get();
  userData.reminders = reminders.docs.map(doc => doc.data());
  
  // Fetch claims
  const claims = await admin.firestore()
    .collection('claims')
    .where('userId', '==', userId)
    .get();
  userData.claims = claims.docs.map(doc => doc.data());
  
  // Fetch activities
  const activities = await admin.firestore()
    .collection('activities')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(1000)
    .get();
  userData.activities = activities.docs.map(doc => doc.data());
  
  // Save to Cloud Storage (temporary, expires in 7 days)
  const bucket = admin.storage().bucket();
  const exportPath = `exports/${userId}/data-export-${Date.now()}.json`;
  const file = bucket.file(exportPath);
  
  await file.save(JSON.stringify(userData, null, 2), {
    contentType: 'application/json',
    metadata: {
      cacheControl: 'private, max-age=604800' // 7 days
    }
  });
  
  // Generate signed URL (expires in 7 days)
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  
  return {
    downloadUrl: url,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
});
```

### Usage (Frontend)

```typescript
// User clicks "Export My Data" button
async function exportUserData() {
  const result = await functions.httpsCallable('exportUserData')({});
  
  // Download the file
  window.open(result.data.downloadUrl, '_blank');
  
  alert(`Your data export is ready. The link expires on ${result.data.expiresAt}`);
}
```

---

## User Data Deletion

### Deletion Flow

1. **User initiates deletion** (in app settings)
2. **Soft delete** (account disabled, data anonymized)
3. **30-day grace period** (user can restore account)
4. **Hard delete** (all data permanently removed)

### User Deletion API

```typescript
export const requestAccountDeletion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  
  // Soft delete user account
  await admin.firestore().collection('users').doc(userId).update({
    isDeleted: true,
    deletedAt: FieldValue.serverTimestamp(),
    email: `deleted_${userId}@coverkeep.app`,
    displayName: null,
    phoneNumber: null,
    photoURL: null
  });
  
  // Disable Firebase Auth
  await admin.auth().updateUser(userId, {
    disabled: true
  });
  
  // Send confirmation email
  await sendDeletionConfirmationEmail(userId);
  
  return {
    success: true,
    message: 'Your account will be permanently deleted in 30 days. Contact support to cancel.'
  };
});

export const restoreDeletedAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }
  
  const userId = context.auth.uid;
  
  // Check if account is within 30-day grace period
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const user = userDoc.data();
  
  if (!user?.isDeleted) {
    throw new functions.https.HttpsError('failed-precondition', 'Account is not deleted');
  }
  
  const deletedAt = user.deletedAt.toDate();
  const thirtyDaysLater = new Date(deletedAt);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  
  if (new Date() > thirtyDaysLater) {
    throw new functions.https.HttpsError('failed-precondition', 'Grace period expired, account cannot be restored');
  }
  
  // Restore account
  await admin.firestore().collection('users').doc(userId).update({
    isDeleted: false,
    deletedAt: null,
    updatedAt: FieldValue.serverTimestamp()
  });
  
  // Re-enable Firebase Auth
  await admin.auth().updateUser(userId, {
    disabled: false
  });
  
  return {
    success: true,
    message: 'Your account has been restored'
  };
});
```

---

## Monitoring & Alerts

### Cleanup Job Monitoring

```typescript
// Log cleanup metrics to Cloud Monitoring
import { MetricServiceClient } from '@google-cloud/monitoring';

async function logCleanupMetrics(jobName: string, recordsDeleted: number) {
  const client = new MetricServiceClient();
  const projectId = 'coverkeep-af231';
  
  const dataPoint = {
    interval: {
      endTime: {
        seconds: Math.floor(Date.now() / 1000)
      }
    },
    value: {
      int64Value: recordsDeleted
    }
  };
  
  const timeSeriesData = {
    metric: {
      type: `custom.googleapis.com/cleanup/${jobName}`,
      labels: {
        job: jobName
      }
    },
    resource: {
      type: 'global',
      labels: {
        project_id: projectId
      }
    },
    points: [dataPoint]
  };
  
  await client.createTimeSeries({
    name: client.projectPath(projectId),
    timeSeries: [timeSeriesData]
  });
}
```

### Alerting Rules

**Alert if cleanup job fails** (Cloud Monitoring):
```yaml
condition:
  displayName: "Cleanup job failed"
  conditionThreshold:
    filter: 'resource.type = "cloud_function" AND metric.type = "cloudfunctions.googleapis.com/function/execution_count" AND metric.label.status = "error"'
    comparison: COMPARISON_GT
    thresholdValue: 5
    duration: 300s
```

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial data retention strategy |

---

**Document Owner**: DATABASE-ADMIN Agent  
**Review Cycle**: Quarterly  
**Next Review**: 2026-05-17
