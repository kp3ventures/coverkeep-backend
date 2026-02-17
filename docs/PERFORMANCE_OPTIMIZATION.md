# CoverKeep Performance Optimization Strategy

**Project**: coverkeep-af231  
**Version**: 1.0  
**Last Updated**: 2026-02-17

## Table of Contents

1. [Overview](#overview)
2. [Read Optimization](#read-optimization)
3. [Write Optimization](#write-optimization)
4. [Denormalization Strategy](#denormalization-strategy)
5. [Caching Strategy](#caching-strategy)
6. [Query Optimization](#query-optimization)
7. [Scaling Strategy](#scaling-strategy)
8. [Cost Optimization](#cost-optimization)
9. [Monitoring & Metrics](#monitoring--metrics)

---

## Overview

### Performance Goals

| Metric | Target | Current (Est.) |
|--------|--------|----------------|
| Dashboard load time | < 2s | TBD |
| Product list query | < 500ms | TBD |
| Product creation | < 1s | TBD |
| Reminder scheduling | < 5s batch | TBD |
| API p95 latency | < 1s | TBD |
| Database read/write ratio | 80/20 | TBD |

### Key Principles

1. **Optimize for reads** - Users read 10x more than they write
2. **Minimize writes** - Each write costs money and time
3. **Denormalize strategically** - Duplicate data to avoid joins
4. **Cache aggressively** - Frontend, CDN, and in-memory caching
5. **Batch operations** - Combine writes when possible

---

## Read Optimization

### 1. Pagination Strategy

**Problem**: Fetching all products at once is slow and expensive

**Solution**: Cursor-based pagination

```typescript
// ✅ GOOD: Paginated query
async function getProducts(userId: string, lastDoc?: DocumentSnapshot, limit = 20) {
  let query = db.collection('products')
    .where('userId', '==', userId)
    .where('isArchived', '==', false)
    .orderBy('warrantyEndDate', 'asc')
    .limit(limit);
  
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }
  
  const snapshot = await query.get();
  return {
    products: snapshot.docs.map(doc => doc.data()),
    lastDoc: snapshot.docs[snapshot.docs.length - 1]
  };
}

// ❌ BAD: Fetch all products
const allProducts = await db.collection('products')
  .where('userId', '==', userId)
  .get();
```

**Benefits**:
- Reduces initial load time
- Decreases read costs
- Scales to any collection size

### 2. Selective Field Retrieval

**Problem**: Fetching entire documents when only a few fields are needed

**Solution**: Use `select()` to retrieve specific fields

```typescript
// ✅ GOOD: Select specific fields for list view
const products = await db.collection('products')
  .where('userId', '==', userId)
  .select('productId', 'productName', 'warrantyEndDate', 'warrantyStatus')
  .orderBy('warrantyEndDate', 'asc')
  .limit(20)
  .get();

// ❌ BAD: Fetch all fields (including photos arrays, notes, etc.)
const products = await db.collection('products')
  .where('userId', '==', userId)
  .get();
```

**Benefits**:
- Reduces bandwidth
- Faster serialization
- Lower read costs (charged per document, but smaller payloads)

### 3. Real-time Listeners vs Queries

**When to use real-time listeners**:
- Dashboard (live updates)
- Active warranty list (changes frequently)

**When to use one-time queries**:
- Archived products
- Historical claims
- Activity logs (older than 7 days)

```typescript
// ✅ GOOD: Real-time for active products
const unsubscribe = db.collection('products')
  .where('userId', '==', userId)
  .where('warrantyStatus', '==', 'active')
  .orderBy('warrantyEndDate', 'asc')
  .limit(10)
  .onSnapshot(snapshot => {
    updateUI(snapshot.docs);
  });

// ✅ GOOD: One-time query for archived products
const archivedProducts = await db.collection('products')
  .where('userId', '==', userId)
  .where('isArchived', '==', true)
  .get();
```

### 4. Local Caching (Firestore SDK)

**Enable offline persistence**:
```typescript
// React Native / Web
await enableIndexedDbPersistence(db);

// Firestore will cache queries and return cached results
// Reduces read costs and improves perceived performance
```

**Benefits**:
- Instant loads from cache
- Works offline
- Reduces read operations

---

## Write Optimization

### 1. Batch Writes

**Problem**: Individual writes are slow and expensive

**Solution**: Use batch writes for related operations

```typescript
// ✅ GOOD: Batch write (atomic, 1 network call)
const batch = db.batch();

// Update product
const productRef = db.collection('products').doc(productId);
batch.update(productRef, { warrantyStatus: 'expired' });

// Log activity
const activityRef = db.collection('activities').doc();
batch.set(activityRef, {
  userId,
  activityType: 'warranty_expired',
  productId,
  createdAt: FieldValue.serverTimestamp()
});

// Decrement user's active products count
const userRef = db.collection('users').doc(userId);
batch.update(userRef, {
  productsCount: FieldValue.increment(-1)
});

await batch.commit();

// ❌ BAD: 3 separate writes (3 network calls)
await productRef.update({ warrantyStatus: 'expired' });
await activityRef.set({ ... });
await userRef.update({ productsCount: FieldValue.increment(-1) });
```

**Benefits**:
- Atomic operations (all-or-nothing)
- Faster (single network roundtrip)
- Cheaper (batched billing)

**Limits**: Max 500 operations per batch

### 2. Transactions for Critical Updates

**Use transactions when**:
- Reading and writing same document
- Ensuring consistency (e.g., claim count)
- Preventing race conditions

```typescript
// ✅ GOOD: Transaction to enforce claim limit
await db.runTransaction(async (transaction) => {
  const warrantyRef = db.collection('warranties').doc(warrantyId);
  const warrantyDoc = await transaction.get(warrantyRef);
  const warranty = warrantyDoc.data();
  
  if (warranty.claimsUsed >= warranty.claimsAllowed) {
    throw new Error('Claim limit reached');
  }
  
  // Create claim
  const claimRef = db.collection('claims').doc();
  transaction.set(claimRef, { ... });
  
  // Increment claims used
  transaction.update(warrantyRef, {
    claimsUsed: FieldValue.increment(1)
  });
});
```

### 3. Minimize Write Frequency

**Problem**: Updating `updatedAt` on every tiny change

**Solution**: Batch updates or debounce writes

```typescript
// ✅ GOOD: Debounce saves (e.g., draft claims)
const debouncedSave = debounce(async (claimData) => {
  await db.collection('claims').doc(claimId).update(claimData);
}, 2000); // Save every 2 seconds max

// ❌ BAD: Save on every keystroke
onChange={(text) => {
  db.collection('claims').doc(claimId).update({ issueDescription: text });
}}
```

---

## Denormalization Strategy

### What to Denormalize

| Field | Duplicated From | Duplicated To | Reason |
|-------|-----------------|---------------|--------|
| `userId` | `products` | `reminders`, `claims` | Avoid join for user queries |
| `warrantyExpirationDate` | `products.warrantyEndDate` | `reminders` | Enable direct reminder scheduling queries |
| `productName` | `products` | `activities` (metadata) | Display activity without fetching product |
| `email` | `users` | `reminders` | Send reminder without fetching user |

### Keeping Denormalized Data in Sync

**Strategy**: Use Cloud Functions triggers

```typescript
// When product is updated, update related reminders
export const onProductUpdate = functions.firestore
  .document('products/{productId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // If warranty end date changed, update reminders
    if (before.warrantyEndDate !== after.warrantyEndDate) {
      const reminders = await admin.firestore()
        .collection('reminders')
        .where('productId', '==', context.params.productId)
        .get();
      
      const batch = admin.firestore().batch();
      reminders.forEach(doc => {
        batch.update(doc.ref, {
          warrantyExpirationDate: after.warrantyEndDate,
          scheduledDate: calculateReminderDate(after.warrantyEndDate, doc.data().reminderDaysBefore)
        });
      });
      
      await batch.commit();
    }
  });
```

### What NOT to Denormalize

- **Large objects** (photos arrays, long notes)
- **Frequently changing data** (warranty status - use reference instead)
- **Sensitive data** (payment info - keep centralized)

---

## Caching Strategy

### Layer 1: Browser Cache (Service Worker)

**Cache static assets**:
- App bundle (JS/CSS)
- Product images (thumbnails)
- User profile photos

**Implementation**: Workbox (React PWA)

```javascript
// service-worker.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

// Cache app shell
precacheAndRoute(self.__WB_MANIFEST);

// Cache product images
registerRoute(
  ({ url }) => url.pathname.startsWith('/uploads/'),
  new CacheFirst({
    cacheName: 'product-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
      })
    ]
  })
);
```

### Layer 2: Firestore SDK Cache

**Enabled by default** - Firestore SDK caches queries

**Best practices**:
- Use `enablePersistence()` to persist cache across sessions
- Cache settings survive app restarts
- Free reads from cache!

### Layer 3: API Response Cache (Cloud Functions)

**Cache frequently accessed data** (e.g., warranty database templates)

```typescript
import { LRUCache } from 'lru-cache';

const warrantyTemplateCache = new LRUCache<string, WarrantyTemplate>({
  max: 500, // Max 500 templates
  ttl: 1000 * 60 * 60 // 1 hour
});

export const getWarrantyTemplate = functions.https.onCall(async (data) => {
  const cacheKey = `${data.brand}-${data.productName}`;
  
  // Check cache first
  if (warrantyTemplateCache.has(cacheKey)) {
    return warrantyTemplateCache.get(cacheKey);
  }
  
  // Fetch from Firestore
  const template = await db.collection('warranty_database')
    .where('brand', '==', data.brand)
    .where('productName', '==', data.productName)
    .limit(1)
    .get();
  
  // Cache result
  if (!template.empty) {
    warrantyTemplateCache.set(cacheKey, template.docs[0].data());
  }
  
  return template.docs[0]?.data() || null;
});
```

### Layer 4: CDN Cache (Firebase Hosting)

**Cache API responses at edge** for global performance

```json
// firebase.json
{
  "hosting": {
    "headers": [
      {
        "source": "/api/v1/warranty_database/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=3600, s-maxage=86400"
          }
        ]
      },
      {
        "source": "/uploads/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=604800, immutable"
          }
        ]
      }
    ]
  }
}
```

---

## Query Optimization

### 1. Use Composite Indexes

**Problem**: Queries without proper indexes are slow and expensive

**Solution**: Pre-create composite indexes for common queries

```typescript
// Requires composite index: userId + isArchived + warrantyEndDate
db.collection('products')
  .where('userId', '==', userId)
  .where('isArchived', '==', false)
  .orderBy('warrantyEndDate', 'asc')
  .limit(10);
```

See `firestore.indexes.json` for all configured indexes.

### 2. Limit Query Scope

**Use inequalities wisely**:
```typescript
// ✅ GOOD: Narrow time range
const thirtyDaysFromNow = new Date();
thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

db.collection('products')
  .where('warrantyEndDate', '>=', Timestamp.now())
  .where('warrantyEndDate', '<=', Timestamp.fromDate(thirtyDaysFromNow))
  .limit(100);

// ❌ BAD: Open-ended query
db.collection('products')
  .where('warrantyEndDate', '>', Timestamp.now());
```

### 3. Avoid `array-contains-any` and `in` Overuse

**Problem**: These operators are expensive (up to 10 values = 10 reads)

**Solution**: Use sparingly, prefer direct equality

```typescript
// ❌ EXPENSIVE: array-contains-any (3 reads)
db.collection('products')
  .where('category', 'in', ['Electronics', 'Appliances', 'Vehicles']);

// ✅ BETTER: Direct query for single category
db.collection('products')
  .where('category', '==', 'Electronics');
```

---

## Scaling Strategy

### Phase 1: 0-1K Users (Current)

**Infrastructure**:
- Single Firestore database (default mode)
- Cloud Functions (min instances: 0)
- No CDN caching

**Costs**: ~$10-50/month

**Actions**:
- Implement basic indexes
- Enable SDK persistence
- Monitor read/write patterns

### Phase 2: 1K-10K Users

**Infrastructure**:
- Enable Firebase Hosting CDN
- Increase Cloud Functions min instances to 1-2
- Implement API caching (LRU)

**Costs**: ~$100-500/month

**Optimizations**:
- Add composite indexes as new query patterns emerge
- Implement pagination everywhere
- Cache warranty database templates

**Monitoring**:
- Set up Firestore usage alerts (>1M reads/day)
- Track slow queries (>1s)
- Monitor Cloud Functions cold starts

### Phase 3: 10K-100K Users

**Infrastructure**:
- Upgrade to Blaze plan with committed use discounts
- Multi-region Firestore (if global users)
- Cloud Functions: min instances 5-10
- Implement Cloud CDN for static assets

**Costs**: ~$500-2000/month

**Optimizations**:
- Shard hot collections (reminders by date)
- Implement read replicas
- Archive old data to Cloud Storage
- Use Firestore bundled reads where possible

**Data Management**:
- Auto-archive activities >90 days
- Move old claims (>2 years) to BigQuery
- Implement data retention policies

### Phase 4: 100K+ Users

**Infrastructure**:
- Dedicated Firebase project per region (if multi-region)
- Firestore multi-region replication
- Cloud Functions: regional deployments
- BigQuery for analytics and cold data

**Costs**: ~$2K-10K/month

**Optimizations**:
- Partition users by hash (0-9, A-Z shards)
- Implement eventual consistency for non-critical data
- Use Pub/Sub for async operations
- Evaluate Firestore alternatives for specific use cases

---

## Cost Optimization

### Firestore Pricing (2026 Estimates)

| Operation | Cost | Monthly Free Tier |
|-----------|------|-------------------|
| Document reads | $0.06 per 100K | 50K/day |
| Document writes | $0.18 per 100K | 20K/day |
| Document deletes | $0.02 per 100K | 20K/day |
| Storage | $0.18/GB | 1 GB |

### Cost Reduction Strategies

#### 1. Minimize Reads

**Use real-time listeners sparingly**:
```typescript
// ❌ EXPENSIVE: 100 reads every time user opens app
const products = await db.collection('products')
  .where('userId', '==', userId)
  .get();

// ✅ CHEAPER: Use cached data, fetch only on refresh
const products = await db.collection('products')
  .where('userId', '==', userId)
  .get({ source: 'cache' }); // Free!

// Only fetch from server on explicit refresh
const freshProducts = await db.collection('products')
  .where('userId', '==', userId)
  .get({ source: 'server' });
```

#### 2. Minimize Writes

**Batch activity logs**:
```typescript
// ❌ EXPENSIVE: 1 write per user action
function logActivity(userId: string, action: string) {
  db.collection('activities').add({
    userId,
    activityType: action,
    createdAt: FieldValue.serverTimestamp()
  });
}

// ✅ CHEAPER: Batch logs, write every 10 actions or 5 minutes
const activityBuffer: Activity[] = [];

function logActivity(userId: string, action: string) {
  activityBuffer.push({ userId, activityType: action });
  
  if (activityBuffer.length >= 10) {
    flushActivityLogs();
  }
}

async function flushActivityLogs() {
  if (activityBuffer.length === 0) return;
  
  const batch = db.batch();
  activityBuffer.forEach(activity => {
    const ref = db.collection('activities').doc();
    batch.set(ref, { ...activity, createdAt: FieldValue.serverTimestamp() });
  });
  
  await batch.commit();
  activityBuffer.length = 0;
}
```

#### 3. Reduce Storage Costs

**Compress large fields**:
```typescript
// Store large text fields compressed
import pako from 'pako';

function compressText(text: string): string {
  const compressed = pako.deflate(text);
  return btoa(String.fromCharCode(...compressed));
}

function decompressText(compressed: string): string {
  const binary = atob(compressed);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return pako.inflate(bytes, { to: 'string' });
}
```

#### 4. Use Cloud Storage for Large Files

**Don't store files in Firestore**:
```typescript
// ❌ BAD: Store base64 image in Firestore
await db.collection('products').doc(productId).update({
  photoBase64: base64Image // Counts toward Firestore storage!
});

// ✅ GOOD: Store in Cloud Storage, reference in Firestore
const storageRef = storage.ref(`products/${productId}/photo.jpg`);
await storageRef.put(imageFile);
const photoURL = await storageRef.getDownloadURL();

await db.collection('products').doc(productId).update({
  photos: FieldValue.arrayUnion(photoURL) // Just a URL string!
});
```

---

## Monitoring & Metrics

### Key Metrics to Track

#### 1. Firestore Metrics (Firebase Console)

- **Reads per day** (target: < 1M for free tier)
- **Writes per day** (target: < 200K for free tier)
- **Storage used** (target: < 1 GB for free tier)
- **Active connections** (real-time listeners)

#### 2. Cloud Functions Metrics

- **Invocations** (total calls)
- **Execution time** (p50, p95, p99)
- **Error rate** (target: < 0.1%)
- **Cold start rate** (target: < 10%)

#### 3. Custom Performance Metrics

**Track in Firebase Performance Monitoring**:
```typescript
import { trace } from 'firebase/performance';

async function loadDashboard() {
  const t = trace(performance, 'load_dashboard');
  t.start();
  
  try {
    await fetchProducts();
    await fetchClaims();
    t.putAttribute('success', 'true');
  } catch (error) {
    t.putAttribute('success', 'false');
    throw error;
  } finally {
    t.stop();
  }
}
```

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Firestore reads/day | > 800K | > 1M |
| Firestore writes/day | > 150K | > 200K |
| API latency p95 | > 2s | > 5s |
| Error rate | > 1% | > 5% |
| Storage used | > 800 MB | > 1 GB |

### Performance Budget

**Dashboard load**:
- Initial render: < 1s
- Products list: < 500ms
- Search results: < 300ms
- Product details: < 200ms

**Monitoring**:
```typescript
// Use React Profiler
<Profiler id="ProductsList" onRender={(id, phase, actualDuration) => {
  if (actualDuration > 500) {
    console.warn(`Slow render: ${id} took ${actualDuration}ms`);
  }
}}>
  <ProductsList />
</Profiler>
```

---

## Performance Checklist

### Before Launch

- [ ] All queries have required indexes
- [ ] Pagination implemented for all lists
- [ ] SDK persistence enabled (offline support)
- [ ] Batch writes used for multi-document operations
- [ ] Product images optimized (WebP, < 500KB)
- [ ] Service Worker caching configured
- [ ] Firebase Hosting CDN headers set
- [ ] Performance monitoring integrated

### Weekly Reviews

- [ ] Check Firestore usage (reads/writes/storage)
- [ ] Review slow queries (>1s)
- [ ] Monitor Cloud Functions cold starts
- [ ] Check error rates
- [ ] Review cache hit rates

### Monthly Optimizations

- [ ] Analyze query patterns, add missing indexes
- [ ] Review denormalized data consistency
- [ ] Archive old activities (>90 days)
- [ ] Compress large text fields if needed
- [ ] Evaluate cost optimization opportunities

---

## Resources

- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore Query Optimization](https://firebase.google.com/docs/firestore/query-data/queries)
- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon)
- [Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview/)

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial performance optimization strategy |

---

**Document Owner**: DATABASE-ADMIN Agent  
**Review Cycle**: Monthly  
**Next Review**: 2026-03-17
