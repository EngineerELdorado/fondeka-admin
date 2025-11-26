# Fondeka Admin Dashboard

A Next.js (JavaScript) admin dashboard for the Fondeka fintech platform. It uses AWS Amplify authentication for admin users and provides UI entry points for managing accounts, loans, KYCs, transactions, and reports exposed by the lender service.

## Getting started

1. Install dependencies

```bash
npm install
```

If your environment requires a proxy for npm, configure it accordingly.

2. Create an `.env.local` file with your Cognito and API settings:

```
NEXT_PUBLIC_AWS_REGION=xxx
NEXT_PUBLIC_COGNITO_USER_POOL_ID=xxx
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=xxx
NEXT_PUBLIC_ADMIN_API_BASE=https://admin-api.example.com
```

3. Run the development server

```bash
npm run dev
```

The dashboard is available at `http://localhost:3000`.

## Amplify auth flow

The login screen implements the same passwordless email + code flow used in the mobile app via `CUSTOM_WITHOUT_SRP`. Admins request a code with their email address and confirm the challenge to obtain an authenticated session.

## API wiring

The `lib/api.js` helper maps to the Spring Boot admin endpoints that manage accounts, admins, KYC, loans, transactions, and aggregated reports. Set `NEXT_PUBLIC_ADMIN_API_BASE` to the base path of the admin API (e.g., `https://api.example.com/admin`).
