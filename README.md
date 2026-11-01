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

Feature flags contains **Default for live API payments**, backed by `business_api.live_payments.enabled`. Businesses → Details & credentials → LIVE API payments supports explicit enable/disable overrides and restoring inheritance with a bodyless `DELETE`. The Business directory and quick view show the backend's saved effective status and its source, with a direct **Manage LIVE payments** link for Admins and Super Admins (read-only settings link for Assistants). Directory actions are limited to **Quick view** and **Details & credentials**; operational/KYB status changes and owner access are on Business details. Successful updates invalidate the router cache; the directory fetches current rows when opened or refreshed.

`ADMIN` and `SUPER_ADMIN` can edit these settings; `ASSISTANT` has read-only access. Draft choices are separate from saved status. Failed saves preserve the saved badge, and a `409` requires a successful Business refresh before retrying. Missing or invalid effective/global fields show **Status unavailable** and disable editing. These controls affect new LIVE payments; accepted payments continue processing and sandbox remains available.

Deploy the additive backend migrations `20261122_business_api_live_payments.sql` and `20261201_business_api_live_payment_overrides.sql` before backend code that reads the new fields. All accepting web instances must support Business overrides before relying on them. This dashboard implementation does not change production settings.

Run the policy and API contract regression checks with `npm test`. Run `npm run lint` and `npm run build` for the dashboard checks.

## Regulator mode

In Feature flags, expand **Regulator mode** (`enableRegulatorMode`). This section and **API LIVE payments** start collapsed. Administrators can edit the global Boolean or open **Overrides** to enable or disable it for an account ID or an existing account's email. Email matching is case insensitive; email and account ID address the same stored override. Email requests URL-encode `+` and `@` and do not create accounts or target future signups. Assistants can inspect the global setting and explicit overrides.

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

The dashboard uses `PUT /admin-api/business-tools/plans/{code}/purchase-notice` with both text fields, the current version, and reason. Notice saves are separate from pricing updates. Apply backend migration `20261205_business_tools_purchase_notices.sql`, then deploy the backend before the dashboard. Existing notices remain unchanged until an administrator saves custom copy. Clients receive the resolved `purchaseNotice` through their existing Business Tools access response; refresh that response to see a change. Individual notices describe the selected tool’s benefits and are displayed in both bundle and per-tool pricing, including when the individual offer is inactive. Bundle copy appears alongside tool benefits when buying the bundle. The separate `purchaseScopeNotice` tells the buyer which tools their payment unlocks. Review existing individual copy that says a purchase unlocks that tool only, since benefits should remain accurate in either mode.

## Business API sandbox history

Open **Business API sandbox history** in the menu, or follow its links from Businesses, a Business's details/credentials, or an account's details. The screen at `/dashboard/business-api/sandbox-transactions` reads accepted sandbox payments across all Businesses. Admins, Super Admins and Assistants can inspect it; Staff and customer roles cannot.

Filter by Business, owner account, credential (including revoked credentials), action, API status, scenario, fiat currency, exact Fondeka/order references and inclusive UTC creation times. Filters and pagination are retained in the URL. Reference characters such as `%` and `_` match literally. Amounts, fees and gross amounts retain their own currency and are test data, separate from financial reporting.

Payment links use the exact opaque Fondeka reference and the sandbox detail endpoint, never the numeric financial transaction route. Details include safe Business/credential metadata, virtual-wallet tracking, virtual refunds, failure information and synthetic, non-payable crypto details. Regulator-mode presentation hides crypto payments and virtual-wallet details. The history has refresh controls only: reads do not advance simulation, move funds, send webhooks or contact providers.

Both helpers use the existing admin Bearer token with `GET /admin-api/business-api/sandbox/transactions` and `GET /admin-api/business-api/sandbox/transactions/{reference}`. Deploy the backend read endpoints against the existing sandbox schema; no new migration or production setting is required.

## Announcements and notification popups

Choose **Current announcement format** or **Popup** in **Announcement format**. The current format keeps the existing banner/feed presentation; Popup opts into the reusable native popup. The choice is available in all three places:

| Where | How to configure it |
| --- | --- |
| **Announcements** (`/dashboard/announcements`) | Create or edit an announcement, then select its format. Use the existing active, title/message, image, audience, account, app-version and UTC scheduling controls. |
| **Push Campaigns** (`/dashboard/notification-push-campaigns`) | Enable **Also create announcement**, then select its format and optional popup action before **Launch campaign**. The default title and body come from the push subject and message; the announcement retains campaign audience targeting. |
| **Accounts → open an account → Send notification** | Enable **Also show as in-app announcement**, then select its format and optional popup action before **Send**. The default title and body come from the notification subject and message; the announcement targets that account. |

For Popup, select one **Primary action**:

| Choice | Behavior |
| --- | --- |
| **No CTA** | Shows the message with its close control and no primary button. |
| **Open a web page** | Requires a button label and an absolute HTTPS web destination. The page opens only when the user presses the button. |
| **Share the app** | Requires a button label. The native app uses the customer's enabled referral summary and personal invitation code, with the platform's app-store sharing. Referral promotions stay hidden in native regulator mode. |
| **Acknowledge the message** | Requires a button label; pressing it closes the popup. |

Button labels must be single-line text of at most 80 characters. **Button label (French)** is optional and falls back to the default label when blank. Expand **French announcement copy (optional)** for a French title and message in any of the three editors. Each missing translation falls back to the corresponding default field. The backend resolves English/French copy using the customer's current language, including regional tags such as `fr-CD`. Copy preserves Unicode and internal line breaks and displays as plain text.

A popup image is optional and must use HTTPS. The native app uses its artwork when no usable image is available or loading fails. **Legacy link** and **Download update** retain their existing behavior; only the popup's configured primary action creates a popup button. Enabled announcement metadata is validated before notification delivery or campaign enqueueing, so an invalid label, destination or popup image must be corrected before sending. Disabling the announcement option sends the notification without publishing an announcement or validating its unused popup draft. Campaign announcements inherit the campaign audience; account notifications target the selected account. Use the returned announcement ID link to reopen the saved record, including app-version targeting, in Announcements. Editors load the complete saved announcement before editing, preserve UTC scheduling precision, and retain failed drafts. Duplicate saves and sends are blocked while a request is running.

Edits keep the same announcement ID and do not reset the device's per-account presentation memory. Create a new announcement when users should intentionally see a new message. Views record that the popup was shown; they do not confirm reading, acknowledgement or CTA completion. Active state, targeting and start/end dates still control eligibility.

Apply backend migration `20261210_announcement_popup.sql` and deploy the updated API before the dashboard. Existing records keep the current format until explicitly changed to Popup. For request fields, localization, compatibility and native presentation behavior, see the [announcement popup integration contract](../../backend/docs/mobile-announcement-popup.md).

## Referral invitation popup

On **Referral campaigns**, each row has **Invitation popup**. The dedicated editor fetches the numeric campaign record and saves the complete popup configuration to `/admin-api/referral-campaigns/{id}/referral-prompt`. It does not submit reward rules, campaign status, schedules or a version. Admins and Super Admins can edit; Assistants can inspect the saved settings. Null `referralPrompt` means unconfigured/off; a missing or malformed property keeps editing disabled until refreshed.

The popup's string campaign ID is separate from the numeric referral campaign ID. Keep it stable across copy, language, targeting and off/on changes. Disabling retains the complete copy and targeting. All eligible users explicitly clears both audience and account-ID restrictions; selected users require an ID list or a meaningful filter. The audience editor includes all push/announcement selectors, preserves false and zero, and validates list sizes, positive IDs, numeric/date ranges and plain-text limits. Responses must confirm the complete saved configuration before success is shown. Failed saves retain the draft and last confirmed status; stale responses from another campaign are ignored. Popup audits can be filtered using `REFERRAL_PROMPT_` on the same page.

Apply backend migration `20261206_referral_invitation_prompt.sql` and deploy the backend before the dashboard. Existing campaigns remain unconfigured/off. A saved enabled setting still requires the referral program switch, an unambiguous ACTIVE campaign within its dates, and an eligible non-regulator account. Clients see changes on successful account refreshes; no push, referral binding, reward or financial transaction is created. Presentation memory remains per account, campaign and device.

## Payout failover

Team operating guide: [Managing provider failover](docs/provider-failover-guide.md), covering the mental model, setup, cutovers, pausing, monitoring and incident investigation for both payout and recharge failover.

Both failover pages open with an **Overview** of saved status, supported provider direction and a three-step setup guide. Navigation separates **Backup setup**, **Turn on / pause**, **Payment activity** and **Change history**. Numbered form steps, click/keyboard help, readable failure explanations and collapsed technical details explain what changes do. Saving rules and activation remain separate; unsaved work survives section changes. The start time is labeled as the original payment creation boundary, and an enabled future boundary shows **Scheduled**. Activity counts have definitions and history shows a readable setup summary before full JSON.

Open **Payments → Payout failover**, or `/dashboard/payout-failover`. Admins and Super Admins can inspect counts, operations, attempt timelines, capabilities and revision history, and run non-payment previews. Only Super Admins can publish or activate/pause. Assistants and Staff have no access. Regulator presentation hides this page because the shared policy and investigation include wallet payouts.

**Backup setup** keeps the saved policy and editor draft separate. Source, revision, configured/effective switches, infrastructure suppression, cutover floor and structured validation are shown from backend responses. Searchable country-grouped route selectors include all capability-supported sources and distinct alternates for the same mobile-money method. Evidence codes are filtered to the selected source provider. Rules retain stable IDs and array order. Empty rollout IDs mean all otherwise eligible accounts. Publication replaces the entire document immediately and requires an audit reason. No policy is enabled merely by adding this dashboard.

**Defaults and scoped overrides** supports `routingRules` alongside explicit route-pair `rules`. Scope filters use payment method, destination country and payout currency. An explicit blocked winner prevents inheritance; deleting it restores inheritance. Precedence is exact route, method, country+currency, country, currency, global. Provider roles and the execution limit come from capabilities: at most three distinct providers can execute, with a reviewed non-payment contract at every position before the last. ArakaPay belongs last; four-provider orders remain disabled preferences. Saving retains both lists, false overrides, stable IDs and provider order. Older synchronous two-provider responses remain compatible. Missing/failed capability verification disables writes without dropping the draft.

**Review environment defaults and coverage** calls the read-only `/payout-failover/defaults`. It shows preset method/action coverage, resolved routes/operator codes, active flags and blockers, with local filtering and pagination. At least one reviewed path can be executable even when optional alternatives are missing; those missing routes remain visible. Alternatives are skipped only within the winning scope, and inactive dedicated mappings still shadow generic mappings for that provider. Import replaces local rule lists with disabled defaults, retaining raw account-ID edits. It does not publish or activate, and preset coverage is separate from a customized draft.

**How does failover work?** and **Supported providers and fixed safeguards** explain provider-specific evidence: PawaPay synchronous rejection, authenticated AvadaPay final status 3, admitted signed Maplerad final failure, and alternate-only ArakaPay success lookup. An accepted AvadaPay payout may later continue after confirmed final non-payment; a timeout or acceptance alone cannot switch. Backend evidence codes are not outage codes, cancellation/non-retryable evidence cannot switch, and a retained code alone does not imply journal state REJECTED.

Payout enable/resume uses an automatic backend-selected safe start or an explicit future UTC cutover. Empty saved rule lists can discover validated defaults; nonempty lists, blocked overrides and account cohorts are preserved. Pause works even if routes are now invalid. A revision conflict retains the draft, reloads current state and blocks another publication until the admin reviews the differences. A successful activation or pause also keeps any separate unsaved draft for review. Failed or unconfirmed writes never replace the last confirmed saved badge with an optimistic value.

The expandable **Test your payout setup without sending payments** distinguishes configuration-only validation, existing transaction eligibility and a sample payout. Samples can use a future creation instant after the proposed cutover. Results show the matched scope even when blocked. Preview never publishes, submits or creates an attempt; provider funds and external outcomes remain unverified. Status checks call only `/payout-failover/operations/{transactionId}/status-check`, with recorded attempt references and a shared 30-second cooldown. All observations, including unsupported providers, partial errors and manual-review flags, remain visible. Maplerad live lookup is labeled unsupported; recorded callbacks are shown separately. There are no resend, guard reset, arbitrary fallback-code or reconciliation mutations on this page.

Attempt timelines show terminal status/evidence/time separately from submission and observational lookups. A refund/final-failure reservation fences dispatch but does not prove wallet credit; consult the original transaction's refund details.

Operation filters support exact reference, transaction/account, provider, submit state, routes, conflict/unresolved tri-state and UTC windows of at most 90 days. Overview metrics are counts for that window, not mixed-currency money totals. Policy provenance opens immutable revision history. Existing transaction investigation remains available for the reviewed reconciliation process across all attempts.

Deploy `20261208_payout_failover_admin.sql`, `20261209_payout_failover_refund_fence.sql`, `20261212_payout_failover_routing_defaults.sql` and `20261213_payout_failover_provider_contracts.sql` after the journal migration and upgrade every backend web/worker process before enabling a database-managed policy. The seed changes only a pristine null policy to database-managed, globally disabled presets. The provider migration expands journal constraints without changing historical attempts. The infrastructure emergency switch cannot be bypassed through the dashboard. Run `npm test` for policy, preview, API and permissions regression checks.

## Airtime, data and bundle failover

Open **Payments → Recharge failover** or `/dashboard/recharge-failover`. This is a separate policy from payout failover. Admins and Super Admins can inspect products, prepare local preview drafts, inspect managed purchases and read history. Only Super Admins can publish or activate/pause. Assistants and Staff have no access. Regulator presentation hides this wallet-backed policy and its financial investigation view.

**Backup setup → 1. Review product pair** reads the two provider catalogs independently. Supply a country/type, Reloadly operator ID or Zendit offer ID, and the fixed supplier amount. The returned products and fingerprints are read-only. Review both sets of terms, identify the same real network, record equivalent benefits/eligibility, choose an approval expiry, set a common-currency additional-cost ceiling, and explicitly confirm the review before copying the pair to a local draft. No products or failure codes are preselected. The source provider's executable allowlist comes from capabilities. Reversing direction requires a separate reviewed mapping.

Inspection inputs and unsaved workbench changes remain separate from the policy. Changing inputs makes the old inspection unusable. Starting a new inspection invalidates the previous result, including after a failed read. Changed metadata fingerprints require fresh review. Draft transfer is blocked while a policy publication is running. Approved decimals are read losslessly and serialized with the backend inspector's normalized BigDecimal scale; numeric formatting never rounds approved values or changes the approval fingerprint.

**Backup setup → 2. Save pairs & accounts** preserves mapping IDs and array order, explicit disabled mappings, approval evidence, zero cost ceilings and rollout IDs. Blank rollout IDs mean all otherwise eligible accounts. Publication replaces the whole document using the last-read revision and an audit reason. Activation/resumption requires a future UTC cutover that cannot precede the established floor. Pause preserves current mappings/cohorts and does not call product inspection. A revision conflict retains the draft, reloads the flat backend snapshot and blocks publication until the admin reviews the differences. Failed/unconfirmed writes retain the last confirmed saved badge. No source-code change enables a production policy.

**Recharge transaction preview** requires a real transaction and optionally includes the complete local draft. It displays eligibility, rule, already-managed and permanent-legacy decisions, and requires explicit backend confirmation that no financial state changed and no provider purchase was sent. A legacy decision cannot be adopted by a later mapping or activation.

The operations and revision-history endpoints return arrays, with no Spring-page totals. Pagination supports a full final page followed by an empty page. The operation filters are transaction ID and an Any/Yes/No conflict selector; false remains an explicit filter. Overview metrics use the backend's fixed last-30-day window and are counts, not monetary totals. A timeline shows the original quote/funding, stable attempt references, product snapshots, provider outcomes/codes, scheduled-query counts and the latest 200 sanitized observations. Refresh only reads the journal. Refund reservation is not proof of wallet credit; consult the original transaction/refundedAt. Unknown, pending, successful or conflicting attempts do not authorize a resend or refund. No force-query, retry, journal-reset or refund-override endpoint is exposed.

Apply `20261211_recharge_failover.sql` and upgrade all web/worker processes before choosing a future activation cutover. The seeded policy is disabled and has no mappings. The backend continues to enforce FIXED/direct-delivery products, existing account/fiat-wallet debits, unchanged quotes/benefits, two distinct providers, correlated terminal non-delivery evidence, live fingerprint checks, approval expiry and durable refund protection. External collections, loans, crypto funding, RANGE and PIN/redemption products retain their existing paths. Run `npm test` for contract, exact-decimal, inspection and API regression checks.
