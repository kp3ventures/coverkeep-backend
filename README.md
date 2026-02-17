# CoverKeep Backend

Firebase backend for CoverKeep - Warranty Tracking Application

## Project Information
- **Firebase Project**: coverkeep-af231
- **Technology Stack**: 
  - Firebase Firestore (Database)
  - Firebase Functions (API Layer)
  - Firebase Auth (Authentication)
  - Node.js + TypeScript
  - Express.js

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Firebase CLI: `npm install -g firebase-tools`
- Firebase account with access to project `coverkeep-af231`

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kp3ventures/coverkeep-backend.git
   cd coverkeep-backend
   ```

2. **Install dependencies**
   ```bash
   cd functions
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

4. **Login to Firebase**
   ```bash
   firebase login
   firebase use coverkeep-af231
   ```

5. **Deploy Firestore rules and indexes**
   ```bash
   firebase deploy --only firestore
   ```

6. **Deploy functions**
   ```bash
   firebase deploy --only functions
   ```

### Local Development

1. **Start Firebase emulators**
   ```bash
   firebase emulators:start
   ```

2. **Run functions locally**
   ```bash
   cd functions
   npm run serve
   ```

3. **Access local services**
   - Functions: http://localhost:5001/coverkeep-af231/us-central1/api
   - Firestore UI: http://localhost:4000
   - Auth UI: http://localhost:9099

## API Documentation

### Base URL
- **Production**: `https://us-central1-coverkeep-af231.cloudfunctions.net/api`
- **Local**: `http://localhost:5001/coverkeep-af231/us-central1/api`

### Endpoints

#### Authentication
- `POST /api/v1/auth/signup` - Create new user account
- `POST /api/v1/auth/login` - Authenticate user

#### Products
- `POST /api/v1/products` - Create new product
- `GET /api/v1/products/:id` - Get product details
- `GET /api/v1/products/user/:userId` - List user's products
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Delete product

#### AI Services
- `POST /api/v1/ai/identify` - Identify product from image

#### Reminders
- `POST /api/v1/reminders/schedule` - Schedule warranty reminder

#### Claims
- `POST /api/v1/claims/draft` - Create warranty claim draft
- `GET /api/v1/claims/:id` - Get claim details
- `PUT /api/v1/claims/:id` - Update claim

#### Dashboard
- `GET /api/v1/dashboard/summary` - Get user dashboard summary

Full API documentation available in `docs/API.md`

## Database Schema

### Collections
- **users** - User accounts and profiles
- **products** - Product and warranty information
- **warranties** - Extended warranty details
- **reminders** - Warranty expiration reminders
- **claims** - Warranty claims and processing

Full schema documentation available in `docs/SCHEMA.md`

## Security

- Firestore security rules enforce user-level data isolation
- All API endpoints require Firebase Auth JWT tokens (except signup/login)
- Premium features use custom claims validation
- See `firestore.rules` for complete security configuration

## Project Structure

```
coverkeep-backend/
├── functions/
│   ├── src/
│   │   ├── api/           # API route handlers
│   │   ├── middleware/    # Express middleware
│   │   ├── services/      # Business logic
│   │   ├── models/        # Data models
│   │   ├── utils/         # Helper functions
│   │   └── index.ts       # Functions entry point
│   ├── package.json
│   └── tsconfig.json
├── firestore.rules        # Security rules
├── firestore.indexes.json # Database indexes
├── firebase.json          # Firebase config
└── .env.example           # Environment template
```

## Testing

```bash
cd functions
npm test
```

## Deployment

### Deploy everything
```bash
firebase deploy
```

### Deploy specific components
```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/kp3ventures/coverkeep-backend/issues
- Owner: KP3 (kp3ventures)

## License

MIT
