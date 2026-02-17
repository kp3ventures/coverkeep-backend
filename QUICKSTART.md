# CoverKeep Backend - Quick Start Guide

Get up and running in 5 minutes!

## 1. Install Prerequisites

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Verify installation
firebase --version
node --version  # Should be 18+
```

## 2. Clone and Setup

```bash
# Clone repository
git clone https://github.com/kp3ventures/coverkeep-backend.git
cd coverkeep-backend

# Login to Firebase
firebase login

# Set project
firebase use coverkeep-af231

# Install dependencies
cd functions
npm install
```

## 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your keys:
# - OPENAI_API_KEY (for AI features)
```

## 4. Start Development

```bash
# Start Firebase emulators
firebase emulators:start
```

Emulators will be available at:
- **API**: http://localhost:5001/coverkeep-af231/us-central1/api
- **Firestore UI**: http://localhost:4000
- **Auth UI**: http://localhost:9099

## 5. Test API

Open a new terminal and test:

```bash
# Health check
curl http://localhost:5001/coverkeep-af231/us-central1/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-17T..."}
```

## 6. Create Test User

```bash
# Using Postman or curl:
curl -X POST http://localhost:5001/coverkeep-af231/us-central1/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User"
  }'
```

Save the returned `token` for authenticated requests.

## 7. Test Authenticated Endpoint

```bash
# List products (replace TOKEN with actual token)
curl http://localhost:5001/coverkeep-af231/us-central1/api/v1/products/user/USER_ID \
  -H "Authorization: Bearer TOKEN"
```

## Next Steps

- 📖 Read full [API Documentation](./docs/API.md)
- 🗄️ Review [Database Schema](./docs/SCHEMA.md)
- 🚀 Follow [Deployment Guide](./DEPLOYMENT.md)

## Common Commands

```bash
# Build TypeScript
npm run build

# Watch mode (auto-rebuild)
npm run build:watch

# Run tests
npm test

# Lint code
npm run lint

# Start emulators
firebase emulators:start

# Deploy to production
firebase deploy
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9

# Or use different ports in firebase.json
```

### Module Not Found
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
```

### Authentication Errors
- Verify you're logged into Firebase: `firebase login`
- Check project is set: `firebase use coverkeep-af231`
- Ensure you have project permissions

## Support

Questions? Issues?
- GitHub: https://github.com/kp3ventures/coverkeep-backend/issues
- Owner: KP3 (kp3ventures)

---

**Happy Coding! 🚀**
