# CoverKeep Backend Deployment Guide

## Prerequisites

1. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase --version  # Should be 12.0.0 or higher
   ```

2. **Node.js 18+**
   ```bash
   node --version  # Should be v18.x or higher
   ```

3. **Firebase Project Access**
   - Project ID: `coverkeep-af231`
   - You must have Owner or Editor role

## Initial Setup

### 1. Login to Firebase
```bash
firebase login
```

### 2. Set Active Project
```bash
cd coverkeep-backend
firebase use coverkeep-af231
```

### 3. Install Dependencies
```bash
cd functions
npm install
```

### 4. Configure Environment Variables

Create `.env` file in `functions/` directory:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `OPENAI_API_KEY` - Your OpenAI API key
- Other credentials as needed

### 5. Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project `coverkeep-af231`
3. Go to Project Settings > Service Accounts
4. Click "Generate New Private Key"
5. Save as `functions/serviceAccountKey.json`

**⚠️ NEVER commit this file to git!**

## Deployment Steps

### Deploy Firestore Rules and Indexes (First Time)
```bash
firebase deploy --only firestore
```

This will:
- Deploy security rules from `firestore.rules`
- Create database indexes from `firestore.indexes.json`

### Deploy Cloud Functions
```bash
firebase deploy --only functions
```

This will:
- Build TypeScript code
- Deploy all HTTP functions
- Deploy scheduled functions (reminders, cleanup)

### Deploy Everything
```bash
firebase deploy
```

## Testing Before Deployment

### 1. Run Local Emulators
```bash
firebase emulators:start
```

This starts:
- Functions: http://localhost:5001/coverkeep-af231/us-central1/api
- Firestore: http://localhost:8080
- Auth: http://localhost:9099
- Emulator UI: http://localhost:4000

### 2. Test API Endpoints

Use Postman, curl, or your frontend to test against:
```
http://localhost:5001/coverkeep-af231/us-central1/api/v1/...
```

Example:
```bash
curl http://localhost:5001/coverkeep-af231/us-central1/api/health
```

### 3. Run Unit Tests
```bash
cd functions
npm test
```

### 4. Lint Code
```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

## Production Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Environment variables configured
- [ ] Service account key downloaded (`.gitignored`)
- [ ] Code reviewed and approved
- [ ] Database indexes deployed
- [ ] Security rules tested and deployed
- [ ] API endpoints tested in emulator
- [ ] Documentation updated

## Post-Deployment Verification

### 1. Check Function Deployment
```bash
firebase functions:list
```

Expected functions:
- `api` (HTTP)
- `sendReminders` (scheduled)
- `cleanupReminders` (scheduled)

### 2. Test Production API

Base URL: `https://us-central1-coverkeep-af231.cloudfunctions.net/api`

Test health endpoint:
```bash
curl https://us-central1-coverkeep-af231.cloudfunctions.net/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-17T14:30:00.000Z"
}
```

### 3. Monitor Logs
```bash
firebase functions:log
```

Or view in [Firebase Console](https://console.firebase.google.com/project/coverkeep-af231/functions/logs)

### 4. Check Firestore Rules
In Firebase Console:
- Go to Firestore Database
- Click "Rules" tab
- Verify rules are deployed

### 5. Verify Scheduled Functions
In Firebase Console:
- Go to Cloud Functions
- Check that scheduled functions show "Next run" times

## Rollback Procedure

If deployment fails or causes issues:

### 1. Check Previous Versions
```bash
firebase functions:list --detailed
```

### 2. Delete Problematic Functions (if needed)
```bash
firebase functions:delete FUNCTION_NAME
```

### 3. Redeploy Previous Version
```bash
git checkout <previous-commit>
firebase deploy --only functions
```

### 4. Restore Firestore Rules (if needed)
```bash
git checkout <previous-commit>
firebase deploy --only firestore:rules
```

## Monitoring and Maintenance

### View Function Logs
```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only api

# Follow logs in real-time
firebase functions:log --follow
```

### Check Function Performance
View in Firebase Console:
- Functions > Dashboard
- Monitor invocations, errors, execution time

### Update Dependencies
```bash
cd functions
npm outdated
npm update
npm audit fix
```

### Backup Firestore Data
```bash
gcloud firestore export gs://coverkeep-af231-backups/$(date +%Y%m%d)
```

## Troubleshooting

### Build Errors
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Permission Errors
- Verify you have correct Firebase project access
- Check service account key is valid
- Ensure IAM roles are configured correctly

### Function Timeout
- Default timeout is 60s
- Increase in `firebase.json` if needed:
```json
{
  "functions": {
    "timeoutSeconds": 300
  }
}
```

### Memory Errors
- Default memory is 256MB
- Increase in function config if needed

### CORS Errors
- Check `cors` middleware is enabled
- Verify frontend origin is allowed
- Check Firestore rules for read/write permissions

## Security Best Practices

1. **Never commit secrets**
   - Use `.env` for local development
   - Use Firebase Functions config for production
   - Service account keys should be `.gitignored`

2. **Keep dependencies updated**
   ```bash
   npm audit
   npm audit fix
   ```

3. **Review Firestore rules regularly**
   - Test rules with Firebase Emulator
   - Use principle of least privilege

4. **Monitor for suspicious activity**
   - Set up alerts for unusual traffic
   - Monitor authentication attempts
   - Track API usage patterns

## Support

- GitHub Issues: https://github.com/kp3ventures/coverkeep-backend/issues
- Firebase Documentation: https://firebase.google.com/docs
- Owner: KP3 (kp3ventures)
