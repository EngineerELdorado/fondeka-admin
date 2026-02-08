# Admin Fee Configs

This document explains how to manage fee configurations in the Admin Dashboard.

## What a FeeConfig represents
Each record defines the provider + platform fees for a specific scope:
- `paymentMethodPaymentProviderId` (PMPP): optional. If null, the fee is global for the action.
- `billProductBillProviderId` (BPBP): optional. If null, no bill product/provider mapping scope is applied.
- `countryId`: optional. If null, applies to all countries.
- `service`: optional (`WALLET`, `BILL_PAYMENTS`, `LENDING`, `CARD`, `CRYPTO`, `PAYMENT_REQUEST`, `E_SIM`, `AIRTIME_AND_DATA`, `GIFT_CARDS`, `OTHER`). If null, applies to all services.
- `action`: required; must be one of the Action enum values (same as code).
- Fee fields: `providerFeePercentage`, `providerFlatFee`, `ourFeePercentage`, `ourFlatFee` (all non-negative, defaults to 0).
- Validation: `paymentMethodPaymentProviderId` and `billProductBillProviderId` are mutually exclusive.
- Uniqueness: one fee per combination of (PMPP or global) + action + country + service.

## API (Admin)
Base path: `${app.api.baseUrls.admin-api}/fee-configs`

- `GET /fee-configs?page=&size=`: List fee configs (paged).
- `GET /fee-configs/{id}`: Get a single fee config.
- `POST /fee-configs`: Create.
- `PUT /fee-configs/{id}`: Update.
- `DELETE /fee-configs/{id}`: Delete.

### Request body (POST/PUT)
```json
{
  "paymentMethodPaymentProviderId": 123,   // optional
  "billProductBillProviderId": 456,        // optional (mutually exclusive with PMPP)
  "countryId": 45,                         // optional
  "service": "WALLET",                     // optional, string enum
  "action": "FUND_WALLET",                 // required, string enum
  "providerFeePercentage": 1.5,            // percent (1.5 = 1.5%)
  "providerFlatFee": 0.25,
  "ourFeePercentage": 0.8,
  "ourFlatFee": 0.10
}
```

### Response body
```json
{
  "id": 1,
  "paymentMethodPaymentProviderId": 123,
  "billProductBillProviderId": 456,
  "countryId": 45,
  "service": "WALLET",
  "action": "FUND_WALLET",
  "providerFeePercentage": 1.5,
  "providerFlatFee": 0.25,
  "ourFeePercentage": 0.8,
  "ourFlatFee": 0.10
}
```

## Admin UI considerations
- Inputs: select Action (enum), Service (enum, optional), Country (optional), PMPP (optional), BPBP (optional), numeric fields for fees (percent, flat).
- Validation: enforce non-negative fees; allow only one record per scope (handle 409 errors from unique constraint).
- Validation: do not allow both PMPP and BPBP in the same record.
- Filters: support `billProductBillProviderId`, `billProductId`, and `billProviderId` in list UI.
- Display scopes: show whether a fee is global vs country-specific vs service-specific vs PMP-specific.

## Backend behavior
- Resolution order for bill flows is: account custom fee, then BPBP-scoped fee, then PMPP-scoped fee, then global fee.
- Percent fields are stored as fractions (e.g., 1.5% stored as 0.015 in DB via Admin service converters).

## Schema
- `fee_configs` has nullable `payment_method_payment_provider_id`, `bill_product_bill_provider_id`, `country_id`, `service`.
- Uniqueness is enforced for the selected scope + action (+ optional country/service).
- Checks: non-negative fee fields; action/service enum checks.
- FK: `payment_method_payment_provider_id` → `payment_method_payment_providers` (NO ACTION), `bill_product_bill_provider_id` → `bill_product_bill_providers` (NO ACTION), `country_id` → `countries` (NO ACTION).
