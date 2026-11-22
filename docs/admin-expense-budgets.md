# Expense budgets and expense reports

Status: implemented for backend and admin dashboard; not deployed by this change.

## Where to go

Sign in as **ADMIN** or **SUPER_ADMIN**, then open **Expense budgets / Budgets de dépenses** in the dashboard menu (`/dashboard/expenses`). Other admin roles cannot access company expense records or exports.

The page has two tabs:

- **Monthly budgets:** choose a month and currency, enter planned and actual amounts, add/remove categories, and review edit history.
- **Expense categories:** add categories, edit English/French labels, change their order or archive/reactivate them. No release is needed to introduce a new expense category.

**Export expense PDF** opens the asynchronous reporting flow. Choose English or French, a month or complete-month date range, one currency, actual expenses or budget-versus-actual, and optional monthly details. Submission returns immediately; the dashboard polls for progress and provides a private download when ready.

The **Reports / Rapports** menu also has two dedicated pages: **Revenue reports / Rapports de revenus** (`/dashboard/reports/revenue`) reuses the existing transaction-profit PDF flow, and **Expense reports / Rapports de dépenses** (`/dashboard/reports/expenses`) opens the expense PDF flow. The existing Service mix and monthly-budget export buttons remain available. Both reporting pages require ADMIN or SUPER_ADMIN and recover the same pending request when accessed from either entry point.

## Mental model

An expense category is a reusable definition, for example hosting, marketing or office costs. A monthly budget contains captured category labels and two independent amounts: **planned** and **actual**. Actual spending is entered by admin; it is not inferred from a planned budget or automatically posted from wallet/provider transactions.

Budget amounts are management records, not payment instructions. Recording or correcting an expense moves no money, calls no payment provider and changes no customer balance. Company expenses remain separate from the existing transaction-profit report. Some provider costs may already be reflected in transaction margins; reconcile those costs before making a separate company-level calculation.

Catalogue changes apply to new budgets. Existing months retain their captured names, amounts and notes, including when a category is archived. An archived category remains visible on months where it was used. To change an existing month, edit that monthly budget explicitly. A category may be removed from a month without deleting its definition or earlier history.

## Initial catalogue and the CSV

Migration `20270142_admin_expense_budgets.sql` creates the tables and seeds **24 editable category definitions** inspired by `expenses_budget.csv`. It seeds no historical budget, reporting month, currency or actual expense. The CSV does not identify those financial dimensions, so they must be chosen explicitly.

Creating a month offers these starting points:

1. **EMPTY:** active categories with blank planned and actual amounts.
2. **COPY:** copy planned amounts from a chosen existing month in the **same currency**. Actual amounts stay blank. New active categories are added with blank amounts; archived categories are excluded. Current catalogue labels are captured for the new month.
3. **CSV:** apply the supplied starter amounts to active seeded categories. Importing its actual amounts is a separate, unchecked-by-default choice. Confirm the selected month and currency before using either set of figures. Custom categories have no invented starter amount.

The original CSV is preserved. The private backend starter template records its SHA-256 and is not a public web asset. Its original control totals are planned **10,694.00** and actual **6,003.75**; the template endpoint totals reflect the seeded categories that are currently active.

## Historical entry and corrections

Select any month from January 2000 onward, including prior years. Future months are allowed for planning. Create the month, enter the figures and save; repeat for the months required for the year-end report.

- Leave unknown amounts **blank**. Enter **0** only for a confirmed zero amount. Blank actuals are never silently treated as completed spending data.
- Planned amounts must be nonnegative. Actual amounts may be negative to record a credit/reversal. Explain such adjustments in the line note.
- Use the currency's minor-unit precision, for example USD `12.50`, JPY `12`, KWD `12.500`. No rounding or automatic currency conversion is applied on entry.
- The month and currency are immutable. There is one budget per month/currency. Correct a wrong selection by creating the appropriate month/currency record and explicitly correcting the mistaken entries with an explanatory note; there is no silent move or hard-delete operation.
- Each save records the admin ID, server timestamp and full before/after snapshot, and increments the version once.
- Concurrent edits fail with HTTP 409; reload before applying a new change. A replay of the same accepted operation returns its original result even if a later edit has changed the version.

## API contract

All routes use existing admin bearer authentication and return `Cache-Control: no-store`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/admin-api/expense-items?page=0&size=50&includeArchived=true` | Paginated category catalogue. |
| GET | `/admin-api/expense-items/{id}` | One category. |
| POST | `/admin-api/expense-items` | Create a category. |
| PUT | `/admin-api/expense-items/{id}` | Replace editable fields, with current `version`. |
| GET | `/admin-api/expense-budgets?currency=USD&fromMonth=2025-01&toMonth=2025-12&page=0&size=50` | Paginated monthly summaries and entry counts. Filters are optional. |
| GET | `/admin-api/expense-budgets/template` | Private starter template; no month or currency assigned. |
| GET | `/admin-api/expense-budgets/by-month?month=2025-01&currency=USD` | Find an exact month/currency; 404 if not entered. |
| GET | `/admin-api/expense-budgets/{id}` | Full budget and totals. |
| POST | `/admin-api/expense-budgets` | Create a selected month. |
| PUT | `/admin-api/expense-budgets/{id}` | Replace that month's line set, with `expectedVersion`. |
| GET | `/admin-api/expense-budgets/{id}/history?page=0&size=10` | Before/after audit snapshots, newest first; maximum 20 per page. |
| POST | `/admin-api/expense-reports/exports` | Queue a PDF; HTTP **202**. |
| GET | `/admin-api/expense-reports/exports/{jobId}` | Read status or obtain a fresh signed download. |

Every POST/PUT requires `Idempotency-Key` (1–128 letters, digits, `.`, `:`, `_`, `-`). Keys are scoped to admin and operation/resource. Persist the exact request and key before submission. Retry timeouts/5xx with that same key and body; never generate a replacement key while an outcome is unresolved. Reusing a key with different normalized data returns `409 IDEMPOTENCY_CONFLICT`. Catalogue and budget version conflicts use `409 INVALID_REQUEST` with a reload message.

Create a category:

```json
{"nameEn":"Office rent","nameFr":"Loyer du bureau","active":true,"displayOrder":250}
```

Update a category: send the same editable fields plus `"version":0`. This PUT is a full replacement: explicitly send `active`, labels and order. Use `active:false` to archive. English name is required and unique ignoring case and surrounding whitespace. French is optional and falls back to English for reports. Labels are plain text, maximum 200 characters. At most 500 categories may be active.

Create a past month:

```json
{"month":"2025-01","currency":"USD","source":"EMPTY","includeSourceActuals":false,"note":"Backfilled from January records"}
```

For COPY supply `source:"COPY"` and `copyFrom:<budget UUID>`. For the provided template use `source:"CSV"`, with `includeSourceActuals:true` only when deliberately importing its actual figures.

Save a monthly budget:

```json
{
  "expectedVersion":0,
  "note":"January figures reconciled",
  "lines":[
    {"expenseItemId":1,"planned":"100.00","actual":"50.00","note":"Invoice reference ABC"},
    {"expenseItemId":2,"planned":"30.00","actual":null,"note":null}
  ]
}
```

The line set replaces the prior set; omitted lines are removed from this month. Duplicate category IDs and unknown IDs are rejected. Maximum 500 lines, 2,000 characters per line note and 4,000 per month note. Request amounts accept JSON decimals or decimal strings; **response amounts are decimal strings or null**, preserving precision. Responses include budget ID, month, currency, numeric `version`, captured labels, live `itemActive`, totals, entry counts, actor IDs and timestamps. `variance = planned - actual` (positive means under budget). A variance is null when required values are missing. Partial totals sum known entries, with counts and `complete:false`; do not present those as final complete totals.

Lists use `{content:[...],page:{number,size,totalElements,totalPages}}`; page numbers start at zero, size 1–200 unless otherwise stated.

## Reports and downloads

```json
{
  "from":"2025-01-01",
  "to":"2025-12-31",
  "currency":"USD",
  "language":"fr",
  "timeZone":"Africa/Kinshasa",
  "mode":"BUDGET_VS_ACTUAL",
  "includeDetails":true
}
```

Alternatively send `month:"2025-01"` instead of `from`/`to`. A range must start on a month's first day and end on a month's last day, at most 24 months. Monthly aggregates cannot be prorated into daily estimates. `ACTUALS` is the default mode. French regional tags such as `fr-CD` normalize to French. Other supported language: English.

The 202 response includes `id`, `reportType:"EXPENSES"`, `status`, `fromDate`, `toDate`, currency, language, timezone, mode, details choice, timestamps and expiry. Poll the GET with increasing intervals. Statuses are `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `EXPIRED`. The dashboard limits automatic polls to 12 and offers an explicit progress check. A saved job survives page reload during the same signed-in browser session. Signed URLs and OTPs are never stored in session recovery.

Completed GETs return `downloadUrl` and `downloadUrlExpiresAt`. Links are private HTTPS, expire after at most five minutes, and never outlive the report's 24-hour lifetime. Obtain a fresh link with another authorized GET. The requesting admin can read the job; SUPER_ADMIN may read other admins' jobs. Replays of POST never render or sign a download.

The PDF includes the configured company header, month name/date range, currency, category totals, final total and optional month/category detail. It uses green Fondeka styling, embedded fonts, repeating table headings and page numbers. English/French category labels are taken from monthly snapshots. Aggregated categories use their latest label within the selected period; detailed months retain their original labels. Missing months and unfilled amounts are identified, and incomplete overall variance is omitted. Different currencies are never summed. A complete empty monthly line set is an explicit zero; an unentered month is missing data.

The worker captures a consistent immutable dataset when processing begins, recording `snapshotAt`. Edits before capture are included; later edits require a new export. Retries reuse the captured snapshot. PDF rendering and storage upload run outside the database transaction. Each export is bounded to 10,000 detail lines; choose a shorter range for a larger catalogue. Per admin: at most three outstanding jobs and 20 submissions in 24 hours.

## Deployment and QA

Apply migration 20270142 through the normal Liquibase release flow. Existing revenue, customer and provider tables are unchanged. Run both web and worker profiles as usual. Exports reuse the existing `ADMIN_EXPORTS_S3_BUCKET` and its private/encrypted storage permissions. Company identity reuses `app.revenue-reports.company-*`, tax-number, email and website settings. No separate expense storage credentials are introduced. Without configured export storage, submission returns a safe 503; budgeting remains available.

The expense queue is separate from revenue exports, with a single platform-thread worker, five-minute fenced leases, at most three attempts, bounded polling and expiry cleanup. A stale worker cannot replace a newer claim's report.

Before release, verify: create/backfill a past month; edit plan/actual with blank and zero amounts; create/archive/rename a category; copy a plan without actuals; retry a lost save with the same key; reject a concurrent stale edit; export a month and year range in both languages; verify partial/missing-month disclosure; verify private download and expiry. Use an admin export bucket for full storage acceptance. No customer payments or production data changes are needed for these checks.
