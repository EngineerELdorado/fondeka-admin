# KYC Cap Admin API

Admin endpoints to manage KYC caps (per KYC level) for loan/collection/payout limits.

Base path: `${app.api.baseUrls.admin}/kyc-caps`

## Schema
- `level` (int, unique): KYC level (0–5)
- `cap` (decimal): legacy/general cap
- `maxLoanAmount` (decimal): max loan amount for this KYC level
- `maxCollectionAmount` (decimal): max deposit/collection amount
- `maxPayoutAmount` (decimal): max payout/withdraw amount

## Resources
- `KycCapRequest`
  ```json
  {
    "level": 1,
    "cap": 200.00,
    "maxLoanAmount": 200.00,
    "maxCollectionAmount": 200.00,
    "maxPayoutAmount": 200.00
  }
  ```
- `KycCapResource`
  ```json
  {
    "id": 10,
    "level": 1,
    "cap": 200.00,
    "maxLoanAmount": 200.00,
    "maxCollectionAmount": 200.00,
    "maxPayoutAmount": 200.00
  }
  ```

## Endpoints
### List
`GET /kyc-caps`

Query params (all optional except pagination):
- `page` (default 0), `size` (default 20)
- `level`
- `minCap`, `maxCap`
- `minLoan`, `maxLoan`
- `minCollection`, `maxCollection`
- `minPayout`, `maxPayout`

Returns: `Page<KycCapResource>` (Spring page metadata + content array).

Example:
```
GET /kyc-caps?page=0&size=20&level=1&minLoan=100&maxLoan=500
```

### Create
`POST /kyc-caps`

Body: `KycCapRequest` (level required, level must be unique).

Example:
```
POST /kyc-caps
Content-Type: application/json

{
  "level": 2,
  "cap": 500.00,
  "maxLoanAmount": 500.00,
  "maxCollectionAmount": 500.00,
  "maxPayoutAmount": 500.00
}
```

### Update
`PUT /kyc-caps/{id}`

Body: `KycCapRequest` (only provided fields are updated). If `level` changes, uniqueness is enforced.

### Delete
`DELETE /kyc-caps/{id}`

Deletes the cap row (404 if not found).

## Frontend integration notes
- Use the list endpoint with query params for filtering/pagination.
- When editing, pre-fill with `KycCapResource`; consider making `level` immutable to avoid 409 conflicts.
- Validate numbers client-side; handle errors:
  - `409` if level already exists
  - `400` for bad input
  - `404` for missing rows on update/delete
- Display all four amount fields with clear labels (loan/collection/payout/general cap).

## Migrations
- `35_create_kyc_cap_table.sql`: creates `kyc_caps` and seeds levels 0–5
- `36_extend_kyc_cap_table.sql`: adds `max_loan_amount`, `max_collection_amount`, `max_payout_amount`, backfills with previous cap
