# Admin Cache Management API

Base path: `${app.api.baseUrls.admin-api}/caches`

## List cache names
`GET /caches`

- Returns `[]` of cache names known to the CacheManager.
- Example response:
```
[
  "PaymentMethods",
  "EsimTopupPackages",
  "AiraloTopupPackages",
  "ReloadlyGiftCards",
  ...
]
```

## Evict caches/entries
`POST /caches/evict`

Body `CacheEvictRequest`:
```json
{
  "allCaches": false,
  "cacheName": "PaymentMethods",
  "key": null
}
```

Rules:
- If `allCaches=true`, clears every cache (ignores `cacheName`/`key`).
- Else `cacheName` is required.
  - If `key` is provided, evicts only that entry.
  - If `key` is null/blank, clears the entire cache.

Examples:
- Clear all caches:
```json
{ "allCaches": true }
```
- Clear one cache completely:
```json
{ "cacheName": "PaymentMethods" }
```
- Evict one entry from a cache:
```json
{ "cacheName": "PaymentMethods", "key": "PM:123" }
```

## Frontend integration notes
- Provide a cache list view that calls `GET /caches` and displays cache names.
- For eviction, surface three options: (1) clear all caches, (2) clear selected cache, (3) evict specific key (text input for key).
- Require confirmation for destructive actions (clear-all, clear-cache).
- Show success/failure toasts; 400 if cacheName missing when required.
- Restrict access to admins only and audit actions if desired.
