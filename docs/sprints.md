# GMASAP API — Sprint Plan

This plan is optimized for **local dev first** (SAM Local + DynamoDB Local), with AWS deployment later once flows are stable.

## Sprint 1 — Auth + Local Hardening Baseline
**Goal:** Authentication is truly end-to-end locally, with stable dev ergonomics and predictable error handling.

### 1.1 Local run reliability (SAM + DynamoDB Local)
- Ensure DynamoDB Local works from SAM’s Dockerized Lambda runtime (no `localhost` networking traps)
- Confirm environment variables are documented and consistent (`env.json`)
- Make shared utilities layer stable (no custom code inside `node_modules` getting wiped by npm)

**Exit criteria**
- `sam build` + `sam local start-api --env-vars env.json` works
- `POST /auth/register` reaches DynamoDB Local and returns a successful response

### 1.2 Auth endpoints complete
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/profile` (protected)
- `PATCH /auth/profile` (protected)

**Exit criteria**
- Happy-path curl flow works: register → login → profile → patch profile
- Clear failure modes: missing fields, bad password, duplicate email, invalid token

### 1.3 Local-friendly events
EventBridge publishing is valuable, but shouldn’t break local dev.
- In local mode, either:
  - no-op event publishing (log-only), **or**
  - route to a localstack EventBridge endpoint (later)

**Exit criteria**
- Auth flows succeed locally even when AWS EventBridge isn’t configured

### 1.4 Minimal automated verification
- Update/extend `test-auth-flow.sh` to cover the full happy path

**Exit criteria**
- One script validates the entire auth flow locally

---

## Sprint 2 — Athlete Profiles MVP
**Goal:** Athletes can store and edit a core profile.

### Scope
- `GET /athletes/{userId}/profile`
- `PATCH /athletes/{userId}/profile` (owner-only)
- Minimal fields: sport, position, graduationYear, school, height/weight, bio, location

**Exit criteria**
- Athlete can update profile and fetch it back
- Authz enforced

---

## Sprint 3 — Feed MVP (including likes/comments)
**Goal:** A usable social feed with basic engagement.

### Scope
- `POST /feed/posts` (auth required)
- `GET /feed/posts` (pagination, newest-first)
- Likes:
  - `POST /feed/posts/{id}/like`
  - `DELETE /feed/posts/{id}/like`
- Comments (MVP):
  - `POST /feed/posts/{id}/comments`
  - `GET /feed/posts/{id}/comments` (optional, if needed for UI)

**Exit criteria**
- Create post → appears in feed
- Like/unlike works and is reflected
- Comment create works and is stored

---

## Sprint 4 — Media Upload MVP (presigned URLs)
**Goal:** Upload pipeline starts with a reliable “upload + metadata” flow (no heavy video processing yet).

### Scope
- Presigned upload URL generation
- Store metadata record in DynamoDB (who/what/when)

---

## Sprint 5 — Event-driven workflows (incremental)
**Goal:** EventBridge usage that adds value without adding fragility.

### Scope
- Publish key events reliably
- Add one real consumer (audit/logging/notifications stub)
