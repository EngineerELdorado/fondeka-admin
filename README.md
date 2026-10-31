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

## Regulator mode

In Feature flags, expand **Module flags** and find **Regulator mode** (`enableRegulatorMode`). Administrators can edit the global Boolean or open **Overrides** to enable or disable it for an account ID or an existing account's email. Email matching is case insensitive; email and account ID address the same stored override. Email requests URL-encode `+` and `@` and do not create accounts or target future signups. Assistants can inspect the global setting and explicit overrides.

The account details page also has a **Regulator mode** panel, directly below the account summary. It shows the resolved saved value, the global setting and whether an explicit override exists. Select **Follow global setting**, **Enable**, or **Disable**, then save. Following the global setting deletes the same stored override, including one created by email. The panel refreshes when the account is refreshed and supports its own refresh action; assistants have read-only access.

The default is `false`. An explicit account override wins in either direction and remains in place when the global setting changes. A disabled override forces the mode off; deleting the override restores inheritance. Country overrides, queue behavior and rejection messages are not used for this flag. Regulator mode supplies a presentation signal and does not change backend payment authorization or service eligibility.

Compatible customer clients read the effective Boolean from `GET /customer-api/accounts/my-account` using the customer's access token. Native clients expose `accountData.enableRegulatorMode`, defaulting to `false`; clients do not combine global and account settings themselves. The customer's visibility list remains to be defined in those clients. After an admin change, allow up to 30 seconds for other processes' caches to expire, then refresh client account data. Customer overrides use the existing tables.

### Admin users and dashboard presentation

The global setting also applies to dashboard admins. In **Admins**, the **Regulator mode** column shows the effective value and its source. Super Admins can set **Enable**, **Disable**, or **Follow global setting** from a row or through **Regulator mode by email**. Admin overrides use `/admin-api/admins/{adminId}/regulator-mode` and `/admin-api/admins/regulator-mode/by-email?email=…`; PUT sends an explicit Boolean and DELETE restores inheritance without a body. These are separate from customer overrides, including when an ID or email is shared.

`AuthProvider` fetches `/admin-api/admins/me` after authentication and on window focus. It exposes `adminProfile`, `enableRegulatorMode`, `adminProfileLoading`, `adminProfileError`, and `refreshAdminProfile()`. An unresolved or failed profile is not a resolved `false`: the dashboard shows a loading or retry state and withholds its page content. Profile results are bound to the authenticated identity so a previous login cannot supply the new admin's presentation. Unsaved page drafts survive a profile refresh when the effective mode remains unchanged. Successful admin-override changes and changes to the global Regulator mode flag refresh the current profile.

When an admin's effective mode is enabled, the dashboard hides wallet, crypto, loan, and savings navigation, direct routes, overview figures, account balances and related controls. Shared tables, native tables, selectors, settings sections, and internal links apply the same presentation policy. The overview retains account, KYC, and card metrics and links to the remaining management areas. A resolved `false` restores the ordinary dashboard. This changes presentation only; backend authorization and payment eligibility remain authoritative.

Apply backend migration `20261202_admin_regulator_mode.sql` before deploying backend code that reads `admins.regulator_mode_override`. Existing admins inherit the global setting. Deploy the updated backend before this dashboard, which requires the effective Boolean in `/admins/me`. Admin-specific overrides are read on each profile fetch; inherited global settings can take up to 30 seconds to refresh across processes. No production setting is changed by this implementation.

## Mobile maintenance

Open **Mobile maintenance** (`/dashboard/mobile-maintenance`) to read and replace the policy through `/admin-api/mobile-maintenance`. Admins and Super Admins can edit; Assistants can inspect the saved policy. Draft changes do not affect the saved status badge. Failed saves retain the saved policy and allow retry. **Turn off maintenance** reads the latest policy and saves it with `enabled: false`, retaining its rules. **Disable and remove all rules** prepares an empty disabled draft, which requires Save.

Rules support English/French plain-text messages, explicit account IDs, all announcement audience selectors, platforms, numeric version bounds, and UTC schedules. Explicit ownership `false` values are preserved. Selectors within a rule use AND; any matching enabled rule activates maintenance. Higher priorities run first, with ties following the displayed order. An unrestricted rule can still match clients outside other rules' target accounts. The editor validates the 50-rule, 1,000-entry, 200-character title, and 4,000-character message limits before saving. PUT replaces the complete policy. Regulator presentation hides restricted service controls while preserving their stored rules and values.

The policy supplies the mobile availability signal. Forced updates retain priority; this does not change payment or order processing. Changes appear on the next status check or account refresh, with active-maintenance recovery checks every 30 seconds and no push broadcast. Account-audience rules require backend migration `20261203_mobile_maintenance_contexts.sql` and the coordinated native release that sends maintenance context headers and retains the returned opaque token. Older clients and anonymous clients without a context receive only decisions that do not require an account identity. This dashboard does not enable a production policy or modify the forced-update configuration.

## Catalog pickers

Payment-method, bill-product, and provider-route selectors use a shared searchable picker. Options are grouped by country, with separate groups for multiple-country and global products. Search matches names, codes, IDs, currencies, countries, and route providers locally; an optional country filter narrows the list further. Multi-select audiences support individual toggles, removable selections, and a selected-only view. Filtering and dismissing a picker preserve the current value.

Catalog `options()` API helpers load every page and enrich routes with their method/product and country metadata. Ordinary directory `list()` requests remain paginated. These pickers retain existing IDs and change handlers, support keyboard navigation and mobile layouts, and follow the current admin's Regulator presentation without silently removing hidden selections.

## Business Tools purchase notices

Open **Businesses → Business Tools plans**, select the bundle or an individual tool, and use **Purchase notices**. Super Admins can save English and French plain-text copy with an audit reason. Each field allows 4,000 characters; blank copy restores that language's existing default. Optional `{0}` inserts the localized plan name. Saved notices remain visible during edits and failed saves. A version conflict requires refreshing the saved notices before retrying, while retaining the draft for review.

The dashboard uses `PUT /admin-api/business-tools/plans/{code}/purchase-notice` with both text fields, the current version, and reason. Notice saves are separate from pricing updates. Apply backend migration `20261205_business_tools_purchase_notices.sql`, then deploy the backend before the dashboard. Existing notices remain unchanged until an administrator saves custom copy. Clients receive the resolved `purchaseNotice` through their existing Business Tools access response; refresh that response to see a change.
