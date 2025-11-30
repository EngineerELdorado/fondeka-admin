# Admin KYC Management API

Base path: `${app.api.baseUrls.admin-api}/kycs`

## List KYC records (filterable)
`GET /kycs`

Query params:
- `page` (int, required) – 0-based
- `size` (int, required)
- Filters (all optional):
  - `status` (e.g., PENDING, APPROVED, REJECTED)
  - `level` (int)
  - `country` (ISO alpha2)
  - `accountRef` (string)
  - `accountId` (long)
  - `emailOrUsername` (string)
  - `internalRef` (string)
  - `externalRef` (string)
  - `idNumber` (string)
  - `startDate`, `endDate` (epoch millis) – filters by `updatedAt`

Returns: `Page<KycResource>` with standard Spring pagination fields (`content`, `totalElements`, `totalPages`, `number`, `size`, etc.).

Example:
```
GET /admin-api/kycs?page=0&size=20&status=PENDING&country=US&level=1&emailOrUsername=jane@example.com
```

## Get KYC by ID
`GET /kycs/{id}` → `KycResource`

## Update KYC (decision)
`PATCH /kycs/{id}`

Body: `KycUpdateAdminRequest` (fields optional; decision + full record edits):
```
{
  "kycDecision": "APPROVE|REJECT",
  "comments": "All docs valid",
  "idNumber": "...",
  "countryCode": "US",
  "docType": "PASSPORT",
  "firstName": "Jane",
  "lastName": "Doe",
  "otherNames": "M",
  "fullName": "Jane M Doe",
  "dob": "2020-01-01T00:00:00Z",
  "address": "...",
  "city": "...",
  "postalCode": "...",
  "houseNo": "...",
  "gender": "F",
  "level": 2,
  "issuedAt": "2023-01-01T00:00:00Z",
  "expiresAt": "2025-01-01T00:00:00Z",
  "externalReference": "..."
}
```

## Frontend integration notes
- Build a filter panel that maps to the query params above; allow combining filters.
- Validate `status` client-side to known values to avoid 400s.
- Display pagination controls using `totalElements/totalPages` from the response.
- For update, show a confirmation modal for APPROVE/REJECT and send `PATCH /kycs/{id}` with the decision and comments.
- Handle errors: 400 for bad filters, 404 for missing KYC on fetch/update.
- Consider debounced text inputs for `emailOrUsername` and `accountRef` to avoid spamming the API.

## Frontend adjustments
- Listing: use the new filter params to build a rich search form (status, level, country, accountRef/accountId, emailOrUsername, internal/external ref, idNumber, date range). Validate status client-side to known values.
- Detail view: display the expanded fields from `KycResource` (internal/external ref, account reference, username/email, level, full name, comments, timestamps, issued/expiry, provider comments).
- Update flow: send `PATCH /kycs/{id}` with `KycUpdateAdminRequest`. Only include fields changed; keep level editable if you allow upgrades/downgrades. Show a decision selector (APPROVE/REJECT) plus editable form for KYC fields. Confirm before submitting.
- Error handling: 400 for bad status/invalid payload, 404 for missing KYC. Use messages from the response when available.
- Pagination: leverage `Page` metadata (`totalElements`, `totalPages`, `number`, `size`).
