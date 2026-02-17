# CoverKeep API Documentation

## Base URL
- **Production**: `https://us-central1-coverkeep-af231.cloudfunctions.net/api`
- **Development**: `http://localhost:5001/coverkeep-af231/us-central1/api`

## Authentication

Most endpoints require Firebase Auth JWT tokens. Include in the Authorization header:

```
Authorization: Bearer <firebase-jwt-token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

---

## Endpoints

### Authentication

#### POST /api/v1/auth/signup
Create a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "uid": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors**:
- 400: Invalid email or weak password
- 409: Email already in use

---

#### POST /api/v1/auth/login
Authenticate a user.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "uid": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "isPremium": true,
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors**:
- 401: Invalid credentials
- 404: User not found

---

### Products

#### POST /api/v1/products
Create a new product entry.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "barcode": "012345678912",
  "name": "Samsung 65\" QLED TV",
  "manufacturer": "Samsung",
  "purchaseDate": "2025-12-01",
  "warrantyExpirationDate": "2026-12-01",
  "warrantyInfo": "1-year manufacturer warranty",
  "warrantyType": "limited",
  "imageUrl": "https://...",
  "receiptUrl": "https://..."
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "productId": "prod_xyz789",
    "userId": "abc123",
    "barcode": "012345678912",
    "name": "Samsung 65\" QLED TV",
    "manufacturer": "Samsung",
    "purchaseDate": "2025-12-01T00:00:00Z",
    "warrantyExpirationDate": "2026-12-01T00:00:00Z",
    "warrantyInfo": "1-year manufacturer warranty",
    "warrantyType": "limited",
    "imageUrl": "https://...",
    "receiptUrl": "https://...",
    "createdAt": "2026-02-17T10:00:00Z"
  }
}
```

**Errors**:
- 400: Invalid product data
- 401: Unauthorized

---

#### GET /api/v1/products/:id
Get product details by ID.

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "productId": "prod_xyz789",
    "userId": "abc123",
    "name": "Samsung 65\" QLED TV",
    ...
  }
}
```

**Errors**:
- 404: Product not found
- 403: Forbidden (not owner)

---

#### GET /api/v1/products/user/:userId
List all products for a user.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset
- `sortBy` (optional): `purchaseDate` or `warrantyExpirationDate` (default: `createdAt`)
- `order` (optional): `asc` or `desc` (default: `desc`)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "productId": "prod_xyz789",
        "name": "Samsung 65\" QLED TV",
        ...
      }
    ],
    "total": 15,
    "hasMore": false
  }
}
```

**Errors**:
- 403: Forbidden (requesting another user's products)

---

#### PUT /api/v1/products/:id
Update product details.

**Headers**: `Authorization: Bearer <token>`

**Request Body** (partial update):
```json
{
  "name": "Updated Product Name",
  "warrantyExpirationDate": "2027-01-01"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "productId": "prod_xyz789",
    "name": "Updated Product Name",
    ...
  }
}
```

---

#### DELETE /api/v1/products/:id
Delete a product.

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

### AI Services

#### POST /api/v1/ai/identify
Identify product from an image using OpenAI Vision.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "imageUrl": "https://storage.googleapis.com/...",
  "imageBase64": "data:image/jpeg;base64,..."
}
```

**Note**: Provide either `imageUrl` or `imageBase64`, not both.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "productName": "Samsung 65\" QLED TV Model QN65Q80A",
    "manufacturer": "Samsung",
    "category": "Electronics - Television",
    "confidence": "high",
    "suggestions": {
      "warrantyType": "limited",
      "typicalWarranty": "1 year manufacturer"
    }
  }
}
```

**Errors**:
- 400: Invalid image format
- 402: Premium feature required
- 500: AI service error

---

### Reminders

#### POST /api/v1/reminders/schedule
Schedule warranty expiration reminders for a product.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "productId": "prod_xyz789",
  "reminderTypes": ["6mo", "3mo", "1mo", "1week"]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "reminders": [
      {
        "reminderId": "rem_abc123",
        "reminderType": "6mo",
        "scheduledDate": "2026-06-01T00:00:00Z"
      },
      {
        "reminderId": "rem_def456",
        "reminderType": "3mo",
        "scheduledDate": "2026-09-01T00:00:00Z"
      },
      {
        "reminderId": "rem_ghi789",
        "reminderType": "1mo",
        "scheduledDate": "2026-11-01T00:00:00Z"
      },
      {
        "reminderId": "rem_jkl012",
        "reminderType": "1week",
        "scheduledDate": "2026-11-24T00:00:00Z"
      }
    ]
  }
}
```

**Errors**:
- 400: Invalid product or reminder type
- 404: Product not found

---

#### GET /api/v1/reminders/user/:userId
Get all reminders for a user.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `acknowledged` (optional): Filter by acknowledgment status (true/false)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "reminders": [
      {
        "reminderId": "rem_abc123",
        "productId": "prod_xyz789",
        "reminderType": "3mo",
        "scheduledDate": "2026-09-01T00:00:00Z",
        "acknowledged": false
      }
    ]
  }
}
```

---

### Claims

#### POST /api/v1/claims/draft
Create a warranty claim draft.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "productId": "prod_xyz789",
  "warrantyId": "war_abc456",
  "issueDescription": "Screen cracked after accidental drop",
  "estimatedValue": 800.00,
  "attachments": ["https://..."]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "claimId": "claim_ghi012",
    "productId": "prod_xyz789",
    "userId": "abc123",
    "warrantyId": "war_abc456",
    "claimDate": "2026-02-17T10:00:00Z",
    "claimStatus": "draft",
    "issueDescription": "Screen cracked after accidental drop",
    "estimatedValue": 800.00,
    "attachments": ["https://..."],
    "createdAt": "2026-02-17T10:00:00Z",
    "updatedAt": "2026-02-17T10:00:00Z"
  }
}
```

---

#### GET /api/v1/claims/:id
Get claim details.

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "claimId": "claim_ghi012",
    "productId": "prod_xyz789",
    "claimStatus": "submitted",
    ...
  }
}
```

---

#### PUT /api/v1/claims/:id
Update claim details.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "claimStatus": "submitted",
  "notes": "Submitted to SquareTrade, confirmation #ST123456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "claimId": "claim_ghi012",
    "claimStatus": "submitted",
    "notes": "Submitted to SquareTrade, confirmation #ST123456",
    "updatedAt": "2026-02-17T11:30:00Z"
  }
}
```

---

### Dashboard

#### GET /api/v1/dashboard/summary
Get user dashboard summary with key metrics.

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalProducts": 15,
    "activeWarranties": 12,
    "expiringWithin30Days": 2,
    "expiringWithin90Days": 5,
    "pendingReminders": 3,
    "activeClaims": 1,
    "claimsDrafts": 0,
    "recentProducts": [
      {
        "productId": "prod_xyz789",
        "name": "Samsung 65\" QLED TV",
        "warrantyExpirationDate": "2026-12-01T00:00:00Z"
      }
    ],
    "upcomingExpirations": [
      {
        "productId": "prod_abc123",
        "name": "iPhone 15 Pro",
        "warrantyExpirationDate": "2026-03-15T00:00:00Z",
        "daysUntilExpiration": 26
      }
    ]
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_REQUIRED | 401 | Authentication token required |
| AUTH_INVALID | 401 | Invalid or expired token |
| FORBIDDEN | 403 | User doesn't have access to resource |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Request validation failed |
| CONFLICT | 409 | Resource already exists |
| PREMIUM_REQUIRED | 402 | Premium subscription required |
| RATE_LIMIT | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |

---

## Rate Limiting

- **Free tier**: 100 requests per hour per user
- **Premium tier**: 1000 requests per hour per user
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Requests allowed per hour
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Pagination

For list endpoints:
- Use `limit` and `offset` query parameters
- Response includes `hasMore` boolean
- Maximum `limit` is 100

---

## Webhooks (Future Enhancement)

Planned webhook events:
- `warranty.expiring` - 30 days before expiration
- `reminder.sent` - When reminder is sent
- `claim.updated` - Claim status changed
