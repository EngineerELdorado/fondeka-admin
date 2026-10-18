# Backend: Admin Phone Verification Status

## Requirement

Add an account-scoped admin endpoint that allows an administrator to mark an account phone number as verified or unverified.

This is needed by the admin dashboard account details page.

Marking a phone number as verified must allow the account to bypass automatic phone-verification enforcement because the automatic policy only applies to accounts whose phone number is not verified.

## Endpoint

```http
PATCH /admin-api/accounts/{accountId}/phone-verification
Content-Type: application/json
```

Request body:

```json
{
  "verified": true
}
```

To mark the phone number as unverified:

```json
{
  "verified": false
}
```

## Response

Return the refreshed `AdminAccountResource` so the dashboard can immediately display the new status.

Example:

```json
{
  "accountId": 123,
  "phoneNumber": "+243970000000",
  "phoneVerified": true
}
```

Use the existing complete `AdminAccountResource` response; the example above only shows the relevant fields.

## Required behavior

1. Find the account using `accountId`.
2. Find the `Contact` associated with the account user.
3. Reject the request if the account does not have a phone number.
4. Set `Contact.phoneNumberVerified` to the requested `verified` value.
5. Save the contact.
6. When `verified` is `true`, clear the account feature override `account.phone_verification.required` so the customer is no longer forced into verification.
7. Return the refreshed `AdminAccountResource`.

When `verified` is `false`, the endpoint does not need to create the requirement override immediately. If automatic enforcement is enabled and the account meets the policy conditions, the normal automatic policy evaluation may require verification again.

## Suggested DTO

```java
package com.fondeka.lenderservice.dto.admin.account;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminAccountPhoneVerificationUpdateRequest {

    @NotNull
    private Boolean verified;
}
```

## Suggested controller method

Add this to `AdminAccountController`:

```java
@PatchMapping("/{accountId}/phone-verification")
public ResponseEntity<AdminAccountResource> updatePhoneVerification(
        @PathVariable Long accountId,
        @RequestBody @Valid AdminAccountPhoneVerificationUpdateRequest request) {
    AdminAccountResource updated = adminAccountServiceBridge.updatePhoneVerification(
            accountId,
            request
    );
    return ResponseEntity.ok(updated);
}
```

## Suggested service behavior

Add a transactional service operation similar to:

```java
@Transactional
public AdminAccountResource updatePhoneVerification(
        Long accountId,
        AdminAccountPhoneVerificationUpdateRequest request) {
    Account account = adminAccountService.getAccount(accountId);
    Contact contact = contactRepository.findByUserId(account.getUser().getId())
            .orElseThrow(() -> new FondekaException(
                    HttpStatus.NOT_FOUND,
                    "Contact not found",
                    ErrorCode.NO_RESULT
            ));

    if (contact.getPhoneNumber() == null || contact.getPhoneNumber().isBlank()) {
        throw new FondekaException(
                HttpStatus.BAD_REQUEST,
                "Account does not have a phone number",
                ErrorCode.INVALID_REQUEST
        );
    }

    boolean verified = Boolean.TRUE.equals(request.getVerified());
    contact.setPhoneNumberVerified(verified);
    contactRepository.save(contact);

    if (verified) {
        // Remove/disable the account-level feature override:
        // account.phone_verification.required
        // Reuse the existing feature-flag override service rather than
        // manipulating its persistence entity directly.
    }

    return adminAccountService.toAdminResource(account);
}
```

Adapt the method placement and existing service APIs to the project architecture. Reuse the same feature-flag service currently used to clear `account.phone_verification.required` after successful OTP verification.

## Auditing

Record the authenticated admin, account ID, old verification status, new verification status, and timestamp using the existing admin audit mechanism.

Suggested action names:

- `ACCOUNT_PHONE_MARKED_VERIFIED`
- `ACCOUNT_PHONE_MARKED_UNVERIFIED`

Do not log OTP values or other secrets.

## Validation and errors

- Return `400 Bad Request` when `verified` is missing.
- Return `400 Bad Request` when the account has no phone number.
- Return `404 Not Found` when the account does not exist.
- Return `404 Not Found` when the account contact does not exist.
- Preserve the existing admin authorization rules used by other account mutation endpoints.
- Return the normal API error body so the dashboard can display its `message` field.

## Automatic-policy interaction

When the status is changed to verified:

- `phoneVerified` must be `true` in the admin account response.
- `account.phone_verification.required` must be cleared.
- Automatic enforcement must skip the account while the phone remains verified.

When the status is changed to unverified:

- `phoneVerified` must be `false` in the admin account response.
- If automatic enforcement is enabled and the account later meets all configured criteria, the normal policy may enable `account.phone_verification.required` again.

## Tests

Add tests covering:

1. Marking an unverified phone number as verified.
2. Clearing `account.phone_verification.required` when marking it verified.
3. Marking a verified phone number as unverified.
4. Rejecting a missing `verified` request value.
5. Rejecting an account without a phone number.
6. Returning `404` for a missing account.
7. Returning `404` for a missing contact.
8. Returning the refreshed `AdminAccountResource` with the correct `phoneVerified` value.
9. Creating the expected admin audit record.
10. Confirming that automatic enforcement skips an account whose phone number is marked verified.

## Frontend contract

After this endpoint is available, the admin dashboard will call:

```javascript
api.accounts.updatePhoneVerification(accountId, { verified: true });
```

or:

```javascript
api.accounts.updatePhoneVerification(accountId, { verified: false });
```

The account details page will then refresh the account and phone-verification requirement state.
