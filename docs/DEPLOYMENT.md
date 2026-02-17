# GMASAP API Deployment Guide

## Sprint 1.1 - First Deployment

### Prerequisites

1. **AWS CLI configured** with appropriate permissions:
```bash
aws configure
# Enter your access key, secret key, region (us-east-1), and output format (json)
```

2. **AWS SAM CLI installed**:
```bash
brew install aws-sam-cli
```

3. **Docker running** (for local testing):
```bash
docker --version
```

### Step 1: Initialize and Test Locally

```bash
# Navigate to project directory
cd tmp/work/gmasap-api

# Install dependencies for all functions
npm install

# Start DynamoDB Local (in a separate terminal)
docker run -p 8000:8000 amazon/dynamodb-local

# Start SAM local API
sam local start-api --port 3000 --env-vars env.json

# Test in another terminal
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123","firstName":"Test","lastName":"User","role":"athlete"}'
```

### Step 2: Build for Deployment

```bash
# Build the SAM application
sam build

# Validate the template
sam validate
```

### Step 3: Deploy to AWS

```bash
# First deployment (guided)
sam deploy --guided --stack-name gmasap-dev

# Follow the prompts:
# - Stack name: gmasap-dev
# - AWS Region: us-east-1
# - Parameter Environment: dev
# - Parameter DomainName: api-dev.gmasap.com (or skip custom domain for now)
# - Confirm changes before deploy: Y
# - Allow SAM to create IAM roles: Y
# - Save parameters to samconfig.toml: Y

# Subsequent deployments
sam deploy
```

### Step 4: Test Deployed API

```bash
# Get the API URL from CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name gmasap-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`GmasapApiUrl`].OutputValue' \
  --output text

# Test the deployed API
curl -X POST https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmasap.com","password":"securepassword123","firstName":"John","lastName":"Doe","role":"athlete"}'
```

### Step 5: View Logs

```bash
# View logs for Auth function
sam logs -n AuthFunction --stack-name gmasap-dev --tail

# View logs with filter
sam logs -n AuthFunction --stack-name gmasap-dev --filter "ERROR"
```

### Troubleshooting

#### Common Issues

1. **Permissions Error**: Make sure your AWS user has permissions for:
   - CloudFormation
   - Lambda
   - DynamoDB
   - S3
   - EventBridge
   - IAM (for role creation)

2. **Docker Not Running**: 
   ```bash
   # Start Docker Desktop or Docker daemon
   docker info
   ```

3. **Port Already in Use**:
   ```bash
   # Kill process using port 3000
   lsof -ti:3000 | xargs kill -9
   ```

4. **SSL Certificate Issues**: 
   - Skip custom domain for initial deployment
   - Set `DomainName` parameter to empty string

#### Clean Up Resources

```bash
# Delete the entire stack
aws cloudformation delete-stack --stack-name gmasap-dev
```

### Monitoring

1. **CloudWatch Logs**: 
   - `/aws/lambda/gmasap-dev-auth`
   - `/aws/lambda/gmasap-dev-athletes`
   - `/aws/lambda/gmasap-dev-feed`

2. **DynamoDB Tables**:
   - `gmasap-dev-users`
   - `gmasap-dev-posts`
   - `gmasap-dev-athletes`

3. **S3 Bucket**:
   - `gmasap-dev-media-{account-id}`

4. **EventBridge Bus**:
   - `gmasap-dev-events`

### Next Steps After Deployment

1. **Test all auth endpoints**
2. **Set up monitoring alerts**
3. **Configure custom domain** (if needed)
4. **Update frontend to use deployed API**
5. **Move to Sprint 1.2**: Complete auth implementation

### Environment-Specific Deployments

```bash
# Staging
sam deploy --parameter-overrides Environment=staging DomainName=api-staging.gmasap.com

# Production
sam deploy --parameter-overrides Environment=prod DomainName=api.gmasap.com
```

## Sprint 1.2 Goals

After successful Sprint 1.1 deployment:

1. Complete auth middleware implementation
2. Add profile update endpoint
3. Test end-to-end authentication flow
4. Prepare for Sprint 1.3 feed implementation

## Success Criteria for Sprint 1.1

- ✅ SAM template deploys successfully
- ✅ All Lambda functions are created
- ✅ DynamoDB tables are accessible
- ✅ Auth register/login endpoints work
- ✅ EventBridge events are published
- ✅ Local development environment functional
- ✅ AWS resources under $70/month cost