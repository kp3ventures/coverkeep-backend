# CoverKeep Database Integration Guide

**Project**: coverkeep-af231  
**Audience**: Backend & Frontend Developers  
**Version**: 1.0  
**Last Updated**: 2026-02-17

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Firebase SDK Setup](#firebase-sdk-setup)
3. [Common Operations](#common-operations)
4. [Query Patterns](#query-patterns)
5. [Cloud Functions Integration](#cloud-functions-integration)
6. [Error Handling](#error-handling)
7. [Testing Strategies](#testing-strategies)
8. [Best Practices](#best-practices)

---

## Quick Start

### Prerequisites

```bash
# Install Firebase tools
npm install firebase firebase-admin

# For React/React Native
npm install @firebase/firestore @firebase/auth @firebase/storage
```

### Firebase Config

```typescript
// firebase.config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: 'coverkeep-af231.firebaseapp.com',
  projectId: 'coverkeep-af231',
  storageBucket: 'coverkeep-af231.appspot.com',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

---

## Firebase SDK Setup

### Client-Side (React/React Native)

```typescript
// services/firestore.service.ts
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { db } from '../firebase.config';

// Enable offline persistence (cache)
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistence not supported by browser');
  }
});

export class FirestoreService {
  // Generic CRUD operations
  async getDocument<T>(collectionName: string, documentId: string): Promise<T | null> {
    const docRef = doc(db, collectionName, documentId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as T : null;
  }
  
  async createDocument<T>(collectionName: string, data: T): Promise<string> {
    const docRef = await addDoc(collection(db, collectionName), data);
    return docRef.id;
  }
  
  async updateDocument(collectionName: string, documentId: string, data: Partial<any>): Promise<void> {
    const docRef = doc(db, collectionName, documentId);
    await updateDoc(docRef, data);
  }
  
  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    const docRef = doc(db, collectionName, documentId);
    await deleteDoc(docRef);
  }
}
```

### Server-Side (Cloud Functions)

```typescript
// functions/src/services/firestore.admin.ts
import * as admin from 'firebase-admin';

admin.initializeApp();

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;

// Example: Batch write helper
export async function batchWrite(
  operations: Array<{ ref: admin.firestore.DocumentReference; data: any; type: 'set' | 'update' | 'delete' }>
): Promise<void> {
  const batch = db.batch();
  
  operations.forEach(op => {
    switch (op.type) {
      case 'set':
        batch.set(op.ref, op.data);
        break;
      case 'update':
        batch.update(op.ref, op.data);
        break;
      case 'delete':
        batch.delete(op.ref);
        break;
    }
  });
  
  await batch.commit();
}
```

---

## Common Operations

### 1. User Management

#### Create User (on signup)

```typescript
// Frontend (after Firebase Auth signup)
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

async function signupUser(email: string, password: string, displayName: string) {
  // 1. Create Firebase Auth account
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const userId = userCredential.user.uid;
  
  // 2. Create user document in Firestore
  await setDoc(doc(db, 'users', userId), {
    userId,
    email,
    displayName,
    photoURL: null,
    phoneNumber: null,
    subscriptionTier: 'free',
    subscriptionStatus: 'active',
    subscriptionStartDate: Timestamp.now(),
    subscriptionEndDate: null,
    trialEndDate: null,
    stripeCustomerId: null,
    productsCount: 0,
    productsLimit: 5,
    notificationsEnabled: true,
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    reminderDaysBefore: [30, 14, 7, 1],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    isDeleted: false,
    deletedAt: null
  });
  
  return userId;
}
```

#### Update User Profile

```typescript
async function updateUserProfile(userId: string, updates: Partial<User>) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
}
```

### 2. Product Management

#### Create Product

```typescript
interface CreateProductData {
  productName: string;
  brand?: string;
  model?: string;
  warrantyType: 'manufacturer' | 'extended' | 'store' | 'credit_card';
  warrantyStartDate: Date;
  warrantyEndDate: Date;
  purchaseDate: Date;
  purchasePrice?: number; // In cents
  photos?: string[];
  notes?: string;
}

async function createProduct(userId: string, productData: CreateProductData) {
  // 1. Check product limit
  const userDoc = await getDoc(doc(db, 'users', userId));
  const user = userDoc.data();
  
  if (user.productsCount >= user.productsLimit) {
    throw new Error('Product limit reached for your subscription tier');
  }
  
  // 2. Calculate warranty duration
  const durationMs = productData.warrantyEndDate.getTime() - productData.warrantyStartDate.getTime();
  const durationMonths = Math.ceil(durationMs / (1000 * 60 * 60 * 24 * 30));
  
  // 3. Create product document
  const productRef = await addDoc(collection(db, 'products'), {
    userId,
    productName: productData.productName,
    brand: productData.brand || null,
    model: productData.model || null,
    serialNumber: null,
    category: null,
    warrantyType: productData.warrantyType,
    warrantyProvider: null,
    warrantyStartDate: Timestamp.fromDate(productData.warrantyStartDate),
    warrantyEndDate: Timestamp.fromDate(productData.warrantyEndDate),
    warrantyDurationMonths: durationMonths,
    warrantyStatus: 'active',
    purchaseDate: Timestamp.fromDate(productData.purchaseDate),
    purchasePrice: productData.purchasePrice || null,
    purchaseLocation: null,
    purchaseReceiptURL: null,
    warrantyDocumentURL: null,
    manualURL: null,
    proofOfPurchaseURL: null,
    photos: productData.photos || [],
    aiDetected: false,
    aiConfidence: null,
    aiWarrantyTemplateId: null,
    notes: productData.notes || null,
    isArchived: false,
    archivedAt: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  // 4. Increment user's product count
  await updateDoc(doc(db, 'users', userId), {
    productsCount: FieldValue.increment(1)
  });
  
  // 5. Log activity
  await addDoc(collection(db, 'activities'), {
    userId,
    activityType: 'product_added',
    productId: productRef.id,
    description: `Added product: ${productData.productName}`,
    metadata: { productName: productData.productName },
    ipAddress: null,
    userAgent: null,
    createdAt: Timestamp.now()
  });
  
  return productRef.id;
}
```

#### Get User's Products (with Pagination)

```typescript
import { QueryDocumentSnapshot } from 'firebase/firestore';

interface ProductListResult {
  products: Product[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

async function getUserProducts(
  userId: string, 
  lastDoc?: QueryDocumentSnapshot,
  pageSize = 20
): Promise<ProductListResult> {
  let q = query(
    collection(db, 'products'),
    where('userId', '==', userId),
    where('isArchived', '==', false),
    orderBy('warrantyEndDate', 'asc'),
    limit(pageSize)
  );
  
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  
  const snapshot = await getDocs(q);
  
  return {
    products: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.docs.length === pageSize
  };
}
```

#### Archive Product (Soft Delete)

```typescript
async function archiveProduct(productId: string, userId: string) {
  // Use batch for atomicity
  const batch = writeBatch(db);
  
  const productRef = doc(db, 'products', productId);
  batch.update(productRef, {
    isArchived: true,
    archivedAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  // Log activity
  const activityRef = doc(collection(db, 'activities'));
  batch.set(activityRef, {
    userId,
    activityType: 'product_archived',
    productId,
    description: 'Product archived',
    metadata: {},
    createdAt: Timestamp.now()
  });
  
  await batch.commit();
}
```

### 3. Reminder Management

#### Schedule Reminders (Cloud Function)

```typescript
// Cloud Function triggered on product creation
export const onProductCreated = functions.firestore
  .document('products/{productId}')
  .onCreate(async (snapshot, context) => {
    const product = snapshot.data();
    const productId = context.params.productId;
    
    // Get user's reminder preferences
    const userDoc = await admin.firestore().collection('users').doc(product.userId).get();
    const user = userDoc.data();
    
    const reminderDaysBefore = user?.reminderDaysBefore || [30, 14, 7, 1];
    
    // Create reminders
    const batch = admin.firestore().batch();
    
    reminderDaysBefore.forEach(daysBefore => {
      const scheduledDate = new Date(product.warrantyEndDate.toDate());
      scheduledDate.setDate(scheduledDate.getDate() - daysBefore);
      
      // Only schedule if in the future
      if (scheduledDate > new Date()) {
        const reminderRef = admin.firestore().collection('reminders').doc();
        batch.set(reminderRef, {
          reminderId: reminderRef.id,
          productId,
          userId: product.userId,
          reminderType: 'email',
          reminderDaysBefore: daysBefore,
          scheduledDate: admin.firestore.Timestamp.fromDate(scheduledDate),
          warrantyExpirationDate: product.warrantyEndDate,
          status: 'pending',
          sentAt: null,
          failedAt: null,
          failureReason: null,
          subject: `Warranty Reminder: ${product.productName}`,
          message: `Your warranty for ${product.productName} expires in ${daysBefore} days.`,
          recipientEmail: user?.email || null,
          recipientPhone: null,
          pushToken: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
    await batch.commit();
  });
```

### 4. Claims Management

#### Create Claim (Premium Feature)

```typescript
interface CreateClaimData {
  productId: string;
  issueDescription: string;
  issueCategory?: string;
  photos?: File[];
}

async function createClaim(userId: string, claimData: CreateClaimData) {
  // 1. Verify user is premium
  const userDoc = await getDoc(doc(db, 'users', userId));
  const user = userDoc.data();
  
  if (user.subscriptionTier === 'free') {
    throw new Error('Claims are a premium feature. Please upgrade to create claims.');
  }
  
  // 2. Upload photos to Cloud Storage
  const photoURLs: string[] = [];
  if (claimData.photos) {
    for (const photo of claimData.photos) {
      const storageRef = ref(storage, `claims/${userId}/${Date.now()}_${photo.name}`);
      await uploadBytes(storageRef, photo);
      const url = await getDownloadURL(storageRef);
      photoURLs.push(url);
    }
  }
  
  // 3. Create claim document
  const claimRef = await addDoc(collection(db, 'claims'), {
    userId,
    productId: claimData.productId,
    warrantyId: null,
    claimNumber: null,
    claimDate: Timestamp.now(),
    issueDescription: claimData.issueDescription,
    issueCategory: claimData.issueCategory || null,
    claimStatus: 'draft',
    statusUpdatedAt: Timestamp.now(),
    submittedAt: null,
    submittedVia: null,
    approvedAt: null,
    deniedAt: null,
    denialReason: null,
    completedAt: null,
    resolutionType: null,
    resolutionAmount: null,
    claimDocuments: [],
    photos: photoURLs,
    claimRepName: null,
    claimRepEmail: null,
    claimRepPhone: null,
    userNotes: null,
    adminNotes: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  return claimRef.id;
}
```

---

## Query Patterns

### Dashboard Summary Query

```typescript
async function getDashboardSummary(userId: string) {
  // Parallel queries for performance
  const [
    activeProducts,
    expiringProducts,
    recentClaims,
    pendingReminders
  ] = await Promise.all([
    // Active products count
    getDocs(query(
      collection(db, 'products'),
      where('userId', '==', userId),
      where('warrantyStatus', '==', 'active')
    )),
    
    // Products expiring in next 30 days
    getDocs(query(
      collection(db, 'products'),
      where('userId', '==', userId),
      where('warrantyStatus', '==', 'active'),
      where('warrantyEndDate', '>=', Timestamp.now()),
      where('warrantyEndDate', '<=', Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))),
      orderBy('warrantyEndDate', 'asc'),
      limit(5)
    )),
    
    // Recent claims
    getDocs(query(
      collection(db, 'claims'),
      where('userId', '==', userId),
      orderBy('claimDate', 'desc'),
      limit(5)
    )),
    
    // Pending reminders
    getDocs(query(
      collection(db, 'reminders'),
      where('userId', '==', userId),
      where('status', '==', 'pending'),
      limit(10)
    ))
  ]);
  
  return {
    activeProductsCount: activeProducts.size,
    expiringProducts: expiringProducts.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    recentClaims: recentClaims.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    pendingRemindersCount: pendingReminders.size
  };
}
```

### Search Products

```typescript
async function searchProducts(userId: string, searchTerm: string) {
  // Note: Firestore doesn't support full-text search natively
  // Options:
  // 1. Use Algolia/ElasticSearch for advanced search
  // 2. Simple prefix search (limited)
  // 3. Client-side filtering after fetching
  
  // Simple approach: Fetch all user's products and filter client-side
  const q = query(
    collection(db, 'products'),
    where('userId', '==', userId),
    where('isArchived', '==', false)
  );
  
  const snapshot = await getDocs(q);
  
  // Filter by search term (case-insensitive)
  const searchLower = searchTerm.toLowerCase();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Product))
    .filter(product => 
      product.productName.toLowerCase().includes(searchLower) ||
      product.brand?.toLowerCase().includes(searchLower) ||
      product.model?.toLowerCase().includes(searchLower)
    );
}
```

---

## Cloud Functions Integration

### Trigger Functions

#### On Product Update → Update Reminders

```typescript
export const onProductUpdated = functions.firestore
  .document('products/{productId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const productId = context.params.productId;
    
    // If warranty end date changed, update all reminders
    if (before.warrantyEndDate !== after.warrantyEndDate) {
      const reminders = await admin.firestore()
        .collection('reminders')
        .where('productId', '==', productId)
        .where('status', '==', 'pending')
        .get();
      
      const batch = admin.firestore().batch();
      
      reminders.forEach(doc => {
        const reminder = doc.data();
        const newScheduledDate = new Date(after.warrantyEndDate.toDate());
        newScheduledDate.setDate(newScheduledDate.getDate() - reminder.reminderDaysBefore);
        
        batch.update(doc.ref, {
          warrantyExpirationDate: after.warrantyEndDate,
          scheduledDate: admin.firestore.Timestamp.fromDate(newScheduledDate),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
    }
  });
```

### Scheduled Functions (Cron Jobs)

#### Send Pending Reminders

```typescript
export const sendPendingReminders = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    
    // Get reminders scheduled for now or earlier
    const reminders = await admin.firestore()
      .collection('reminders')
      .where('status', '==', 'pending')
      .where('scheduledDate', '<=', now)
      .limit(100)
      .get();
    
    if (reminders.empty) {
      console.log('No reminders to send');
      return null;
    }
    
    // Process each reminder
    for (const doc of reminders.docs) {
      const reminder = doc.data();
      
      try {
        // Send email (via SendGrid or Firebase Email Extension)
        await sendEmail({
          to: reminder.recipientEmail,
          subject: reminder.subject,
          body: reminder.message
        });
        
        // Mark as sent
        await doc.ref.update({
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Sent reminder ${doc.id} to ${reminder.recipientEmail}`);
      } catch (error) {
        // Mark as failed
        await doc.ref.update({
          status: 'failed',
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
          failureReason: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.error(`Failed to send reminder ${doc.id}:`, error);
      }
    }
    
    return null;
  });
```

---

## Error Handling

### Common Firestore Errors

```typescript
import { FirebaseError } from 'firebase/app';

async function safeFirestoreOperation<T>(
  operation: () => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await operation();
    return { data, error: null };
  } catch (error) {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'permission-denied':
          return { data: null, error: 'You do not have permission to perform this action' };
        case 'not-found':
          return { data: null, error: 'Document not found' };
        case 'already-exists':
          return { data: null, error: 'Document already exists' };
        case 'resource-exhausted':
          return { data: null, error: 'Quota exceeded. Please try again later.' };
        case 'unauthenticated':
          return { data: null, error: 'You must be logged in to perform this action' };
        case 'unavailable':
          return { data: null, error: 'Service temporarily unavailable. Please try again.' };
        default:
          return { data: null, error: `Firestore error: ${error.code}` };
      }
    }
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Usage
const { data, error } = await safeFirestoreOperation(() => 
  createProduct(userId, productData)
);

if (error) {
  alert(error);
} else {
  console.log('Product created:', data);
}
```

---

## Testing Strategies

### Unit Tests with Firebase Emulator

```typescript
// test/setup.ts
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

let testEnv: any;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'coverkeep-test',
    firestore: {
      host: 'localhost',
      port: 8080,
      rules: fs.readFileSync('../firestore.rules', 'utf8')
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// test/products.test.ts
describe('Product Operations', () => {
  it('should allow user to create product', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const db = alice.firestore();
    
    await setDoc(doc(db, 'users', 'alice'), {
      userId: 'alice',
      productsCount: 0,
      productsLimit: 5
    });
    
    const productRef = await addDoc(collection(db, 'products'), {
      userId: 'alice',
      productName: 'Test Product'
    });
    
    expect(productRef.id).toBeDefined();
  });
  
  it('should deny access to other users products', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const bob = testEnv.authenticatedContext('bob');
    
    // Alice creates product
    const aliceDb = alice.firestore();
    const productRef = await addDoc(collection(aliceDb, 'products'), {
      userId: 'alice',
      productName: 'Alice Product'
    });
    
    // Bob tries to read
    const bobDb = bob.firestore();
    await expect(getDoc(doc(bobDb, 'products', productRef.id)))
      .rejects.toThrow('permission-denied');
  });
});
```

---

## Best Practices

### 1. Always Use Timestamps

```typescript
// ✅ GOOD
await updateDoc(productRef, {
  productName: 'New Name',
  updatedAt: Timestamp.now()
});

// ❌ BAD
await updateDoc(productRef, {
  productName: 'New Name'
  // Missing updatedAt!
});
```

### 2. Use Batch Writes for Multiple Operations

```typescript
// ✅ GOOD: Atomic batch write
const batch = writeBatch(db);
batch.update(productRef, { status: 'archived' });
batch.set(activityRef, { type: 'archived' });
await batch.commit();

// ❌ BAD: Separate writes (not atomic)
await updateDoc(productRef, { status: 'archived' });
await setDoc(activityRef, { type: 'archived' });
```

### 3. Paginate Large Lists

```typescript
// ✅ GOOD: Paginated query
const products = await getDocs(query(
  collection(db, 'products'),
  where('userId', '==', userId),
  limit(20)
));

// ❌ BAD: Fetch all products
const products = await getDocs(query(
  collection(db, 'products'),
  where('userId', '==', userId)
));
```

### 4. Validate Data Before Writing

```typescript
// ✅ GOOD: Validate before write
function validateProduct(data: CreateProductData) {
  if (!data.productName || data.productName.length > 200) {
    throw new Error('Invalid product name');
  }
  if (data.warrantyEndDate <= data.warrantyStartDate) {
    throw new Error('End date must be after start date');
  }
}

await validateProduct(productData);
await createProduct(userId, productData);
```

### 5. Use Real-time Listeners Sparingly

```typescript
// ✅ GOOD: Real-time for active data
const unsubscribe = onSnapshot(
  query(collection(db, 'products'), where('userId', '==', userId), limit(10)),
  (snapshot) => updateUI(snapshot.docs)
);

// Remember to unsubscribe!
useEffect(() => {
  return () => unsubscribe();
}, []);

// ❌ BAD: Real-time for static data (waste of reads)
onSnapshot(collection(db, 'warranty_database'), ...);
```

---

## Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firestore Security Rules Reference](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)

---

**Document Owner**: DATABASE-ADMIN Agent  
**For Questions**: Contact backend-dev or orchestrator-planner  
**Last Updated**: 2026-02-17
