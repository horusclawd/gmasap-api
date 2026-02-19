# GMASAP API Architecture

> Event-driven serverless backend for the GMASAP athlete recruitment platform
> Generated: February 2026

## Overview

GMASAP (General Manager Athelte Search and Performance) is a platform connecting athletes with scouts, coaches, and recruiters. The API is built as an **event-driven serverless backend** on AWS.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Gateway                                  │
│                  (REST API with CORS)                                │
└─────────────────┬───────────────────┬─────────────────────────────────┘
                  │                   │
                  ▼                   ▼
         ┌───────────────┐  ┌───────────────┐
         │ Auth Function  │  │Athletes Func  │
         │   (Lambda)     │  │   (Lambda)    │
         └───────┬────────┘  └───────┬────────┘
                 │                   │
                 └─────────┬─────────┘
                           ▼
              ┌────────────────────────┐
              │  Shared Utilities      │
              │     (Lambda Layer)      │
              └────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌────────────┐
   │ DynamoDB │      │  Event   │      │     S3    │
   │  Tables  │      │  Bridge  │      │   Bucket   │
   └─────────┘      └──────────┘      └────────────┘
```

## Core Components

### 1. API Gateway
- **Type:** AWS::Serverless::Api
- **Stage:** dev/staging/prod (configurable)
- **CORS:** Enabled for all origins (development)
- **Routing:** `{proxy+}` wildcards for all paths
- **Auth:** Bearer token via Lambda authorizer (JWT)

### 2. Lambda Functions

| Function | Purpose | Status |
|----------|---------|--------|
| `AuthFunction` | User registration, login, profile management | ✅ Complete |
| `AthletesFunction` | Athlete profiles, videos, stats | 🔄 Phase 2 |
| `FeedFunction` | Social feed, posts, likes | 🔄 Sprint 1.3 |

### 3. DynamoDB Tables

**Users Table:**
- **PK:** `USER#{userId}`
- **SK:** `PROFILE | SETTINGS`
- **GSIs:** `email-index`, `provider-index`

**Posts Table:**
- **PK:** `POST#{postId}`
- **SK:** `METADATA | LIKE#{userId} | COMMENT#{commentId}`
- **GSIs:** `timestamp-index`, `author-index`

**Athletes Table:**
- **PK:** `ATHLETE#{userId}`
- **SK:** `PROFILE | VIDEO#{videoId} | STAT#{category}#{name}`
- **GSIs:** `sport-position-index`, `sport-graduation-index`, `state-sport-index`

### 4. Lambda Layer (SharedUtilities)

Mounted at `/opt/nodejs/shared/` in all functions:

| Module | Purpose |
|--------|---------|
| `dynamodb.js` | DynamoDB CRUD operations (DynamoDBService class) |
| `jwt.js` | JWT token generation/validation (JWTService class) |
| `response.js` | HTTP response formatting |
| `middleware.js` | Auth middleware, request validation |
| `events.js` | EventBridge publishing |
| `search.js` | DynamoDB search utilities |

### 5. EventBridge
- **Bus:** Custom event bus (`gmasap-{env}-events`)
- **Events Published:**
  - `UserRegistered` — Welcome flows
  - `UserLoggedIn` — Analytics
  - `UserProfileUpdated` — Audit trail
  - `PostCreated` — Feed updates
  - `VideoUploaded` — Processing pipeline

### 6. S3 Media Bucket
- **Purpose:** Store athlete videos, profile images
- **Features:**
  - CORS enabled for direct browser uploads
  - Lifecycle rules (30-day transition to Standard_IA)
  - Presigned URL pattern for secure uploads

## API Endpoints

### Authentication (`/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register new user |
| POST | `/auth/login` | ❌ | Login, get tokens |
| POST | `/auth/refresh` | ❌ | Refresh access token |
| POST | `/auth/logout` | ✅ | Logout |
| GET | `/auth/profile` | ✅ | Get current user profile |
| PATCH | `/auth/profile` | ✅ | Update profile |

### Athletes (`/athletes`) — Phase 2
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/athletes/{userId}/profile` | ❌ | Get athlete profile |
| PATCH | `/athletes/{userId}/profile` | ✅ | Update athlete profile |
| GET | `/athletes/{userId}/videos` | ❌ | List athlete videos |
| POST | `/athletes/{userId}/videos/upload/presigned` | ✅ | Get upload URL |
| POST | `/athletes/{userId}/videos` | ✅ | Add video metadata |
| DELETE | `/athletes/{userId}/videos/{videoId}` | ✅ | Delete video |

### Feed (`/feed`) — Sprint 1.3
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/feed/posts` | Optional | Get feed (paginated) |
| POST | `/feed/posts` | ✅ | Create post |
| POST | `/feed/posts/{id}/like` | ✅ | Toggle like |
| DELETE | `/feed/posts/{id}` | ✅ | Delete post |

## Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│   Auth   │────▶│ DynamoDB │
│          │◀────│ Function │◀────│ (Users)  │
└──────────┘     └──────────┘     └──────────┘
                      │
                      ▼
                 ┌──────────┐
                 │   JWT    │
                 │  Tokens  │
                 └──────────┘
```

1. **Register:** `POST /auth/register` → Creates user in DynamoDB → Returns JWT tokens
2. **Login:** `POST /auth/login` → Verifies password → Returns JWT tokens
3. **Protected requests:** Include `Authorization: Bearer {accessToken}`
4. **Token refresh:** `POST /auth/refresh` with `{refreshToken}`

**JWT Configuration:**
- Access token: 24-hour expiry
- Refresh token: 7-day expiry

## Cost Optimization Strategy

### Phase 1 (Current)
| Service | Original | Optimized | Savings |
|---------|----------|-----------|---------|
| OpenSearch | $35/mo | $0 (DynamoDB GSIs) | $35 |
| Custom Domain SSL | $0.50/mo | $0 (default endpoint) | $0.50 |
| **Total Phase 1** | ~$65/mo | **~$29/mo** | **~$36/mo** |

### Key Decisions
- **Search:** DynamoDB GSIs instead of OpenSearch
- **Real-time:** HTTP polling instead of AppSync (evaluate in Phase 2)
- **DynamoDB:** Pay-per-request (no provisioned capacity)
- **Lambda:** 256MB memory (optimal cost/performance)

### Future Scaling (Phase 2-3)
- Add **OpenSearch** only when search complexity demands it
- Add **AppSync** only when real-time engagement is proven
- Add **Aurora Serverless v2** only for complex analytics

## Local Development

### Prerequisites
- Docker (DynamoDB Local)
- AWS SAM CLI
- Node.js 20+

### Running Locally
```bash
# 1. Start DynamoDB Local
docker run --rm -p 8000:8000 amazon/dynamodb-local

# 2. Build SAM application
sam build

# 3. Start local API
sam local start-api --env-vars env.json --port 3000
```

### Testing Auth Flow
```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmasap.com","password":"pass123","firstName":"Test","lastName":"User","role":"athlete"}'

# Login (copy accessToken from response)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmasap.com","password":"pass123"}'

# Get profile (use accessToken)
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer {accessToken}"
```

## Project Structure

```
gmasap-api/
├── template.yaml                    # AWS SAM infrastructure definition
├── env.json                         # Local environment variables
├── package.json                     # Project dependencies
│
├── src/
│   ├── auth/
│   │   └── index.js                 # Auth Lambda handler
│   ├── athletes/
│   │   └── index.js                 # Athletes Lambda handler (Phase 2)
│   └── feed/
│       └── index.js                 # Feed Lambda handler (Sprint 1.3)
│
├── SharedUtilitiesLayer/
│   └── nodejs/
│       ├── package.json             # Layer dependencies
│       └── shared/                  # Shared code (mounted at /opt/nodejs/shared/)
│           ├── dynamodb.js
│           ├── jwt.js
│           ├── response.js
│           ├── middleware.js
│           ├── events.js
│           └── search.js
│
└── docs/
    ├── ARCHITECTURE_OPTIMIZATIONS.md
    ├── LOCAL_SETUP.md
    ├── sprints.md
    └── DEPLOYMENT.md
```

## Implementation Status

### ✅ Completed
- [x] SAM template with infrastructure
- [x] DynamoDB tables (Users, Posts, Athletes)
- [x] Auth Lambda with JWT
- [x] Shared utilities layer
- [x] Local development environment
- [x] EventBridge event publishing

### 🔄 In Progress
- [ ] Auth service deployment to AWS
- [ ] Feed endpoints (Sprint 1.3)
- [ ] Athlete profiles (Phase 2)

### 📋 Planned
- [ ] Video upload pipeline
- [ ] S3 presigned URLs
- [ ] Real-time features (Phase 2 evaluation)
- [ ] Advanced search (Phase 3)

## Security

- **Passwords:** Bcrypt hashed (cost factor 12)
- **Tokens:** JWT with issuer/audience validation
- **Authorization:** Route-level auth middleware
- **Input Validation:** All endpoints validate request body
- **CORS:** Configured per environment (strict in production)

## Monitoring

- **CloudWatch Logs:** All Lambda functions
- **CloudWatch Metrics:** Invocation counts, durations, errors
- **X-Ray:** Request tracing (future)
- **Custom Metrics:** Business events via EventBridge
