# Backend handoff: dashboard fiat wallet holdings are missing

## Issue

The admin dashboard calls:

```http
GET /admin-api/dashboard
```

The frontend expects the fiat-wallet breakdown at:

```text
holdings.fiatHoldings
```

The current backend response contains the aggregate fiat balance but does not contain `fiatHoldings`.

## Current response

The relevant part of the response currently looks like this:

```json
{
  "holdings": {
    "cryptoBalanceFiat": 366.3453670124265813368,
    "cryptoBalanceTotal": 155.331351890823836806,
    "cryptoHoldings": [
      {
        "balance": 44.920000001186440679,
        "balanceFiat": 44.920000001186440679,
        "networkName": "ERC20",
        "productName": "USDC",
        "productNetworkId": 8,
        "symbol": "USDC"
      }
    ],
    "fiatBalanceTotal": 8339.038309779062705836307024
  }
}
```

`holdings.fiatHoldings` is absent. The frontend therefore treats the breakdown as an empty list. It cannot reconstruct balances by currency from `fiatBalanceTotal`.

## Expected response

Please return `fiatHoldings` alongside the existing `fiatBalanceTotal`:

```json
{
  "holdings": {
    "fiatBalanceTotal": 103.50,
    "fiatHoldings": [
      {
        "currencyProductId": 2,
        "currency": "CDF",
        "displayName": "Congolese Franc",
        "logoUrl": "https://example.test/cdf.png",
        "balance": 250000.00,
        "balanceFiat": 100.00,
        "walletCount": 12,
        "usdValuationAvailable": true
      },
      {
        "currencyProductId": 1,
        "currency": "USD",
        "displayName": "US Dollar",
        "logoUrl": null,
        "balance": 3.50,
        "balanceFiat": 3.50,
        "walletCount": 2,
        "usdValuationAvailable": true
      }
    ]
  }
}
```

The values above are illustrative. The response must use the current balances and currency-product metadata from the database.

Each entry must contain:

| Field | Meaning |
| --- | --- |
| `currencyProductId` | Currency product identifier |
| `currency` | Native wallet currency code |
| `displayName` | Currency-product display name |
| `logoUrl` | Currency-product logo URL, or `null` |
| `balance` | Total native wallet balance for this currency product |
| `balanceFiat` | USD valuation, or `null` when unavailable |
| `walletCount` | Number of contributing wallets, including zero-balance wallets |
| `usdValuationAvailable` | Whether a usable USD valuation was available |

## Aggregation requirements

- Group real `fiat_wallets` by currency product and currency.
- Exclude sandbox wallets and migrated legacy `account_balances` to avoid test funds or duplicate balances.
- Apply the existing demo-account exclusion.
- Include zero-balance wallets in `walletCount`.
- Include matching wallets even when their currency product is disabled.
- Omit currency products that have no matching wallets.
- Return `fiatHoldings: []` and `fiatBalanceTotal: 0` when no wallets match.
- If USD valuation is unavailable, still return the native `balance`, set `balanceFiat` to `null`, and set `usdValuationAvailable` to `false`.
- Keep the existing `fiatBalanceTotal` policy of summing only available USD valuations.
- Order entries by `currency`, then by `currencyProductId`.

## Filters

The existing dashboard account filters must apply to `fiatHoldings`:

```text
accountId
accountReference
userReference
userEmail
userPhone
countryId
```

Date, service, action, status, and payment-route filters apply to transaction statistics and must not alter this current-balance snapshot.

## Frontend status

The frontend already reads `holdings.fiatHoldings` from the dashboard response. Opening the Fiat Wallet Holdings view or selecting **Refresh holdings** explicitly refetches `GET /admin-api/dashboard`.

No separate fiat-holdings endpoint is expected. The missing work is the `fiatHoldings` field in the backend dashboard response, or deployment of the backend version that already implements it.
