# Admin Usage Guide: Credit Wallet

This guide describes how to create wallet credit transactions for an account via the Admin API.

## Endpoint
- Method: `POST`
- Path: `/admin-api/accounts/{accountId}/wallet/credit`

## Request Body
```json
{
  "amount": 50,
  "action": "BONUS" | "MANUAL_ADJUSTMENT",
  "note": "Optional note shown on receipt"
}
```

## Behavior
- `action` is optional; default is `MANUAL_ADJUSTMENT`.
- Only `BONUS` and `MANUAL_ADJUSTMENT` are accepted.
- Creates a wallet credit transaction and notifies the user.

## Examples
Manual adjustment (default)
```json
{
  "amount": 50,
  "note": "Reconciliation adjustment"
}
```

Bonus
```json
{
  "amount": 10,
  "action": "BONUS",
  "note": "Promo bonus"
}
```
