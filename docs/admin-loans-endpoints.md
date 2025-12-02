# Admin Loan Management API

Base path: `${app.api.baseUrls.admin-api}/loans`

## List loans (highly filterable)
`GET /loans`

Required: `page` (int, 0-based), `size` (int)

Optional filters (all query params):
- `loanType` (enum)
- `applicationStatus` (enum)
- `fromDate`, `toDate` (epoch millis) filter by `createdAt`
- `loanReference` (loan internal ref)
- `transactionReference` (tx internal ref)
- `externalTransactionReference`
- `accountReference`
- `userEmailOrUsername`
- `userPhoneNumber`
- `minAmount`, `maxAmount`

Response: `Page<AdminLoanResource>` with `loan` (LoanResource) + admin metadata + account/user/tx references.

Example:
```
GET /admin-api/loans?page=0&size=20&applicationStatus=PENDING&accountReference=FDK123&userEmailOrUsername=jane@example.com&minAmount=50&maxAmount=300
```

`AdminLoanResource` fields:
- `customer`: borrower name
- `loan`: LoanResource (id, amount, remainingBalance, reference, applicationStatus, approval/payment dates, etc.)
- `processedBy`, `adminDecidedAt`, `adminDecisionComments`
- `accountReference`, `username`, `email`, `phoneNumber`
- `transactionReference`, `transactionExternalReference`

## Get loan by id
`GET /loans/{loanId}` → `LoanResource`

## Approve loan
`PUT /loans/{loanId}/approve`
- Body: `ProcessLoanDto` (e.g., `{ "decisionComments": "OK" }`)
- Behavior: locks loan, requires PENDING status, checks transaction not FAILED/missing, marks loan APPROVED/OPEN, completes transaction, credits wallet, creates installments, notifies user.

## Reject loan
`PUT /loans/{loanId}/reject`
- Body: `ProcessLoanDto` with comments
- Behavior: locks loan, blocks if already APPROVED, marks tx FAILED, sets applicationStatus=REJECTED, records decision, notifies user with comments.

## Frontend integration notes
- Use filter params to build a search form; validate enums client-side.
- Display contact info and transaction refs from `AdminLoanResource` for quicker triage.
- Approval/rejection: confirm before sending; show comments field for reject. Handle errors: 400 (invalid state), 404 (not found).
- Pagination: use `Page` metadata (`totalElements`, `totalPages`, `number`, `size`).
