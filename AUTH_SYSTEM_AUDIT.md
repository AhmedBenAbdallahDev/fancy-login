# Anvil Authentication System Audit

**Date:** December 28, 2025  
**Status:** ✅ Fixed & Verified

---

## Overview

Anvil supports two distinct authentication methods, each with its own storage backend:

| Auth Type | Storage | Use Case |
|-----------|---------|----------|
| **Email/Password** | PostgreSQL | Normal users who want to become creators |
| **GitHub/Offline** | DiffDB (GitHub repos) | Power users who want full data ownership |

---

## Authentication Flows

### 1. Email/Password Users (PostgreSQL)

```
┌──────────────────────────────────────────────────────────────┐
│                    EMAIL USER FLOW                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Sign-in Page                                                │
│       │                                                      │
│       ▼                                                      │
│  Click "Join Now"                                            │
│       │                                                      │
│       ▼                                                      │
│  AuthModal (Sign Up tab)                                     │
│  - Email                                                     │
│  - Password (8+ chars)                                       │
│  - Name auto-generated (e.g., "SwiftCreator4231")            │
│       │                                                      │
│       ▼                                                      │
│  Account created in PostgreSQL                               │
│       │                                                      │
│       ▼                                                      │
│  ChooseUsernameModal (REQUIRED - cannot dismiss)             │
│  - Pick unique @username                                     │
│  - Real-time availability check                              │
│       │                                                      │
│       ▼                                                      │
│  Creator profile created in PostgreSQL                       │
│       │                                                      │
│       ▼                                                      │
│  Main App (data in PostgreSQL)                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Storage:**
- User account → `user` table (PostgreSQL)
- Sessions → `session` table (PostgreSQL)
- Chats → `chat_thread` + `chat_message` tables (PostgreSQL)
- Agents → `agent` table (PostgreSQL)
- Creator profile → `creator_profile` table (PostgreSQL)

### 2. GitHub/Offline Users (DiffDB)

```
┌──────────────────────────────────────────────────────────────┐
│                   GITHUB USER FLOW                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Sign-in Page                                                │
│       │                                                      │
│       ▼                                                      │
│  Click "Use Local Account"                                   │
│       │                                                      │
│       ▼                                                      │
│  OfflineLoginDialog                                          │
│  - Redirect to GitHub OAuth                                  │
│  - User authorizes repo access                               │
│       │                                                      │
│       ▼                                                      │
│  Token stored in cookie                                      │
│       │                                                      │
│       ▼                                                      │
│  GitHubDatabaseWrapper checks for repo                       │
│       │                                                      │
│       ├─── Repo exists → Skip onboarding                     │
│       │                                                      │
│       └─── No repo → GitHubOnboardingModal                   │
│                │                                             │
│                ▼                                             │
│            Create private repo in user's GitHub              │
│                │                                             │
│                ▼                                             │
│            Main App (data in GitHub repo)                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Storage:**
- All data stored in user's private GitHub repository
- Uses DiffDB (JSON files in repo)
- Full user ownership - data is in THEIR GitHub

---

## Key Files

### Authentication

| File | Purpose |
|------|---------|
| `src/lib/auth/server.ts` | Better Auth configuration |
| `src/lib/auth/client.ts` | Client-side auth hooks |
| `src/lib/auth/use-unified-session.ts` | Unified session hook (OAuth + offline) |
| `src/lib/auth/use-user-auth-type.ts` | **NEW** - Detects email vs GitHub auth |
| `src/lib/auth/github-helper.ts` | GitHub token retrieval |
| `src/app/api/auth/user-auth-type/route.ts` | **NEW** - API for auth type detection |

### Storage Routing

| File | Purpose |
|------|---------|
| `src/lib/db/repository.ts` | Repository proxy - routes to correct storage |
| `src/lib/db/pg/` | PostgreSQL repositories |
| `src/lib/diffdb/` | DiffDB (GitHub) repositories |

### UI Components

| File | Purpose |
|------|---------|
| `src/app/(auth)/sign-in/page.tsx` | Main sign-in page (2 buttons) |
| `src/components/auth/auth-modal.tsx` | Email login/signup modal |
| `src/components/auth/offline-login-dialog.tsx` | GitHub offline login |
| `src/components/choose-username-modal.tsx` | Required username selection |
| `src/components/github-database-wrapper.tsx` | **FIXED** - DiffDB setup wrapper |

---

## Storage Mode Detection

The system automatically routes data to the correct storage:

```typescript
// src/lib/db/repository.ts - getStorageMode()

1. Check for offline token cookie → DiffDB
2. Get Better Auth session
3. Check if user has GitHub OAuth account → DiffDB
4. No GitHub = email/password user → PostgreSQL
```

---

## Critical Fix Applied (Dec 28, 2025)

### Problem
Email/password users were being blocked by `GitHubDatabaseWrapper` which required DiffDB setup for ALL users.

### Solution
1. Created `/api/auth/user-auth-type` endpoint to detect auth type
2. Created `useUserAuthType` hook for client-side detection
3. Modified `GitHubDatabaseWrapper` to:
   - Skip entirely for email users
   - Only show GitHub setup for GitHub/offline users

### Key Code Change

```tsx
// GitHubDatabaseWrapper now checks auth type FIRST

if (isEmailUser && !authTypeLoading) {
  return <>{children}</>; // Skip wrapper for email users
}
```

---

## Password Reset

Email users can reset their password via Gmail:

1. User clicks "Forgot password? Reset it here"
2. Email sent via Gmail (nodemailer)
3. User clicks link in email
4. Redirected to `/reset-password` with token
5. User sets new password

**Config:**
- `GMAIL_USER` - Gmail address
- `GMAIL_APP_PASSWORD` - App-specific password

---

## User Types Summary

| Feature | Email User | GitHub User |
|---------|------------|-------------|
| Storage | PostgreSQL | DiffDB (GitHub repo) |
| Password Reset | ✅ Email | N/A (GitHub handles) |
| Creator Profile | ✅ Required | ❌ Optional |
| Publish Bots | ✅ Yes | ❌ Local only |
| Data Location | Our database | User's GitHub |
| Offline Mode | ❌ No | ✅ Yes |

---

## Testing Checklist

- [x] Email signup creates account in PostgreSQL
- [x] Email user sees ChooseUsernameModal on first login
- [x] Email user does NOT see GitHub setup screen
- [x] GitHub/offline user sees DiffDB onboarding
- [x] Password reset emails are sent
- [x] Storage mode correctly detected for each user type
- [x] Chat data saved to correct storage

---

## Environment Variables

```env
# Authentication
BETTER_AUTH_SECRET=xxx
BETTER_AUTH_URL=http://localhost:3000

# GitHub OAuth (for DiffDB users)
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID_OFFLINE=xxx
GITHUB_CLIENT_SECRET_OFFLINE=xxx

# DiffDB
DIFFDB_ENABLED=true
DIFFDB_REPOSITORY_NAME=redsmith-ai-data

# Email (for password reset)
GMAIL_USER=xxx@xxx.com
GMAIL_APP_PASSWORD=xxxx

# Database (for email users)
POSTGRES_URL=postgresql://...
```

---

## Architecture Diagram

```
                         ┌─────────────────┐
                         │   Sign-in Page  │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
           ┌──────────────┐            ┌──────────────┐
           │  "Join Now"  │            │"Use Local    │
           │  (AuthModal) │            │  Account"    │
           └──────┬───────┘            └──────┬───────┘
                  │                           │
                  ▼                           ▼
           ┌──────────────┐            ┌──────────────┐
           │ Email/Pass   │            │ GitHub OAuth │
           │ Sign Up      │            │ Token Cookie │
           └──────┬───────┘            └──────┬───────┘
                  │                           │
                  ▼                           ▼
           ┌──────────────┐            ┌──────────────┐
           │ PostgreSQL   │            │   DiffDB     │
           │ (our DB)     │            │ (user's GH)  │
           └──────────────┘            └──────────────┘
```

---

## Conclusion

The authentication system now properly separates:
- **Email users** → PostgreSQL storage, skip DiffDB wrapper
- **GitHub users** → DiffDB storage, show onboarding if needed

Each user type has a clear, isolated flow with no cross-contamination.
