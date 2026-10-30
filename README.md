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

## Business API LIVE payment settings

Feature flags contains **Default for live API payments**, backed by `business_api.live_payments.enabled`. Businesses → Details & credentials → LIVE API payments supports explicit enable/disable overrides and restoring inheritance with a bodyless `DELETE`. The Business directory and quick view show the backend's saved effective status and its source. Successful updates invalidate the router cache; the directory fetches current rows when opened or refreshed.

`ADMIN` and `SUPER_ADMIN` can edit these settings; `ASSISTANT` has read-only access. Draft choices are separate from saved status. Failed saves preserve the saved badge, and a `409` requires a successful Business refresh before retrying. Missing or invalid effective/global fields show **Status unavailable** and disable editing. These controls affect new LIVE payments; accepted payments continue processing and sandbox remains available.

Deploy the additive backend migrations `20261122_business_api_live_payments.sql` and `20261201_business_api_live_payment_overrides.sql` before backend code that reads the new fields. All accepting web instances must support Business overrides before relying on them. This dashboard implementation does not change production settings.

Run the policy and API contract regression checks with `npm test`. Run `npm run lint` and `npm run build` for the dashboard checks.
