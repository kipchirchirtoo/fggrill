# Bugfix Requirements Document

## Introduction

The branch accounting purchases page is experiencing a 405 Method Not Allowed error when attempting to POST to the purchase orders endpoint. The root cause is a malformed URL construction where the API base URL is being treated as a relative path and concatenated with the current page URL, resulting in:

```
https://famousgate.hirall.com/dashboard/branch-accounting/api.hirall.com/api/procurement/purchase-orders
```

Instead of the correct:

```
https://api.hirall.com/api/procurement/purchase-orders
```

This is the same issue that was previously fixed for the Kyogong module (see `.kiro/specs/kyogong-404-fix/bugfix.md`). The purchases page is using a local `API_URL` constant defined at the top of the component file instead of importing the properly normalized `API_URL` from `@/lib/config`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the branch accounting purchases page attempts to create a purchase order via POST request THEN the system constructs a malformed URL by concatenating `api.hirall.com` as a relative path with the current page URL, resulting in `https://famousgate.hirall.com/dashboard/branch-accounting/api.hirall.com/api/procurement/purchase-orders`

1.2 WHEN the malformed URL is used for the API request THEN the system receives a 405 Method Not Allowed error because the URL does not match any backend route

1.3 WHEN the `NEXT_PUBLIC_API_URL` environment variable is set to `api.hirall.com` without a protocol prefix THEN the browser treats it as a relative path instead of an absolute URL

### Expected Behavior (Correct)

2.1 WHEN the branch accounting purchases page attempts to create a purchase order via POST request THEN the system SHALL construct the correct absolute URL `https://api.hirall.com/api/procurement/purchase-orders` using the normalized API_URL from the config module

2.2 WHEN the correct absolute URL is used for the API request THEN the system SHALL successfully reach the backend endpoint and process the purchase order creation

2.3 WHEN the `NEXT_PUBLIC_API_URL` environment variable is set to any format (with or without protocol) THEN the system SHALL normalize it to a proper absolute URL with the correct protocol prefix

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the purchases page uses the procurementAPI methods from `@/lib/api` THEN the system SHALL CONTINUE TO work correctly as those methods already use the normalized API_URL

3.2 WHEN other pages import and use the API_URL from `@/lib/config` THEN the system SHALL CONTINUE TO construct correct absolute URLs

3.3 WHEN the application runs in development mode with localhost URLs THEN the system SHALL CONTINUE TO use http:// protocol correctly

3.4 WHEN the application runs in the desktop/Electron environment THEN the system SHALL CONTINUE TO use the correct API URLs for the proxy
