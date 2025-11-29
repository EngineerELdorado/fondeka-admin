# Admin Accounts API (Read-Only)

This guide describes how the Admin Dashboard can query accounts with rich filters and receive detailed account data, including the last 10 transactions.

## Endpoint
- Base path: `${app.api.baseUrls.admin-api}/accounts`
- Method: `GET`
- Pagination: required `page` (0-based) and `size` (default 20 recommended).

## Query Parameters (all optional unless noted)
- `page`, `size`
- Account identifiers: `accountId`, `accountReference` (or `accountNumber`)
- User identifiers: `userReference` (user.internalReference or oauth_id), `usernameContains` (substring, case-insensitive)
- Contact identifiers: `email`, `phone`
- `countryId`: filter by account country
- Date range: `startDate`, `endDate` (epoch millis; defaults: start=0, end=now)

Direct lookups: when `email`, `phone`, or `accountReference/number` is provided, the API short-circuits to a fast direct lookup.

## Response
`Page<AdminAccountResource>`

```json
{
  "content": [
    {
      "accountId": 1,
      "accountReference": "ACC-123",
      "countryId": 45,
      "countryName": "Congo",
      "countryCode": "CD",
      "userFirstName": "Jane",
      "userLastName": "Doe",
      "userMiddleName": "Q",
      "username": "jane.doe",
      "userReference": "USR-123",
      "email": "jane@example.com",
      "emailVerified": true,
      "phoneNumber": "+243800000000",
      "phoneVerified": true,
      "kycStatus": "APPROVED",
      "kycProvider": "SMILE_ID",
      "kycLevel": 2,
      "balance": 120.50,
      "previousDebt": 0.00,
      "eligibleLoanAmount": 500.00,
      "lastTransactions": [
        {
          "id": 987,
          "createdAt": "2024-05-01T10:00:00Z",
          "reference": "TX123",
          "externalReference": "EXT-ABC",
          "operatorReference": "OP-999",
          "idempotencyKey": "IDEMP-1",
          "accountReference": "ACC-123",
          "recipient": "Recipient info",
          "amount": 42.00,
          "debitOrCredit": "CREDIT",
          "status": "COMPLETED",
          "service": "WALLET",
          "action": "FUND_WALLET",
          "refunded": false
        }
      ],
      "cryptoWallets": [
        {
          "id": 5,
          "balance": 0.1234,
          "currency": "BTC",
          "productName": "Bitcoin Wallet",
          "networkName": "BITCOIN",
          "networkDisplayName": "Bitcoin"
        }
      ]
    }
  ],
  "pageable": { ... },
  "totalElements": 1,
  "totalPages": 1
}
```

## Notes
- Read-only endpoint; no mutations on accounts here.
- `lastTransactions` includes up to the 10 most recent transactions for the account.
- Combine filters freely; leave date range empty to use the widest window (0 to now).
