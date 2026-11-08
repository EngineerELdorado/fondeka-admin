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

## Contact exports

Admin and Super Admin users can open **Accounts → Contact exports**, or **Export contacts** on the account directory, at `/dashboard/accounts/contact-exports`.

Choose and reorder CSV columns supplied by `GET /accounts/exports/contacts/fields`, then select all accounts or the same account audience filters used by push campaigns. Any/Yes/No controls preserve explicit false values, and count filters preserve zero. Starting an export sends only the selected fields and audience to `POST /accounts/exports/contacts`.

The page polls queued/running jobs every four seconds while visible. The job ID stays in the URL and the latest ID is remembered per admin on that browser; refresh or reopen the page to resume. Only job IDs are persisted locally. Failed/expired jobs allow another export; concurrent-job conflicts retain the draft. Download CSV opens the HTTPS signed URL directly without the admin Authorization header. Refresh download link obtains a new link until the file's 24-hour expiry.

The backend migration `20261217_admin_account_contact_exports.sql`, private export bucket configuration and worker must be deployed separately. The dashboard creates no campaign or email. Contact exports do not establish marketing subscription status.

## Responsive layouts

Dashboard content, controls and grids shrink to their available width. Use `minmax(min(100%, 220px), 1fr)` for automatic grids so a field's preferred minimum cannot widen a narrow panel. Long references and JSON in details wrap, and action groups and tabs can wrap.

Use `components/ResponsiveTable.js` for custom tables; shared `DataTable` uses it automatically. Keep native table rows on every device. Overflow stays inside the table container. Column headings may wrap, and `DataTable` provides column selection and a Fit to screen action.

Long plain-text values in `DataTable` use up to two lines through `components/TableCell.js`. Text that exceeds the available space has a Read more modal containing its complete original value. Amounts and dates keep their existing precision and formatting. A column can set `wrap: false` when it needs a single-line value. Use `TableText` explicitly for long text in custom cells and native tables; inside an existing link use `expandable={false}` so the original link remains the action and no nested button is created.

Use `TableCellLines` for related primary/secondary information, such as a plan and version, a route and provider, or an amount and its USD equivalent. It preserves JSX links and controls. Keep table typography at the shared body/small sizes instead of shrinking it to force a fit. Multiple row actions belong in `TableActions`.

`DataTable` columns can supply a width hint and a priority for fitting. Transaction status reserves enough width for long codes and retains its complete badge text. Visibility wrappers and Review mode filtering remain authoritative before any text preview is rendered.

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

## Automatic refund policy

Open **Wallet Policy Config → Automatic refunds** (`/dashboard/wallet-policy-config`). ADMIN and SUPER_ADMIN can save; ASSISTANT can inspect. The tab shows the global `auto_refund` status and links to Feature flags. Global off blocks automatic refunds even with ALLOW rules or account exceptions. Editing this dashboard does not enable the switch.

Add, edit, reorder or remove scoped rules, then **Save refund policy**. The first matching rule wins; selectors within a dimension use OR and specified dimensions use AND. Empty selectors mean Any. A new rule must have a filter or an intentional **All automatic refunds** scope. Payment providers use the current transaction route, including after failover; bill providers identify the bill fulfiller, not a card issuer. Place narrow provider exceptions before a broad BLOCK when unknown providers should require manual handling.

Expand **Action defaults & account exceptions** for the fallback used when no scoped rule matches. Blocking `WITHDRAW_FROM_WALLET` requires manual handling except for its listed accounts. A scoped BLOCK overrides those account exceptions; a scoped ALLOW can override an action block. Provider timeout exceptions remain separate and cannot bypass the global switch or a scoped BLOCK. Clearing scoped rules sends `[]` and restores the action fallback; it does not clear action settings. LIVE Business API payouts use the policy; SANDBOX keeps its separate simulated-wallet refund policy.

The editor PUTs only changed refund fields to `/admin-api/wallet-policy-config`; other wallet settings are saved separately. Drafts survive save errors and tab changes. A fresh read detects changes to edited fields before submission and requires explicit review before retrying. The backend has no optimistic revision field, so that check is not an atomic concurrency guarantee. Responses must confirm all submitted settings before success is shown. Unknown write outcomes require refresh/review, and a 403 remains an in-place read-only error.

If the backend reports invalid stored scoped rules, **Prepare replacement rules** builds a reviewed replacement or an empty list. Recovery writes only `autoRefundRules`, preserving the existing fallback. A newly repaired policy must be reviewed before replacement. Other wallet settings cannot be saved after a failed settings load. No refund, payout, replay or historical wallet change is performed by this editor; backend debit, eligibility, failover-evidence and duplicate checks remain authoritative.

## Mobile maintenance

Open **Mobile maintenance** (`/dashboard/mobile-maintenance`) to read and replace the policy through `/admin-api/mobile-maintenance`. Admins and Super Admins can edit; Assistants can inspect the saved policy. Draft changes do not affect the saved status badge. Failed saves retain the saved policy and allow retry. **Turn off maintenance** reads the latest policy and saves it with `enabled: false`, retaining its rules. **Disable and remove all rules** prepares an empty disabled draft, which requires Save.

Rules support English/French plain-text messages, explicit account IDs, all announcement audience selectors, platforms, numeric version bounds, and UTC schedules. Explicit ownership `false` values are preserved. Selectors within a rule use AND; any matching enabled rule activates maintenance. Higher priorities run first, with ties following the displayed order. An unrestricted rule can still match clients outside other rules' target accounts. The editor validates the 50-rule, 1,000-entry, 200-character title, and 4,000-character message limits before saving. PUT replaces the complete policy. Regulator presentation hides restricted service controls while preserving their stored rules and values.

The policy supplies the mobile availability signal. Forced updates retain priority; this does not change payment or order processing. Changes appear on the next status check or account refresh, with active-maintenance recovery checks every 30 seconds and no push broadcast. Account-audience rules require backend migration `20261203_mobile_maintenance_contexts.sql` and the coordinated native release that sends maintenance context headers and retains the returned opaque token. Older clients and anonymous clients without a context receive only decisions that do not require an account identity. This dashboard does not enable a production policy or modify the forced-update configuration.

## Catalog pickers

Country, payment-method, bill-product, and provider-route selectors use a shared searchable picker. Options are grouped by country, with separate groups for multiple-country and global products. Search matches names, codes, IDs, currencies, countries, and route providers locally; an optional country filter narrows the list further. Multi-select audiences support individual toggles, removable selections, and a selected-only view. Filtering and dismissing a picker preserve the current value. Country pickers support single and multiple selections, names in English/French, ISO codes, IDs and aliases such as DRC/RDC. Existing ID/code payloads and saved values are preserved. Country lists used for ID selection load every catalog page; the Countries directory searches the full loaded catalog and paginates matching rows locally. Audience editors keep their existing CSV/array conversion and validation rules.

Catalog `options()` API helpers load every page and enrich routes with their method/product and country metadata. Ordinary directory `list()` requests remain paginated. These pickers retain existing IDs and change handlers, support keyboard navigation and mobile layouts, and follow the current admin's Regulator presentation without silently removing hidden selections.

## Business Tools purchase notices

Open **Businesses → Business Tools plans**, select the bundle or an individual tool, and use **Purchase notices & FAQ**. Super Admins can save English/French benefits and an optional FAQ link with an audit reason. Admins and Assistants can read the settings. The editor also works for inactive offers and in BUNDLE pricing mode; every returned plan keeps its own code and settings. Benefit text allows 4,000 characters per language; blank restores the localized default and `{0}` inserts the localized plan name.

Enable **FAQ link enabled** to enter the primary HTTPS URL, optional French URL, and optional English/French labels. URLs allow 2,048 characters and preserve query strings/anchors; labels allow 160 single-line plain-text characters. Blank French URLs use the primary URL; blank labels use “Read the FAQ” or “Consulter la FAQ”. Turning the link off and saving explicitly removes all four FAQ fields with `purchaseNoticeLink: {}`. Notice-only edits omit that property and preserve the link. FAQ controls stay unavailable on older backends while notice-only editing remains supported.

English/French previews and saved settings are collapsible. **Preview saved offer for an account** reads the full account access resource with English or `fr-CD`, prioritizes the selected tool's link, and allows a bundle fallback only in BUNDLE mode. Preview links open only on a click. Failed saves keep the draft. A conflict or uncertain save requires a refresh; the operator must explicitly review the latest saved version before applying the draft again. No automatic overwrite occurs.

The dashboard uses `PUT /admin-api/business-tools/plans/{code}/purchase-notice` with both notice strings, the loaded version, reason, and an explicit FAQ replacement/removal only when requested. Notice/FAQ saves remain separate from pricing and access changes. Deploy backend migrations `20261205_business_tools_purchase_notices.sql`, `20261218_business_tools_purchase_notice_links.sql` and `20261219_business_tools_api_faq_seed.sql` before using the updated FAQ contract. The API seed preserves custom links; always use the returned version. Clients receive localized `purchaseNotice` and `purchaseNoticeLink: { url, label }` through existing access responses. Individual benefits appear in both pricing modes, even for inactive offers. The separate `purchaseScopeNotice` describes which tools payment unlocks. Notice/FAQ changes do not change prices, access, methods, or pending purchases.

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

### Business account audiences

Open **Push campaigns → Advanced audience → Product ownership**, or **Announcements → New / Edit → Audience targeting**. Both editors share these Any/Yes/No filters:

| Label | API field | Yes matches |
| --- | --- | --- |
| Is reseller | `isReseller` | Enabled enrollment that has not been removed; suspended enrollments are excluded. |
| Has store | `hasStores` | Owns a non-deleted, non-archived store, including draft/active/suspended stores. |
| Has POS plan | `hasPos` | Active POS customer access from a grant, qualifying bundle or grandfathered paid access. |
| Has payment link / request | `hasPaymentRequests` | Has created a payment request, including historical requests. |
| Has API plan | `hasApi` | Active API customer access from a grant, qualifying bundle or grandfathered paid access; no key is required. |

Any omits the property; Yes sends literal true and No sends literal false. No includes accounts that never enrolled or created a matching resource. All selected criteria combine with AND, together with the existing country, language, KYC, dates and transaction filters. The shared **How business accounts are matched** help explains these meanings. A business-only audience is valid. Announcement reads restore false values, and editing another field retains business criteria, scheduling, account targets, app-version rules and popup settings. Attached campaign announcements inherit the campaign audience.

POS/API matching uses recorded customer access, not a free catalog offer. Future, expired, revoked and payment-required grants do not qualify on their own. Qualifying bundle access can cover an expired individual grant; individual revocation/payment requirements block bundle inheritance. A valid individual grant can stand independently of a blocked bundle. Legacy migration grants cover POS/API only in bundle pricing mode, unless a still-valid historical bundle purchase grants access. Account pricing-mode overrides win. Store employees/customers and payers of someone else's request do not qualify as owners/creators. Audience matching does not grant permission to operate a tool or change business data.

Deploy backend support before the dashboard because older servers can ignore new audience properties. No migration is required. These are authenticated account filters; anonymous-install audiences remain separate. Contact exports accept the same criteria through their existing account-audience contract. No campaign is resent and no announcement is published by adding these controls.

## Referral invitation popup

On **Referral campaigns**, each row has **Invitation popup**. The dedicated editor fetches the numeric campaign record and saves the complete popup configuration to `/admin-api/referral-campaigns/{id}/referral-prompt`. It does not submit reward rules, campaign status, schedules or a version. Admins and Super Admins can edit; Assistants can inspect the saved settings. Null `referralPrompt` means unconfigured/off; a missing or malformed property keeps editing disabled until refreshed.

The popup's string campaign ID is separate from the numeric referral campaign ID. Keep it stable across copy, language, targeting and off/on changes. Disabling retains the complete copy and targeting. All eligible users explicitly clears both audience and account-ID restrictions; selected users require an ID list or a meaningful filter. The audience editor retains its country, ownership, activity and transaction selectors, preserves false and zero, and validates list sizes, positive IDs, numeric/date ranges and plain-text limits. Responses must confirm the complete saved configuration before success is shown. Failed saves retain the draft and last confirmed status; stale responses from another campaign are ignored. Popup audits can be filtered using `REFERRAL_PROMPT_` on the same page.

Apply backend migration `20261206_referral_invitation_prompt.sql` and deploy the backend before the dashboard. Existing campaigns remain unconfigured/off. A saved enabled setting still requires the referral program switch, an unambiguous ACTIVE campaign within its dates, and an eligible non-regulator account. Clients see changes on successful account refreshes; no push, referral binding, reward or financial transaction is created. Presentation memory remains per account, campaign and device.

## Payout failover

Team operating guide: [Managing provider failover](docs/provider-failover-guide.md), covering the mental model, setup, cutovers, pausing, monitoring and incident investigation for both payout and recharge failover.

Both failover pages open with a compact **Overview** of saved status, rules, covered accounts and start time. Provider limits and the setup guide are collapsed; scoped provider orders use chips and Allowed/Blocked/Draft badges. Navigation separates **Backup setup**, **Turn on / pause**, **Payment activity** and **Change history**. Saving rules and activation remain separate; unsaved work survives section changes. The start time is labeled as the original payment creation boundary, and an enabled future boundary shows **Scheduled**. Activity counts have definitions and history shows a readable setup summary before full JSON.

**Turn on / pause** shows one action matching the saved configured switch: **Turn on automatic failover** or **Turn off automatic failover**. An empty reason prompts an inline validation message and focuses the audit field, rather than silently disabling the off action. Start controls are shown only when off. Turning off uses the latest verified saved revision and stays available despite local draft conflicts or payout-capability refresh failures. Unverified state, permission checks and in-flight request guards still block writes. Rules, rollout accounts and accepted attempts are preserved.

Open **Payments → Payout failover**, or `/dashboard/payout-failover`. Admins and Super Admins can inspect counts, operations, attempt timelines, capabilities and revision history, and run non-payment previews. Only Super Admins can publish or activate/pause. Assistants and Staff have no access. Regulator presentation hides this page because the shared policy and investigation include wallet payouts.

**Backup setup** keeps the saved policy and editor draft separate. A sticky **Save changes** bar above the editor shows unsaved changes, the required audit reason and why saving is unavailable. Edits are not saved automatically; only Super Admins can publish. Source, revision, configured/effective switches, infrastructure suppression, cutover floor and structured validation are shown from backend responses. Searchable country-grouped route selectors include all capability-supported sources and distinct alternates for the same mobile-money method. Evidence codes are filtered to the selected source provider. Rules retain stable IDs and array order. Empty rollout IDs mean all otherwise eligible accounts. Publication replaces the entire document immediately and requires an audit reason. No policy is enabled merely by adding this dashboard.

**Defaults and scoped overrides** supports `routingRules` alongside explicit route-pair `rules`. Scope filters use payment method, destination country and payout currency. An explicit blocked winner prevents inheritance; deleting it restores inheritance. Precedence is exact route, method, country+currency, country, currency, global. Provider roles and the execution limit come from capabilities: at most three distinct providers can execute, with a reviewed non-payment contract at every position before the last. ArakaPay belongs last; four-provider orders remain disabled preferences. Saving retains both lists, false overrides, stable IDs and provider order. Older synchronous two-provider responses remain compatible. Missing/failed capability verification disables writes without dropping the draft.

**Review environment defaults and coverage** calls the read-only `/payout-failover/defaults`. It shows preset method/action coverage, resolved routes/operator codes, active flags and blockers, with local filtering and pagination. At least one reviewed path can be executable even when optional alternatives are missing; those missing routes remain visible. Alternatives are skipped only within the winning scope, and inactive dedicated mappings still shadow generic mappings for that provider. Import replaces local rule lists with disabled defaults, retaining raw account-ID edits. It does not publish or activate, and preset coverage is separate from a customized draft.

**How does failover work?** and **Supported providers and fixed safeguards** explain provider-specific evidence: PawaPay synchronous rejection, authenticated AvadaPay final status 3, admitted signed Maplerad final failure, and alternate-only ArakaPay success lookup. An accepted AvadaPay payout may later continue after confirmed final non-payment; a timeout or acceptance alone cannot switch. Backend evidence codes are not outage codes, cancellation/non-retryable evidence cannot switch, and a retained code alone does not imply journal state REJECTED.

Payout enable/resume uses an automatic backend-selected safe start or an explicit future UTC cutover. Empty saved rule lists can discover validated defaults; nonempty lists, blocked overrides and account cohorts are preserved. Pause works even if routes are now invalid. A revision conflict retains the draft, reloads current state and blocks another publication until the admin reviews the differences. A successful activation or pause also keeps any separate unsaved draft for review. Failed or unconfirmed writes never replace the last confirmed saved badge with an optimistic value.

The expandable **Test your payout setup without sending payments** distinguishes configuration-only validation, existing transaction eligibility and a sample payout. Samples can use a future creation instant after the proposed cutover. Results show the matched scope even when blocked. Preview never publishes, submits or creates an attempt; provider funds and external outcomes remain unverified. Status checks call only `/payout-failover/operations/{transactionId}/status-check`, with recorded attempt references and a shared 30-second cooldown. All observations, including unsupported providers, partial errors and manual-review flags, remain visible. Maplerad live lookup is labeled unsupported; recorded callbacks are shown separately. Evidence checks do not approve a payment, refund or journal reset.

**Payment activity → Retry a payout** supports explicit manual approval when verified capabilities advertise `allowsManualResubmit:true`. The Payout failover header has a **Retry a payout** shortcut to this section. In Transactions, open the row's **Actions → Retry payout**, or use **View → Retry payout** in the details popup. These entries are available to Admin/Super Admin users on unrefunded, non-completed/non-canceled wallet or Business API payouts; full eligibility comes from the dedicated preview. Enter the transaction ID and choose **Check payout status** to reveal the **Payout provider** selector. The original provider is selected by default, including after failover. An unavailable original stays unavailable until the operator deliberately selects an eligible alternate. The original beneficiary, amount, currency, gross debit and reference are read-only. A trimmed 3–1,000-character reason and confirmation authorize one attempt through `POST /payout-failover/transactions/{id}/manual-retry`; the worker repeats all checks. HTTP 202 means approval queued, not payout completed.

Manual retries work while automatic failover is off and outside its cutover/cohort, but require confirmed non-payment for every earlier attempt and respect the emergency stop, refund/debit, routing, funding and three-total-attempt safeguards. A provider may be reused manually with a new request ID. A completed/refunded/canceled or pending/uncertain/conflicting payout stays blocked. Capability refresh failures disable approval. Older backends hide the approval form, while Payment activity explains that the connected backend does not advertise support. Transaction details links to that availability check when support has not been confirmed. Turning on automatic failover does not enable manual retry support.

After a timeout, the dashboard recovers the exact idempotency key from preview history before considering another approval. Pending approval bodies are retained in tab-scoped session storage under the signed-in admin and transaction, without the beneficiary/quote. An explicit **Resend same approval** keeps the original key, provider choice, version, attempt and reason unchanged. A 409 requires a fresh preview and confirmation; another approval after a returned/refused receipt also requires current provider evidence and **Review a new approval**. Receipt refresh calls only `/payout-failover/manual-retries/{id}`. Returned submissions and queued/dispatched receipts do not prove settlement. Deploy `20270101_manual_payout_retry.sql` and matching backend/event workers before exposing support; no new environment variable or automatic policy activation is required.

Attempt timelines show terminal status/evidence/time separately from submission and observational lookups. A refund/final-failure reservation fences dispatch but does not prove wallet credit; consult the original transaction's refund details.

Operation filters support exact reference, transaction/account, provider, submit state, routes, conflict/unresolved tri-state and UTC windows of at most 90 days. Overview metrics are counts for that window, not mixed-currency money totals. Policy provenance opens immutable revision history. Existing transaction investigation remains available for the reviewed reconciliation process across all attempts.

Deploy `20261208_payout_failover_admin.sql`, `20261209_payout_failover_refund_fence.sql`, `20261212_payout_failover_routing_defaults.sql`, `20261213_payout_failover_provider_contracts.sql` and `20261214_payout_failover_araka_last.sql` after the journal migration and upgrade every backend web/worker process before enabling a database-managed policy. The seed changes only a pristine null policy to database-managed, globally disabled presets. The Araka-last correction updates only the exact unpublished original USD seed to PawaPay → AvadaPay → ArakaPay, preserving published/custom policies and routing ranks. The provider migration expands journal constraints without changing historical attempts. The infrastructure emergency switch cannot be bypassed through the dashboard. Run `npm test` for policy, preview, API and permissions regression checks.

## Airtime, data and bundle failover

Open **Payments → Recharge failover** or `/dashboard/recharge-failover`. This is a separate policy from payout failover. Admins and Super Admins can inspect products, prepare local preview drafts, inspect managed purchases and read history. Only Super Admins can publish or activate/pause. Assistants and Staff have no access. Regulator presentation hides this wallet-backed policy and its financial investigation view.

**Backup setup → 1. Review product pair** reads the two provider catalogs independently. Supply a country/type, Reloadly operator ID or Zendit offer ID, and the fixed supplier amount. The returned products and fingerprints are read-only. Review both sets of terms, identify the same real network, record equivalent benefits/eligibility, choose an approval expiry, set a common-currency additional-cost ceiling, and explicitly confirm the review before copying the pair to a local draft. No products or failure codes are preselected. The source provider's executable allowlist comes from capabilities. Reversing direction requires a separate reviewed mapping.

Inspection inputs and unsaved workbench changes remain separate from the policy. Changing inputs makes the old inspection unusable. Starting a new inspection invalidates the previous result, including after a failed read. Changed metadata fingerprints require fresh review. Draft transfer is blocked while a policy publication is running. Approved decimals are read losslessly and serialized with the backend inspector's normalized BigDecimal scale; numeric formatting never rounds approved values or changes the approval fingerprint.

**Backup setup → 2. Save pairs & accounts** preserves mapping IDs and array order, explicit disabled mappings, approval evidence, zero cost ceilings and rollout IDs. Its sticky **Save changes** bar shows unsaved changes, the required audit reason and why saving is unavailable. Inspections and edits are not saved automatically; only Super Admins can publish. Blank rollout IDs mean all otherwise eligible accounts. Publication replaces the whole document using the last-read revision and an audit reason. Activation/resumption requires a future UTC cutover that cannot precede the established floor. Pause preserves current mappings/cohorts and does not call product inspection. A revision conflict retains the draft, reloads the flat backend snapshot and blocks publication until the admin reviews the differences. Failed/unconfirmed writes retain the last confirmed saved badge. No source-code change enables a production policy.

**Recharge transaction preview** requires a real transaction and optionally includes the complete local draft. It displays eligibility, rule, already-managed and permanent-legacy decisions, and requires explicit backend confirmation that no financial state changed and no provider purchase was sent. A legacy decision cannot be adopted by a later mapping or activation.

The operations and revision-history endpoints return arrays, with no Spring-page totals. Pagination supports a full final page followed by an empty page. The operation filters are transaction ID and an Any/Yes/No conflict selector; false remains an explicit filter. Overview metrics use the backend's fixed last-30-day window and are counts, not monetary totals. A timeline shows the original quote/funding, stable attempt references, product snapshots, provider outcomes/codes, scheduled-query counts and the latest 200 sanitized observations. Refresh only reads the journal. Refund reservation is not proof of wallet credit; consult the original transaction/refundedAt. Unknown, pending, successful or conflicting attempts do not authorize a resend or refund. No force-query, retry, journal-reset or refund-override endpoint is exposed.

Apply `20261211_recharge_failover.sql` and upgrade all web/worker processes before choosing a future activation cutover. The seeded policy is disabled and has no mappings. The backend continues to enforce FIXED/direct-delivery products, existing account/fiat-wallet debits, unchanged quotes/benefits, two distinct providers, correlated terminal non-delivery evidence, live fingerprint checks, approval expiry and durable refund protection. External collections, loans, crypto funding, RANGE and PIN/redemption products retain their existing paths. Run `npm test` for contract, exact-decimal, inspection and API regression checks.

## Reseller program

Open **Reseller program** (`/dashboard/resellers`). Admins can inspect; only Super Admins can change program activation, enrollment, commission rules, behavior policies or reward reconciliation. Assistants and Staff have no menu entry or reseller data access. The account directory lists enrollment records; account ID/email lookup also finds existing accounts that have never enrolled. Account details has a collapsed **Reseller program** section with enrollment, separate currency balances, effective product rates, reward snapshots and immutable entries.

The page starts in **Commission rates → Global defaults**. Configure a product once here; new and existing enrolled resellers inherit its available global rate automatically. No product assignment or account-specific commission setup is required for an ordinary reseller. Search by product name/code/ID and filter enabled, disabled or zero-rate rules. Choose **Edit** on an existing product rule, or **New rule** with **Specific bill product**, an enabled commission rule, a positive percentage and the desired basis/cap. Creating an all-bill-products service default requires an explicit scope choice; keep that default disabled when offering only selected products.

**Resellers** contains account lookup and enrollment records. Open an account for its overview, optional commission overrides, reward history, ledger and reward behavior. **Program settings** contains **Enrollment & earning** and global **Reward behavior**. Global editors never carry a selected account's scope into an edit. **Purchase lookup** contains captured decisions and reward reconciliation. Inheritance, enrollment details and effective-setting previews are expandable. Changes are saved explicitly in an editor.

In an account's **Effective product rates**, **Product market** defaults to that account's country (all markets if unset). Choose another supported country to read `/admin-api/resellers/accounts/{id}/summary?countryCode=RW`. The selection stays in place for refreshes and account-view tabs. Products retain the backend's electricity → TV → other ordering, including its DRC priority; the dashboard does not reorder them. Currency balances remain account-wide. Market selection does not edit profile country, enrollment, funding requirements or commission rules, and manual admin enrollment sends no country override. Country errors stay in place so the operator can select another market or return to the account default.

The account's rates table has local name/code/ID search, reward-eligibility and rate-source filters; matching rows keep the backend order. **Set account override** loads the latest account/product rule and version, or prepares an optional negotiated exception from the effective terms. It does not edit a global or account-wide default. The selected product stays fixed in the editor, saving is explicit, and conflicts follow the existing refresh/review flow. Account exceptions take precedence even over disabled global product rules; delete an exception to restore automatic inheritance. Leave overrides empty for ordinary resellers. Admin readers can filter and inspect; only Super Admins can save rates.

Configure rates, set self-service requirements or enroll pilot accounts manually, then reload the shared program version and explicitly enable new earning. Commission rules use only supported Bill payments, with numeric percentages (2.5 = 2.5%), net-amount/revenue bases, and optional per-purchase caps in each purchase's own currency. Disabled/zero rules block fallback; deleting restores inheritance. Behavior controls use explicit Inherit/Enabled/Disabled and reseller/referral/none choices, with no combined reward mode. Effective previews explain each field's applicable policy ID/version; frozen purchase decisions use their original policy versions instead. First activation and retention changes require an impact acknowledgement. Retention may hold/release existing unredeemed pre-enrollment points in both programs without changing existing wallet credits.

Available, held, deficit, gross earned, redeemed and reversed are displayed separately per currency. No reseller/referral balances or currencies are added together. Transaction details adds a collapsed reseller decision/cost section. **Purchase lookup** accepts the numeric transaction ID and invokes only `/resellers/transactions/{id}/reconcile` for an existing snapshot; it does not retry purchases or call providers. Use the existing outbox tools for `RESELLER_REWARD_SYNC` jobs. Redemption settles liability and is not another commission expense; dashboard gross-revenue totals are unchanged.

**Self-service enrollment requirements** is a separate global editor backed by `GET/PUT /admin-api/resellers/requirements`. It configures `selfServiceEnabled`, a nonnegative two-decimal prefunding minimum, and an active wallet-enabled fiat currency from the paginated currency catalog. Zero removes the minimum. Prefunding is current settled working capital, not a joining fee: activation neither debits nor reserves it; pending or already-spent deposits do not count. Later spending does not suspend enrollment. Closing self-service does not revoke existing enrollment or redemption. Manual admin enrollment/reactivation bypasses this funding gate, and admin-suspended resellers cannot reactivate themselves. The customer app uses its own authenticated onboarding preview for account-specific product availability and funding checks; the dashboard does not call customer endpoints with an admin token.

Requirements and earning share the same version. Saving either refreshes the other saved view rather than silently rebasing it. Conflict review reads both settings at the same version and shows the current earning/self-service/prefunding state before the operator reapplies their retained draft. Editors remain usable when their setting is disabled; no setting is changed automatically.

Editors keep drafts on failure. A stale/duplicate version or uncertain response requires refresh and explicit review before resubmitting; delete requests include the last reviewed version. API 403 stays in place as a permission error. Deploy backend migrations `20261220_reseller_program.sql`, `20261221_reseller_invitee_commissions.sql`, `20261222_reseller_behavior_policies.sql`, `20261223_reseller_self_service.sql`, `20261224_reseller_commercial_defaults.sql` and all web/worker nodes before using the controls.

The commercial-defaults migration seeds global SOCODEE, VIRUNGA, Canal Plus Congo and Canal Plus Rwanda rules at 3% of net purchase amount with no cap, and a USD 10 current-wallet prefunding requirement. It preserves account exceptions, other product rules and the disabled service-wide default. Review actual returned rates, requirements and versions before activation: the dashboard reads the API and does not hardcode or apply these seed values. Product support, catalogue availability, country/access rules, enrollment and earning controls still determine eligibility. The dashboard does not enable production earning or self-service, enroll customers, or change commercial rates automatically.

### Remove enrollment or suspend access

In an account's reseller section, **Manage enrollment → Suspend** blocks customer self-enrollment until admin intervenes. **Remove reseller enrollment** removes the current enrollment and lets the customer enroll again when current requirements are met. Manual activation remains available for a removed account. Super Admins can see the removal action when the backend returns `enrollmentPresent: true`, including provisional enrollments with pending enrollment payments. An active/historically enrolled account on an older backend also shows the disabled action with a backend-update explanation. Accounts without current enrollment have nothing to remove.

Removal is available by default for Super Admins when the backend supports the enrollment-removal contract. No environment variable or rollout switch is required. Apply backend migration `20261230_reseller_enrollment_removal.sql` after `20261229_reseller_enrollment_payments.sql`, deploy the updated backend/workers, and release customer clients that preserve and submit the backend's `enrollmentGeneration`. The admin dashboard does not calculate or submit customer enrollment generations.

The removal confirmation fetches the current enrollment immediately, shows the account and enrollment version, and requires confirmation of that state. It sends a bodyless `DELETE /admin-api/resellers/accounts/{accountId}?version={version}`. The API helper also supports the encoded email route. HTTP 204 has no JSON body. Completion refreshes enrollment and summary, plus account details when opened there; returning to the reseller directory loads its current records. Removed enrollments are excluded from the directory by the backend. Direct account/email lookup remains available, showing **Not enrolled** and customer eligibility instead of **Suspended**.

A 409 or an uncertain timeout/5xx clears the prior confirmation and reads the current enrollment. `removed: true` confirms the removed state. Any current enrollment requires fresh confirmation before another DELETE; a newer version is never retried automatically. If the status read fails, only refreshing the state is available. A 403 makes the confirmation unavailable for that session. Older backends without the new enrollment-state fields cannot expose a removal action.

Wallet balances, eligible earned-point redemption, deficits, financial/reward history, historical inviter holds, referral bindings and account overrides remain intact. Removal does not cancel or refund a pending enrollment collection. That collection may still credit the wallet once, but cannot activate the enrollment that was removed. Future purchases use the current non-reseller context; a later enrollment starts another period. Removal sends no customer notification; the backend audits it as `RESELLER_ENROLLMENT_REMOVED`.

## Commerce store creator-email filtering

Admin → Commerce → Stores includes a **Creator email** filter. Enter a full or partial Fondeka account email; matching ignores case and outer whitespace. The filter uses the store owner's account contact email, rather than the store's public contact email. Typing applies after 300 ms; Enter or Refresh applies the current value immediately, including during an earlier request. Changing the applied email resets pagination while preserving other filters. Clear filters resets the email, other filters and page, and includes all deletion states; the initial view uses active-only stores. Pending requests clear prior rows/totals and display loading; only the latest request can update the table or report an error.

The admin API accepts `creatorEmail` on `GET /admin-api/commerce/stores`, combined with `verificationStatus`, `status`, `visibility` and `deleted`. These are applied on the server before pagination, and totals describe the matching result set. Store status options follow the backend: DRAFT, ACTIVE, SUSPENDED and ARCHIVED; visibility is PUBLIC or PRIVATE. Archived stores require the deleted-only or all-deletion-states filter. Query values use `URLSearchParams`, preserving plus signs, literal wildcard characters and backslashes. Storefront `contactEmail` remains unchanged and is not used as the creator email. Deploy backend support before relying on the filter because older backends ignore it. No migration or customer-app change is needed.
