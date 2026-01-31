# Admin Payment Requests – Filters

This guide shows how the Admin Dashboard should query payment requests with rich filters and display results.

## Endpoint and auth
- Base path: `${app.api.baseUrls.admin-api}/payment-requests` (default `/admin-api/payment-requests`)
- Method: `GET`
- Auth: `Authorization: Bearer <admin JWT>`
- Pagination: required `page` (0-based, default 0) and `size` (default 20)

## Query parameters (all optional beyond pagination)
- Identifiers: `id`, `accountId`, `linkCode`
- Payer lookup: `email` (exact, case-insensitive), `phoneNumber` (exact)
- Text search (case-insensitive contains): `titleContains`, `descriptionContains`
- Enums: `type` (`QUICK_CHARGE`, `DONATION`, `INVOICE`), `approvalStatus` (`PENDING`, `APPROVED`, `REJECTED`), `lifecycle` (`DRAFT`, `NEW`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `EXPIRED`, `COMPLETED`)
- Currency: `currency` (ISO code, case-insensitive)
- Amount filters (inclusive): `amountGte`, `amountLte`, `minAmountGte`, `minAmountLte`, `maxAmountGte`, `maxAmountLte`
- Date filters (epoch millis, inclusive): `activationAfter`, `activationBefore`, `expiresAfter`, `expiresBefore`

## Behavior
- All filters are ANDed together; send only the fields the admin sets.
- String contains filters are case-insensitive; amount/date bounds are inclusive.
- Default sort follows repository order by id; if you need custom sorting, we can add it.
- Direct lookup: use `linkCode` for quick support searches when a merchant pastes a code.

## Response shape
Returns `Page<PaymentRequestResponse>`:
- Core fields: `id`, `accountId`, `type`, `title`, `description`, `images`, `amount`, `minAmount`, `maxAmount`, `goalAmount`, `currency`, `allowPartial`, `feeInclusion`
- Status: `approvalStatus`, `lifecycle`
- Lookup fields: `linkCode`, `checkoutSecretHash`
- Timing: `activationAt`, `expiresAt`
- Extras: `metadata`, `items[]`

## Sample requests
```
GET /admin-api/payment-requests?page=0&size=20&accountId=123&type=INVOICE&amountGte=10&amountLte=100&activationAfter=1717200000000&activationBefore=1719800000000
```
```
GET /admin-api/payment-requests?titleContains=invoice&lifecycle=ACTIVE&currency=usd
```
```
GET /admin-api/payment-requests?page=0&size=20&email=owner@example.com
```
```
GET /admin-api/payment-requests?page=0&size=20&phoneNumber=+243800000000&lifecycle=ACTIVE
```

## Dashboard integration tips
- Build a filter panel from the parameters above; only submit non-empty values to keep queries fast.
- Provide sensible defaults (e.g., empty filters with `page=0&size=20`).
- Preserve pagination state when filters change so admins can refine searches without losing context.
- Surface `linkCode` in the table and detail views for quick merchant lookups.
- Show `activationAt`/`expiresAt` alongside lifecycle to clarify why a request might not be payable.
