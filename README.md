# GMASAP API Backend

Event-driven serverless backend for the GMASAP athlete recruitment platform.

## Architecture

- **AWS SAM** - Serverless Application Model for infrastructure
- **Lambda Functions** - Microservices for different domains
- **DynamoDB** - NoSQL database with GSI indexes
- **EventBridge** - Event-driven architecture
- **S3** - Media storage with presigned URLs
- **API Gateway** - REST API with custom domain

## Development Phases (Optimized)

### Phase 1: Core Infrastructure & Auth (Weeks 1-3) ✅
- **Sprint 1.1**: Project setup with SAM template ✅
- **Sprint 1.2**: Authentication service (in progress)
- **Sprint 1.3**: Feed service + Basic search with DynamoDB GSIs

### Phase 2: Athletes & Media Processing (Weeks 4-6)
- Athlete profiles and video management
- Video processing pipeline with Step Functions
- **Decision Point**: OpenSearch vs enhanced DynamoDB patterns

### Phase 3: Real-Time & Messaging (Weeks 7-9)
- **Decision Point**: AppSync real-time vs HTTP polling
- Direct messaging system
- Push notifications

### Phase 4: Scout Features & Advanced Search (Weeks 10-12)
- Scout dashboard and watchlists
- Advanced search (OpenSearch if justified)
- Production hardening

## Architectural Optimizations 🎯

**Cost-First Approach**: Defer expensive services until usage justifies them
- **Phase 1**: DynamoDB GSIs for search (vs $35/mo OpenSearch)
- **Phase 2**: HTTP polling for updates (vs AppSync complexity)
- **Phase 3**: Add real-time/search only when necessary

## Project Structure (key bits)

```
gmasap-api/
├── template.yaml
├── env.json                           # local env for sam local
├── src/
│   ├── auth/                          # Auth Lambda
│   ├── athletes/                      # Athletes Lambda
│   └── feed/                          # Feed Lambda
├── SharedUtilitiesLayer/
│   └── nodejs/
│       ├── shared/                    # OUR shared code (mounted at /opt/nodejs/shared)
│       ├── node_modules/              # deps for shared layer (jsonwebtoken, aws sdk, etc.)
│       └── package.json
└── docs/                              # project docs + sprint notes
```

## Local Development Setup

### Prereqs
- AWS SAM CLI
- Docker
- Node.js (for installing layer deps)

### Running locally (DynamoDB Local + SAM)

1) Start DynamoDB Local:
```bash
docker run --rm -p 8000:8000 amazon/dynamodb-local
```

2) Install shared layer deps (one-time / when package.json changes):
```bash
cd SharedUtilitiesLayer/nodejs
npm install
cd ../..
```

3) Build + run SAM locally:
```bash
sam build
sam local start-api --port 3000 --env-vars env.json
```

### Notes
- Under `sam local`, Lambda runs in Docker. So **do not use `localhost:8000`** for DynamoDB.
  Use `DYNAMODB_ENDPOINT` (set in env.json) which defaults to `http://host.docker.internal:8000`.
- Lambdas import shared code from the layer via absolute paths, e.g.:
  `require('/opt/nodejs/shared/dynamodb')`
- Routing uses `event.path` (not `event.resource`) so `/auth/register` matches as expected.

### Quick test
```bash
curl -X POST http://127.0.0.1:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmasap.com","password":"securepass123","firstName":"Test","lastName":"User","role":"athlete"}'
```

### Deploying to AWS

```bash
# Build the application
sam build

# Deploy (first time)
sam deploy --guided --stack-name gmasap-dev

# Deploy updates
sam deploy
```

## Environment Variables

Create `env.json` for local development:

```json
{
  "AuthFunction": {
    "USERS_TABLE": "gmasap-dev-users",
    "POSTS_TABLE": "gmasap-dev-posts", 
    "ATHLETES_TABLE": "gmasap-dev-athletes",
    "MEDIA_BUCKET": "gmasap-dev-media",
    "EVENT_BUS_NAME": "gmasap-dev-events",
    "NODE_ENV": "development",
    "JWT_SECRET": "dev-secret-key"
  }
}
```

## API Endpoints

### Authentication (`/auth`)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout
- `PATCH /auth/profile` - Update profile

### Athletes (`/athletes`) - Phase 2
- `GET /athletes/{userId}/profile`
- `PATCH /athletes/{userId}/profile`
- `GET /athletes/{userId}/videos`
- `POST /athletes/{userId}/videos`

### Feed (`/feed`) - Sprint 1.3
- `GET /feed/posts`
- `POST /feed/posts`
- `POST /feed/posts/{id}/like`
- `DELETE /feed/posts/{id}`

## Database Schema

### Users Table
```
PK: USER#{userId}
SK: PROFILE | SETTINGS
GSI: email-index, provider-index
```

### Posts Table
```
PK: POST#{postId}
SK: METADATA | LIKE#{userId} | COMMENT#{commentId}
GSI: timestamp-index, author-index
```

### Athletes Table
```
PK: ATHLETE#{userId}
SK: PROFILE | VIDEO#{videoId} | STAT#{category}#{name}
GSI: sport-position-index
```

## Event-Driven Architecture

Events published to EventBridge:
- `UserRegistered` → Welcome email
- `PostCreated` → Feed updates
- `VideoUploaded` → Processing pipeline
- `MessageSent` → Push notifications

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```

## Monitoring

- CloudWatch Logs for all Lambda functions
- CloudWatch Metrics for performance
- X-Ray tracing for request flow
- Custom business metrics

## Security

- JWT-based authentication
- CORS enabled for web app
- Input validation on all endpoints
- Rate limiting via API Gateway
- WAF protection (production)

## Cost Optimization 💰

**Phase 1 Savings** (vs original plan):
- ✅ **$35/month saved**: DynamoDB GSIs instead of OpenSearch Serverless
- ✅ **$0.50/month saved**: Default API Gateway endpoint vs custom domain
- ✅ **Total Phase 1**: ~$29/month vs $65/month original

**Additional optimizations**:
- Pay-per-request DynamoDB (no fixed costs)
- Lambda with right-sized memory (256MB optimal)
- S3 lifecycle policies (30-day IA transition)
- EventBridge pay-per-event model

## Sprint 1.1 Checklist ✅

- [x] SAM template with core infrastructure
- [x] DynamoDB tables (Users, Posts, Athletes)
- [x] Lambda functions (Auth, Athletes, Feed)
- [x] EventBridge custom bus
- [x] S3 media bucket
- [x] Shared utilities
- [x] Error handling middleware
- [x] JWT authentication utilities
- [x] Event publishing service
- [x] Local development environment
- [ ] First successful deployment

## Next Steps (Sprint 1.2)

1. Deploy the SAM template to AWS
2. Implement complete auth endpoints
3. Add auth middleware to protected routes
4. Test end-to-end authentication flow
5. Update frontend to use real API endpoints