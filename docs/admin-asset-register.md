# Fondeka asset register and valuation reports

Implemented in the backend and admin dashboard; deployment is not performed by this change.

## Admin workflow

Open **Asset register / Registre des actifs** in the dashboard menu (`/dashboard/assets`). Access is restricted to ADMIN and SUPER_ADMIN.

PDF generation is also available under **Reports → Asset valuation reports / Rapports → Rapports de valorisation des actifs** (`/dashboard/reports/assets`). Both entry points recover the same saved export request and job for the signed-in admin.

Use **Categories** to add, rename, reorder, archive or reactivate categories. The migration seeds computers, tables, chairs, carpets, vehicles, legacy receivables and other assets. These are editable definitions, not a fixed list of supported property types. No actual assets or invented valuations are seeded.

Each category has a nature:

- **TANGIBLE:** physical assets such as computers, furniture, vehicles or buildings.
- **RECEIVABLE:** amounts still being recovered, including loans from earlier businesses.
- **OTHER:** other property or rights that Fondeka wants to record.

Nature is fixed for a category. To correct an asset's classification, choose a different category in a new dated revision. Archiving a category removes it from ordinary new-entry choices; it never removes existing assets from totals. Historical/backfill API submissions may still explicitly reference it.

Use **Register an asset** to record a name, category, quantity, currency, estimated total value and the date that value applies from. A valuation reason is required. Optional information includes French name, acquisition date, location, responsible person, serial number/external reference and notes. References can be provided or generated automatically. References and currency are immutable once registered.

**Estimated value is the total for the entire entry, not a unit price.** For ten chairs worth USD 100 together, enter quantity `10` and estimated value `100.00`. The register adds USD 100, not USD 1,000. Record individual assets separately when they need individual serial numbers, responsibility or disposal histories.

An unknown estimate stays blank/null and is reported as unvalued. An explicit zero is a known zero. Values must be nonnegative and use the currency's minor-unit precision. Currencies are never combined or automatically converted. The overview shows separate totals for each currency.

## Legacy receivables

Register an old-business loan under a RECEIVABLE category, with quantity `1`:

- `outstandingAmount` is the amount still owed, when known.
- `estimatedValue` is the total expected to be recovered. It can be lower than the amount owed and cannot exceed it when both are provided.
- Only the estimated value enters the asset total. The outstanding amount is supporting information and is not added again.

For example, a USD 1,000 debt with expected recovery of USD 600 contributes USD 600 to the register. After a partial recovery, record a new dated revision of the remaining debt and its estimated recoverable value. When fully recovered, use RECOVERED and set estimated value to zero; any recorded outstanding amount must also be zero.

These are manual company records. Registering, revising or recovering a receivable creates no platform loan, customer debt restriction, payment, wallet movement or transaction revenue. Do not copy customer wallet balances into this register as company-owned property. Cash received from an old debt must be handled through the company's separate financial records; it is not automatically posted here.

## Dates, backfilling and history

The register is a stock of property at a point in time, rather than monthly income or spending. Choose an **as-of date**, for example `2025-12-31`, to view or export a year-end position. Values are not summed across months.

Every asset write appends an immutable dated revision. Revisions contain the full entry, captured category labels/nature, actor ID, server recording time and reason. They also increment the asset's global version. There is no hard-delete endpoint.

The position at a date is the revision with the latest `effectiveDate` on or before that date. If two revisions share that date, the later recorded revision wins. A backfilled correction does not replace a later effective valuation:

| Effective date | Estimated value | Result |
| --- | --- | --- |
| 2025-01-01 | USD 500 | Opening valuation. |
| 2026-01-01 | USD 300 | Current valuation. |
| 2025-10-01, entered later | USD 400 | Corrects the 2025 year-end to USD 400; the 2026 value stays USD 300. |

An acquisition date is descriptive. It does not manufacture an older valuation. For historical reports, explicitly backfill a revision effective on or before the requested reporting date. Dates from 1900 through today are supported; future valuations are rejected.

`recordedAt` indicates when admin entered the information; `effectiveDate` indicates when it applies. A historical report generated today includes backfilled corrections known at capture time. An already generated PDF retains its original immutable snapshot.

`version` is the asset's current global concurrency version. `revisionVersion` identifies the dated revision returned by the as-of read. They may differ after backfilling or a later valuation. Send `expectedVersion` using the current global `version`, not `revisionVersion`.

Statuses:

| Status | Treatment |
| --- | --- |
| ACTIVE | Held property / outstanding receivable; included in owned-value totals. |
| DISPOSED | Retained for history; excluded from held totals from its effective date. |
| RECOVERED | Fully recovered receivable; zero remaining estimated value, excluded from held totals. |
| WRITTEN_OFF | Retained for history, excluded from held totals. |

Closed entries can be shown explicitly using **Include closed entries**. Their stored values are shown for reference but excluded from totals. These status changes do not imply that cash was received or a payment/refund occurred. A past as-of report still sees the earlier held revision.

## API contract

All endpoints use existing admin bearer authentication and `Cache-Control: no-store`. No API version changes or customer-app changes are needed.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/admin-api/asset-categories?page=0&size=50&includeArchived=true` | Paginated category definitions. |
| POST | `/admin-api/asset-categories` | Create a category. |
| PUT | `/admin-api/asset-categories/{id}` | Edit labels/order/active status with current `version`; nature is immutable. |
| GET | `/admin-api/assets` | Paginated as-of register. |
| GET | `/admin-api/assets/summary` | Complete filtered totals, grouped by currency independently of pagination. |
| GET | `/admin-api/assets/{id}?asOf=2025-12-31` | One asset at a date; 404 if no revision yet existed. |
| POST | `/admin-api/assets` | Register an asset and its opening revision; HTTP 201. |
| POST | `/admin-api/assets/{id}/revisions` | Append a revision with `expectedVersion`; HTTP 200. |
| GET | `/admin-api/assets/{id}/history?page=0&size=10` | Immutable revisions, newest recording first; maximum 20 per page. |
| POST | `/admin-api/asset-reports/exports` | Queue a professional PDF; HTTP 202. |
| GET | `/admin-api/asset-reports/exports/{id}` | Poll progress / refresh a signed download. |

GET register and summary accept `asOf` (default UTC today), optional `currency`, `categoryId`, `nature`, `includeInactive` (default false) and `search`. Search matches literal text in reference, names, location, custodian and identification. Filtering occurs after selecting each asset's latest eligible revision; a disposed or reclassified entry cannot accidentally reappear through an older matching revision.

Lists use `{content:[...],page:{number,size,totalElements,totalPages}}`, with zero-based pages and sizes 1–200 unless otherwise stated. At most 500 categories may be active. Archived categories remain paginated and retain all referenced history.

All POST/PUT operations require `Idempotency-Key` (1–128 letters, digits, `.`, `:`, `_`, `-`). Persist the exact request and key before submission. Retry timeouts and 5xx using the same request/key. Replays return the original accepted operation result, including its original revision/version. A changed request under the same key returns `409 IDEMPOTENCY_CONFLICT`. A stale new edit, duplicate reference/name or attempted category-nature change returns `409 INVALID_REQUEST`; reload before creating a new intent.

Create a category:

```json
{"nameEn":"Office equipment","nameFr":"Matériel de bureau","nature":"TANGIBLE","active":true,"displayOrder":80}
```

Category PUT is a full replacement: send those editable fields and `version`. English labels are required and unique ignoring case/outer whitespace; French is optional. Both are plain text, at most 200 characters. Existing asset revisions retain their captured labels when a category is renamed. A later revision captures the selected category's current labels.

Register a batch of chairs:

```json
{
  "reference":"OFFICE-CHAIRS-001",
  "currency":"USD",
  "effectiveDate":"2025-12-31",
  "categoryId":3,
  "nameEn":"Office chairs",
  "nameFr":"Chaises du bureau",
  "quantity":10,
  "estimatedValue":"100.00",
  "status":"ACTIVE",
  "location":"Goma office",
  "reason":"Year-end inventory and estimated resale value"
}
```

IDs in examples refer to the seeded definitions; fetch the actual catalogue rather than hardcoding IDs. Omit/null `reference` for automatic generation. User-supplied references normalize to uppercase and accept letters, digits, `.`, `:`, `_`, `-`, up to 100 characters. Reference and currency cannot be changed in later revisions. If correcting a mistaken currency, explicitly close the erroneous entry and create the replacement, with explanatory reasons and dates, so the same economic asset is not counted twice.

Revision POST uses the same full record shape plus `expectedVersion`. All editable fields replace that revision's snapshot; supply retained optional values rather than relying on patch semantics. Optional fields: `outstandingAmount`, `acquisitionDate`, `location` (300 characters), `custodian` (200), `identification` (200), `note` (4,000). Required reason: up to 1,000 characters. Quantity is a whole number 1–1,000,000; receivables use 1. Responses return exact decimal strings or null for money, alongside `id`, `reference`, `currency`, `version`, `revisionId`, `revisionVersion`, effective date, status, `includedInTotal`, names/category snapshots, actor and recording timestamps.

## Reports

```json
{
  "asOf":"2025-12-31",
  "currency":"USD",
  "language":"fr",
  "timeZone":"Africa/Kinshasa",
  "categoryId":null,
  "nature":null,
  "includeInactive":false,
  "includeDetails":true
}
```

Reporting date and currency are explicit, so an interrupted submission cannot silently change criteria on a later day. French regional tags normalize to French. Supported languages: English and French. Category/nature filters are optional; their scope is printed in the PDF. A conflicting nature/category pair or unknown category is rejected. Dashboard report controls start from the selected as-of date/category/currency/nature, and the admin can review them before submission. Search text and table pagination do not narrow the PDF.

The report includes the configured Fondeka company header, reporting date, currency, filter scope, physical/receivable/other subtotals, category totals, final estimated value and optional complete inventory detail. Detail includes reference, names, category, quantity, value date, estimated total, and optional identification/location/responsible person and remaining debt. Missing valuations are marked and partial totals are clearly labelled. Closed entries are explicitly excluded, even when their reference values appear in the detail.

The queue returns 202 promptly. Poll with increasing intervals; the dashboard stops automatic checks after 12 reads or an error and offers an explicit check. Jobs are durable and statuses are QUEUED, PROCESSING, COMPLETED, FAILED, EXPIRED. Recovery survives page reload in account-scoped session storage; signed URLs are never persisted.

The worker captures the complete filtered register in a repeatable-read transaction and persists an immutable snapshot. Rendering and storage upload run outside the database transaction. Edits before capture are included; later edits require a new report. Retries reuse the snapshot. Exports are bounded to 10,000 records; narrow category/nature for larger registers. Per admin: three outstanding exports and 20 requests per 24 hours.

Only the requesting admin, or SUPER_ADMIN, can read a report. Completed GETs issue private HTTPS links lasting at most five minutes and never beyond the report's 24-hour lifetime. The report uses embedded fonts, green Fondeka styling, repeated table headings and page numbers. No external user URLs are fetched during rendering.

## Deployment and verification

Apply migration `20270143_admin_asset_register.sql` through the normal Liquibase release. It creates separate asset/category/revision/idempotency/export tables and seeds definitions only. Existing customer, loan, wallet, revenue and expense data are not migrated into the register.

Run the usual web and worker profiles. Asset exports reuse `ADMIN_EXPORTS_S3_BUCKET`, its private encrypted storage permissions and existing `app.revenue-reports.company-*`, tax-number, email and website settings. Without configured export storage, report submission returns a safe 503 while register management remains available. No new provider credentials are required.

The separate asset queue uses a single platform-thread worker, five-minute fenced leases, at most three attempts and expiry cleanup. A stale claim cannot publish over a newer worker's report. A failed export does not block subsequent jobs.

QA covers batch values counted once, debt face amount versus recoverable estimate, missing versus zero values, currency isolation, past/current valuations, same-date corrections, backfill after newer valuations, disposal/reclassification without resurrection, category archiving, conflicting edits, idempotent replay, private report access, frozen snapshots, failure recovery and bilingual PDF pagination. Complete storage acceptance against the configured admin export bucket during normal release QA. No production payments or deployment are performed by this change.
