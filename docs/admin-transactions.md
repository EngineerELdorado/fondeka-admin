# Admin Transactions API (Read-Only)

This guide explains how the Admin Dashboard can query transactions with rich filters.

## Endpoint
- Base path: `${app.api.baseUrls.admin-api}/transactions`
- Method: `GET`
- Pagination: required `page` (0-based) and `size` (default 20 recommended).

### Query Parameters (all optional unless noted)
- `page`, `size`: pagination
- `reference`: transaction internal reference
- `externalReference`: provider/external reference
- `operatorReference`: operator-specific reference
- `idempotencyKey`
- `action`: enum `Action`
- `service`: enum `Service`
- `balanceEffect`: enum `BalanceEffect`
- `status`: enum `TransactionStatus`
- `paymentMethodId`: ID of payment method (via PMP)
- `paymentProviderId`: ID of payment provider (via PMP)
- `paymentMethodPaymentProviderId`: PMP ID
- `accountReference`: account internal reference
- `userReference`: user internal reference/oauth_id
- `userNameContains`: substring match on username (case-insensitive)
- `minAmount`, `maxAmount`: numeric filters
- `refunded`: boolean (true => refundedAt not null; false => refundedAt null)
- `startDate`, `endDate`: epoch millis for createdAt range (default: from 0 to now)

### Response
`Page<AdminTransactionResource>`
```json
{
  "content": [
    {
      "customer": "Jane Doe",
      "username": "jane.doe",
      "accountReference": "ACC-123",
      "transactionId": 123,
      "createdAt": "2024-05-01T10:00:00Z",
      "reference": "TX123",
      "externalReference": "EXT-ABC",
      "operatorReference": "OP-999",
      "idempotencyKey": "IDEMP-1",
      "recipient": "Recipient info",
      "amount": 42.00,
      "debitOrCredit": "CREDIT",
      "status": "COMPLETED",
      "service": "WALLET",
      "action": "FUND_WALLET",
      "refunded": false,
      "paymentMethodId": 10,
      "paymentProviderId": 20
    }
  ],
  "pageable": { ... },
  "totalElements": 1,
  "totalPages": 1
}
```

## Notes
- Endpoint is read-only; approval/rejection flows have been removed.
- Filters can be combined freely to trace transactions from any available identifier (references, PMP, user/account, amounts, refund state).
- `startDate`/`endDate` default to the widest range if not provided.
