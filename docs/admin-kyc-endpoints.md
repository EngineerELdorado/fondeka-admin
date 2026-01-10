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

## Refresh SmileID result (admin)
`POST /kycs/{kycId}/smileid-result`

Auth: admin bearer token (same as other admin endpoints).

Body: none required.

What it does:
- Calls SmileID `getJobStatus` using the account internal reference + the KYC job reference.
- Applies the same update logic as the SmileID webhook (updates KYC + KycJob, maps status, sets fields like ID info, comments, dates).
- If the status changes, it triggers the usual KYC notification logic.
- Returns the raw SmileID KYC result payload.

Prerequisites:
- KYC record exists.
- KYC has a job reference (`lastJobReference`, falls back to `externalReference`).
- Account has an internal reference.

Expected responses:
- 200 with a `KycResult` payload on success.
- 400 if the KYC is missing account reference or job reference.
- 500 if SmileID did not return a result.

Example:
```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  https://<admin-host>/admin-api/kycs/123/smileid-result
```

Notes:
- Intended for manual refresh/reconciliation when webhooks are delayed or missed.
- Safe to call multiple times; notifications only fire if the status changes.
- Response is the provider's raw job status payload; some fields can be null/Not Available.
- `ImageLinks` may include `id_card_back` in addition to front/selfie.

Example response (200):
```json
{
  "Actions": {
    "Document_Check": "Sent to Human Review",
    "Human_Review_Compare": "Not Applicable",
    "Human_Review_Document_Check": "Passed",
    "Human_Review_Liveness_Check": "Not Applicable",
    "Liveness_Check": "Passed",
    "Register_Selfie": "Approved",
    "Return_Personal_Info": "Returned",
    "Selfie_To_ID_Card_Compare": "Completed",
    "Verify_Document": "Passed"
  },
  "Address": "BLUE HEIGHTS LANGATA\n00100 NAIROBI\nKEN KENYA",
  "Country": "CD",
  "DOB": "1992-10-28",
  "ExpirationDate": "2026-01-27",
  "FirstName": "WATSHIPAMPA KALENGA",
  "FullName": "DENIS KALENGA WATSHIPAMPA",
  "Gender": "M",
  "IDNumber": "OP0739797",
  "IDType": "PASSPORT",
  "ImageLinks": {
    "id_card_image": "https://.../SID_IDCard.jpg",
    "id_card_back": "https://.../SID_IDCard_Back.jpg",
    "selfie_image": "https://.../SID_Preview_Full.jpg"
  },
  "IssuanceDate": "2021-01-28",
  "LastName": "DENIS",
  "OtherName": "Not Available",
  "PartnerParams": {
    "job_id": "JOB589776766980",
    "job_type": 6,
    "user_id": "FDK085715501457"
  },
  "PhoneNumber": "Not Available",
  "PhoneNumber2": "Not Available",
  "ResultCode": "0810",
  "ResultText": "Document Verified After Human Review",
  "SecondaryIDNumber": "A22010000543",
  "SmileJobID": "1000000033",
  "signature": "5JWRKUjyO8X4PZEBy22bUXTLURsfA0VxjmWZZFEIdRE=",
  "timestamp": "2026-01-10T21:48:59.592Z"
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
