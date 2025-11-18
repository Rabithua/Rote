# Rote Backend Initialization Tests

This directory contains comprehensive test scripts for the Rote backend initialization process.

## 📁 Files

- `testInitialization.ts` - Complete test suite for initialization process
- `quickTest.ts` - Quick validation test for basic functionality
- `runTests.sh` - Shell script to run tests with various options
- `testConfig.json` - Test configuration and expected results
- `uploadr2.ts` - R2 storage upload script (updated for config manager)
- `downloadr2.ts` - R2 storage download script (updated for config manager)

## 🚀 Quick Start

### Prerequisites

1. Ensure the Rote backend server is running:

   ```bash
   npm run dev
   ```

2. Make sure the database is accessible and migrations are applied.

### Running Tests

#### Option 1: Using npm scripts (Recommended)

```bash
# Run quick test only
npm run test:quick

# Run full test suite
npm run test:init

# Run all tests
npm run test:all
```

#### Option 2: Using shell script

```bash
# Make script executable
chmod +x scripts/runTests.sh

# Run all tests
./scripts/runTests.sh

# Run quick test only
./scripts/runTests.sh --quick

# Run full test suite only
./scripts/runTests.sh --full

# Wait for server to be ready
./scripts/runTests.sh --wait

# Show help
./scripts/runTests.sh --help
```

#### Option 3: Direct execution

```bash
# Quick test
npx ts-node scripts/quickTest.ts

# Full test suite
npx ts-node scripts/testInitialization.ts
```

## 🧪 Test Coverage

### Quick Test (`quickTest.ts`)

Tests the essential initialization flow:

1. **Database Cleanup** - Clears existing configuration
2. **System Status Check** - Verifies initial state
3. **System Initialization** - Tests the setup process
4. **Configuration Retrieval** - Tests config loading
5. **Configuration Update** - Tests config modification
6. **Middleware Testing** - Tests configuration middleware
7. **Login Test** - Tests authentication with generated keys

### Full Test Suite (`testInitialization.ts`)

Comprehensive testing including:

1. **System Status** - Initial and post-initialization state
2. **System Initialization** - Complete setup process
3. **Configuration Management** - Get, update, test configurations
4. **URL Management** - Detect and update URLs
5. **Middleware Testing** - Storage, security, notification middleware
6. **Hot Updates** - Configuration hot-reloading
7. **Error Handling** - Various error scenarios

## ⚙️ Configuration

### Environment Variables

- `TEST_BASE_URL` - Base URL for testing (default: `http://localhost:3000`)
- `WAIT_TIME` - Time to wait for server readiness (default: 5 seconds)

### Test Data

Test data is defined in `testConfig.json`:

```json
{
  "testData": {
    "site": {
      "name": "Rote Test Site",
      "url": "https://test.rote.ink",
      "description": "Test site for Rote initialization testing",
      "defaultLanguage": "en"
    },
    "storage": {
      "endpoint": "https://test-account.r2.cloudflarestorage.com",
      "bucket": "test-bucket",
      "accessKeyId": "test-access-key-id",
      "secretAccessKey": "test-secret-access-key",
      "urlPrefix": "https://test.example.com"
    },
    "ui": {
      "allowRegistration": true,
      "defaultUserRole": "user",
      "apiRateLimit": 100,
      "allowUploadFile": true
    },
    "admin": {
      "username": "testadmin",
      "email": "admin@test.com",
      "password": "TestPassword123!",
      "nickname": "Test Administrator"
    }
  }
}
```

## 📊 Expected Results

### Before Initialization

- `initialized`: `false`
- `missingConfigs`: `["site", "storage", "security", "ui"]`
- `databaseConnected`: `true`
- `hasAdminUser`: `false`

### After Initialization

- `initialized`: `true`
- `missingConfigs`: `[]`
- `databaseConnected`: `true`
- `hasAdminUser`: `true`

## 🔧 Troubleshooting

### Common Issues

1. **Server Not Running**

   ```
   Error: Server is not running or not responding
   ```

   **Solution**: Start the server with `npm run dev`

2. **Database Connection Failed**

   ```
   Error: Database connection test failed
   ```

   **Solution**: Check `DATABASE_URL` environment variable and ensure database is running

3. **Configuration Test Failed**

   ```
   Error: Storage configuration test failed
   ```

   **Solution**: This is expected for test credentials, the test validates the API structure

4. **Permission Denied (Shell Script)**
   ```
   Permission denied: ./scripts/runTests.sh
   ```
   **Solution**: Run `chmod +x scripts/runTests.sh`

### Debug Mode

For detailed debugging, you can modify the test scripts to include more verbose logging:

```typescript
// In testInitialization.ts or quickTest.ts
console.log('Request URL:', url);
console.log('Request Data:', data);
console.log('Response Status:', response.status);
console.log('Response Data:', response.data);
```

## 📝 Test Results

### Success Output

```
🚀 Starting Rote Backend Initialization Tests

Testing against: http://localhost:3000/v2

✅ Cleanup: Database configuration cleaned up
✅ System Status Check: System status retrieved
✅ System Initialization: System initialized successfully
✅ Get All Configs: All configurations retrieved
✅ Config Update: Configuration updated successfully
✅ Storage Config Test: Storage configuration test completed
✅ URL Detection: URLs detected successfully
✅ URL Update: URLs updated successfully
✅ Storage Middleware (No Auth): Storage middleware passed, auth middleware blocked (expected)
✅ Security Middleware (Login): Security middleware allowed login with valid credentials
✅ Hot Update: Configuration hot update successful

📊 Test Results Summary:
==================================================
Total Tests: 11
✅ Passed: 11
❌ Failed: 0
Success Rate: 100.0%

🎉 Initialization testing completed!
```

### Failure Output

```
❌ System Initialization: Failed to initialize system
   Error: System has already been initialized

📊 Test Results Summary:
==================================================
Total Tests: 11
✅ Passed: 10
❌ Failed: 1
Success Rate: 90.9%

❌ Failed Tests:
  - System Initialization: Failed to initialize system
    Error: System has already been initialized

🎉 Initialization testing completed!
```

## 🔄 Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Initialization Tests
  run: |
    npm run dev &
    sleep 10
    npm run test:all
```

## 📚 Related Documentation

- [Configuration Management](../utils/config.ts)
- [Admin API Routes](../route/v2/admin.ts)
- [Configuration Middleware](../middleware/configCheck.ts)
- [Database Schema](../drizzle/schema.ts)
