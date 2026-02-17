# GMASAP API - Local Development Setup

This guide provides complete terminal commands to set up and run the GMASAP API locally for development and testing.

## Prerequisites

- Docker Desktop installed and running
- AWS CLI v2 installed and configured
- AWS SAM CLI installed (latest version)
- Node.js 20+ installed
- Git installed

## Quick Start Commands

Copy and paste these commands in sequence to get the API running locally.

### 1. Start DynamoDB Local

```bash
# Start DynamoDB Local container
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest

# Verify it's running
docker ps | grep dynamodb-local
```

### 2. Create DynamoDB Tables

```bash
# Navigate to project directory
cd /path/to/gmasap-api

# Create Users table
aws dynamodb create-table \
    --table-name gmasap-dev-users \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=email,AttributeType=S \
        AttributeName=provider,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        IndexName=email-index,KeySchema='[{AttributeName=email,KeyType=HASH}]',Projection='{ProjectionType=ALL}',BillingMode=PAY_PER_REQUEST \
        IndexName=provider-index,KeySchema='[{AttributeName=provider,KeyType=HASH},{AttributeName=email,KeyType=RANGE}]',Projection='{ProjectionType=ALL}',BillingMode=PAY_PER_REQUEST \
    --billing-mode PAY_PER_REQUEST \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    --endpoint-url http://localhost:8000

# Create Posts table
aws dynamodb create-table \
    --table-name gmasap-dev-posts \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=timestamp,AttributeType=N \
        AttributeName=author,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        IndexName=timestamp-index,KeySchema='[{AttributeName=timestamp,KeyType=HASH}]',Projection='{ProjectionType=ALL}',BillingMode=PAY_PER_REQUEST \
        IndexName=author-index,KeySchema='[{AttributeName=author,KeyType=HASH},{AttributeName=timestamp,KeyType=RANGE}]',Projection='{ProjectionType=ALL}',BillingMode=PAY_PER_REQUEST \
    --billing-mode PAY_PER_REQUEST \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    --endpoint-url http://localhost:8000

# Create Athletes table
aws dynamodb create-table \
    --table-name gmasap-dev-athletes \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=sport,AttributeType=S \
        AttributeName=position,AttributeType=S \
        AttributeName=graduationYear,AttributeType=N \
        AttributeName=state,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        IndexName=sport-position-index,KeySchema='[{AttributeName=sport,KeyType=HASH},{AttributeName=position,KeyType=RANGE}]',Projection='{ProjectionType=ALL}',BillingMode=PAY_PER_REQUEST \
        IndexName=sport-graduation-index,KeySchema='[{AttributeName=sport,KeyType=HASH},{AttributeName=graduationYear,KeyType=RANGE}]',Projection='{ProjectionType=ALL}',BillingMode=PAY_PER_REQUEST \
        IndexName=state-sport-index,KeySchema='[{AttributeName=state,KeyType=HASH},{AttributeName=sport,KeyType=RANGE}]',Projection='{ProjectionType=ALL}',BillingMode=PAY_PER_REQUEST \
    --billing-mode PAY_PER_REQUEST \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    --endpoint-url http://localhost:8000

# Verify tables were created
aws dynamodb list-tables --endpoint-url http://localhost:8000
```

### 3. Build and Start the API

```bash
# Build the SAM application (includes Lambda Layer)
sam build

# Start the local API server
sam local start-api --env-vars env.json --host 0.0.0.0 --port 3000

# The API will be available at: http://localhost:3000
```

### 4. Test Authentication Endpoints

Open a new terminal window and run these curl commands:

```bash
# Register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "firstName": "Test",
    "lastName": "User",
    "role": "athlete"
  }'

# Login with the user
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'

# Save the accessToken from login response, then get profile
export ACCESS_TOKEN="your_access_token_here"

curl -X GET http://localhost:3000/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Update profile
curl -X PATCH http://localhost:3000/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "firstName": "Updated",
    "bio": "This is my updated bio"
  }'

# Test logout
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 5. Test Other Endpoints

```bash
# Test Athletes endpoint (placeholder - will return 501)
curl -X GET http://localhost:3000/athletes/user123/profile

# Test Feed endpoint (placeholder - will return 501)
curl -X GET http://localhost:3000/feed/posts
```

## Running Test Suite

```bash
# Run the automated test script
chmod +x test-auth-flow.sh
./test-auth-flow.sh

# Or run individual tests manually using the curl commands above
```

## Development Workflow

### Making Changes

1. **For Lambda function code changes:**
   ```bash
   # Make your changes to src/auth/index.js, src/athletes/index.js, etc.
   sam build
   # No need to restart - SAM will reload automatically
   ```

2. **For shared utilities changes:**
   ```bash
   # Make changes to layers/shared/nodejs/node_modules/shared/*.js
   sam build
   # Restart sam local start-api for layer changes to take effect
   ```

3. **For template.yaml changes:**
   ```bash
   # Make your changes
   sam build
   sam local start-api --env-vars env.json --host 0.0.0.0 --port 3000
   ```

### Viewing Logs

```bash
# In a separate terminal, view CloudWatch-like logs
sam logs --stack-name gmasap-dev --tail

# Or check Docker container logs
docker logs -f $(docker ps -q --filter ancestor=public.ecr.aws/sam/emulation-nodejs20.x)
```

## Cleanup and Reset

### Stop Services

```bash
# Stop SAM local API (Ctrl+C in the terminal running sam local start-api)

# Stop and remove DynamoDB Local container
docker stop dynamodb-local
docker rm dynamodb-local

# Clean up SAM build artifacts
rm -rf .aws-sam/
```

### Reset Database

```bash
# Delete all data (restart with fresh database)
docker stop dynamodb-local
docker rm dynamodb-local

# Then run the setup commands again from step 1
```

### Full Reset

```bash
# Clean everything
docker stop dynamodb-local
docker rm dynamodb-local
rm -rf .aws-sam/
rm -rf node_modules/
rm -rf src/*/node_modules/
rm -rf layers/*/node_modules/

# Then run through the entire setup again
```

## Troubleshooting

### Common Issues

1. **Port 8000 already in use:**
   ```bash
   lsof -ti:8000 | xargs kill -9
   ```

2. **Port 3000 already in use:**
   ```bash
   lsof -ti:3000 | xargs kill -9
   # Or use a different port: sam local start-api --port 3001
   ```

3. **DynamoDB connection errors:**
   ```bash
   # Verify DynamoDB Local is running
   curl http://localhost:8000/shell/
   # Should return DynamoDB Local web shell
   ```

4. **Lambda Layer not found:**
   ```bash
   # Rebuild with verbose output
   sam build --debug
   # Check that layers/shared/package.json exists
   ```

5. **Permission denied errors:**
   ```bash
   # Fix permissions
   chmod +x test-auth-flow.sh
   sudo chown -R $USER:$USER .aws-sam/
   ```

6. **Module not found errors:**
   ```bash
   # Clean build and rebuild
   rm -rf .aws-sam/
   sam build --use-container
   ```

### Environment Variables

If you need to modify environment variables:

```bash
# Edit env.json file
cat env.json

# The file should contain:
{
  "Parameters": {
    "Environment": "dev"
  }
}
```

### Logs and Debugging

```bash
# Enable verbose SAM logging
export SAM_CLI_DEBUG=1
sam local start-api --env-vars env.json --debug

# View function logs in real-time
sam logs --name AuthFunction --stack-name gmasap-dev --tail

# Test with detailed curl output
curl -v -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"debug@test.com","password":"test123","firstName":"Debug","lastName":"User","role":"athlete"}'
```

### Docker Issues

```bash
# If Docker containers are having issues
docker system prune -f
docker pull amazon/dynamodb-local:latest
docker pull public.ecr.aws/sam/emulation-nodejs20.x:latest
```

## IDE Setup

### VS Code Extensions

Install these extensions for better development experience:

- AWS Toolkit
- AWS SAM
- DynamoDB Viewer
- REST Client (for .http files)

### Environment Setup

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export SAM_CLI_TELEMETRY=0
alias sam-start='sam local start-api --env-vars env.json --host 0.0.0.0 --port 3000'
alias dynamo-start='docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest'
alias dynamo-stop='docker stop dynamodb-local && docker rm dynamodb-local'
```

## Production Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Lambda Layer Architecture

This project uses AWS Lambda Layers to share common utilities across all functions:

- **Layer Location:** `layers/shared/nodejs/node_modules/shared/`
- **Runtime Path:** `/opt/nodejs/node_modules/shared/`
- **Shared Modules:** dynamodb.js, jwt.js, response.js, middleware.js, events.js, search.js
- **Layer Dependencies:** AWS SDK packages, jsonwebtoken

This architecture reduces code duplication, improves deployment speed, and makes dependency management easier.