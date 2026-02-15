# Admin API (specialized controllers)

Base URL: `${app.api.baseUrls.admin-api}` (default `/admin-api`). All endpoints require `Authorization: Bearer <JWT>` with `role=ADMIN` (Cognito claim mapped to `ROLE_ADMIN`). Create/Update endpoints expect request DTOs; IDs/timestamps are ignored on writes.

## Core
- **Accounts**: `GET /accounts` (filters `accountNumber/startDate/endDate`), `GET /accounts/{id}`, AML check at `/accounts/check-aml/{id}`, custom pricing `GET/PATCH/DELETE /accounts/{id}/custom-pricing` body `{ maxLoanAmount }`.
- **Admin users**: CRUD at `/admins`; change password `/admins/change-my-password`; reset `/admins/{id}/reset-password`.
- **KYC**: list `/kycs?status=&startDate=&endDate=`, detail `/kycs/{id}`, update `/kycs/{id}` with `KycUpdateResource`.
- **Transactions**: `GET /transactions` filters `service/balanceEffect/status/startDate/endDate/reference`, post-webhook retry `POST /transactions/{transactionId}/post-webhook/retry` (optional body: `railLabel`, `externalReference`, `force`).
- **Reports**: `GET /report?startDate&endDate` → aggregated counts.

## Loans
- **Applications**: `GET /loans`, `GET /loans/{id}`, approve/reject `/loans/{id}/approve|reject` body `ProcessLoanDto`.
- **Decisions**: CRUD `/admin-loan-decisions` body `{ loanId, adminId, adminDecidedAt, adminDecisionComments }`.
- **Installments**: CRUD `/loan-installments` body `{ dueAt, amount, fineAmount, repaymentStatus, loanId }`.
- **Installment payments**: CRUD `/loan-installment-payments` body `{ amount, loanInstallmentId, transactionId }`.

## Wallet
- **Balances**: CRUD `/account-balances` body `{ accountId, balance }`.
- **Balance activities**: CRUD `/account-balance-activities` body `{ accountBalanceId, transactionId, previousBalance, newBalance, delta, activityType }`.
- **Transfers**: CRUD `/account-transfers` body `{ transactionId, senderAccountId, receiverAccountId }`.
- **Credits**: `POST /accounts/{accountId}/wallet/credit` body `{ amount, action: BONUS|MANUAL_ADJUSTMENT, note? }`.

## Profile
- **Users**: CRUD `/users` body `{ internalReference, oauthId, firstName, middleName, lastName, username, dob }`.
- **Contacts**: CRUD `/contacts` body `{ email, emailVerified?, phoneNumber, phoneNumberVerified?, userId }`.
- **Addresses**: CRUD `/addresses` body `{ municipalityId, postalCode, street, houseNo, userId }`.

## Payments
- **Payment methods**: `/payment-methods` request `{ name:PaymentMethodName, displayName, logoUrl, type:PaymentMethodType, active?, allowingCollection?, allowingPayout?, rank?, countryId? }` response adds `countryName`.
- **Payment providers**: `/payment-providers` `{ name:PaymentProviderName, active? }`.
- **Payment method ↔ provider mapping**: `/payment-method-payment-providers` `{ paymentMethodId, paymentProviderId, rank, active? }`.
- **Payment method ↔ crypto network mapping**: `/payment-method-crypto-networks` `{ paymentMethodId, cryptoNetworkId, rank, active? }`.
- **Fee configs**: `/fee-configs` `{ paymentMethodPaymentProviderId|null, action:Action, providerFeePercentage?, providerFlatFee?, ourFeePercentage?, ourFlatFee? }`.
- **Reloadly operator amounts**: `/reloadly-operator-amounts` `{ paymentMethodPaymentProviderId, minAmount?, maxAmount?, operatorId }`.

## Bills
- **Products**: `/bill-products` `{ type:BillProductType, name:BillName, code:BillCode, displayName, logoUrl, icon, active?, rank?, internalFeePercentage?, internalFlatFeeAmount? }`.
- **Providers**: `/bill-providers` `{ name:BillProviderName, displayName, active?, rank? }`.
- **Product ↔ provider mapping**: `/bill-product-bill-providers` `{ billProductId, billProviderId, rank?, active? }`.
- **Product-provider options**: `/bill-product-bill-provider-options` `{ name, externalReference, displayName, price, currency, ourPriceInUsd }`.
- **Product-provider offers**: `/bill-product-bill-provider-offers` `{ billProductBillProviderId, name, externalReference, displayName, price, currency, ourPriceInUsd }`.
- **Offer options join**: `/bill-product-bill-provider-offer-options` `{ billProductBillProviderOfferId, billProductBillProviderOptionId }`.
- **Bill payment intents**: `/bill-payment-intents` `{ billName?, billCode?, shape?, status?, amount?, providerProductId?, unitPrice?, providerOfferId?, providerOptionId?, subscriberId?, accountNumber?, subscriptionNumber?, offerCode?, optionCode?, transactionId? }`.

## Cards (catalog)
- **Card products**: `/card-products` `{ cardBrandName, active?, rank?, logoUrl }`.
- **Card providers**: `/card-providers` `{ name:CardProviderName, active?, rank? }`.
- **Product ↔ provider mapping**: `/card-product-card-providers` `{ cardProductId, cardProviderId, currency, purchaseCost, price, monthlyMaintenanceCost, active?, transactionFeePercentage }`.

## Card operations
- **Card holders**: `/card-holders` `{ internalReference, externalReference?, accountId, verified?, metaData }`.
- **Cards**: `/cards` `{ internalReference, name, externalReference?, status:CardStatus, last4?, cardHolderId, accountId, issued, cardProductCardProviderId }`.
- **Card activities**: `/card-activities` `{ cardId, activityType, transactionId }`.
- **Card purchase intents**: `/card-purchase-intents` `{ cardProductId, transactionId }`.

## Payment requests
- **Requests**: `/payment-requests` `{ accountId, type:PaymentRequestType, title?, description?, image1?, image2?, image3?, image4?, amount?, minAmount?, maxAmount?, goalAmount?, currency, allowPartial?, feeInclusion?, approvalStatus?, lifecycle?, linkCode?, checkoutSecretHash?, activationAt?, expiresAt?, metadata?, items? }` where `items` use `{ name, description?, quantity?, unitPrice, lineTotal?, paymentRequestId? }`.
- **Items**: `/payment-request-items` CRUD on individual items, body same as item above (with `paymentRequestId`).
- **Payments**: `/payment-request-payments` `{ paymentRequestId, paymentMethodId, status:PaymentAttemptStatus, providerTxnId?, amount, currency, payerReference?, payerDisplayName?, payerAnonymous?, failureCode?, failureReason?, idempotencyKey, quoteBreakdown?, transactionId? }`.
- **Request type settings**: `GET /payment-request-type-settings` → `{ type, allowCustomSettlement, allowAutoApproveOnCreate }`, `PUT /payment-request-type-settings/{type}` body `{ allowCustomSettlement, allowAutoApproveOnCreate }` for type in `QUICK_CHARGE | INVOICE | DONATION`.

## Geography
- **Countries**: `/countries` `{ alpha2Code, alpha3Code, name }`.
- **Provinces**: `/provinces` `{ name, countryId, active? }`.
- **Territories**: `/territories` `{ name, provinceId, active? }`.
- **Municipalities**: `/municipalities` `{ name, territoryId, active? }`.

## Crypto
- **Catalog**: `/crypto-networks`, `/crypto-products`, `/crypto-product-crypto-networks` (request `{ cryptoProductId, cryptoNetworkId, rank, active?, displayName }`).
- **Wallets**: `/crypto-wallets` `{ accountId, productNetworkId, balance? }`.
- **Invoices**: `/crypto-invoices` `{ walletId, internalReference?, externalReference?, address?, memoTag?, expectedAmount?, status:InvoiceStatus? }`.

## Savings
- **Saving products**: `/saving-products` `{ title, shortDescription, icon, iconColor, interestPercentage, interestType, active?, rank?, code:SavingProductCode }`.
- **Savings**: `/savings` `{ name, description?, internalReference, startsAt, endsAt?, withdrawnAt?, status:SavingStatus, accountId, savingProductId }`.
- **Saving activities**: `/saving-activities` `{ internalReference, activityType, savingId, transactionId }`.

## Risk
- **Blacklist**: `/blacklist` `{ accountId, reason }`.
- **Previous debts**: `/previous-debts` `{ previousDebt, accountId, adminId }`.

## Beneficiaries
- **Beneficiaries**: `/beneficiaries` `{ externalReference?, name, email?, type:BeneficiaryType, relationship:BeneficiaryRelationship, address?, city?, state?, zip?, country?, accountId, provider? }`.
- **Beneficiary payment methods**: `/beneficiary-payment-methods` `{ title?, externalReference?, paymentMethodType:PaymentMethodType, paymentMethodName:PaymentMethodName, networkName?, recipient, beneficiaryId }`.

## Providers / tokens
- **Provider tokens**: `/provider-tokens` `{ providerName:TokenProviderName, token }`.
- **Cega web tokens**: `/cega-web-tokens` `{ token }`.
- **Stripe customers**: `/stripe-customers` `{ accountId, stripeId }` response adds `accountInternalReference`.

## Misc catalog
- **Payment providers & methods**: see Payments section.
- **Airtime providers**: `/airtime-providers` `{ name:AirtimeProviderName, displayName, active?, rank?, defaultProvider? }`.
- **Esim providers**: `/esim-providers` `{ name:EsimProviderName, displayName, active?, rank?, defaultProvider? }`.
- **Esims**: `GET /esims`, `GET /esims/{id}` now include `expiresAt` (ISO-8601 timestamp) in `EsimResponse` alongside `createdAt`/`updatedAt`.
- **Reloadly operator amounts**: see Payments section.

## Webhooks
- **Webhook events**: `/webhook-events` `{ hash, provider, eventType?, payload?, lastError?, retries?, processedAt? }`.

## KYC jobs
- **KYC jobs**: `/kyc-jobs` `{ internalReference, externalReference?, country, idType, status?, vendorStatus?, vendorCode?, submittedAt?, kycId }`.

## Notes
- Dates use epoch milliseconds; decimals are numbers (BigDecimal).
- Role enforcement: only `role=ADMIN` tokens can access these routes.
