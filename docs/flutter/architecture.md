# Flutter Architecture

## Target Structure

```text
lib/
├── core/
│   ├── config/
│   ├── network/
│   ├── router/
│   ├── storage/
│   ├── theme/
│   ├── utils/
│   └── widgets/
├── features/
│   ├── auth/
│   ├── superadmin/
│   ├── admin/
│   ├── auditor/
│   ├── central_store/
│   ├── store/
│   ├── hr/
│   ├── finance/
│   ├── branch_manager/
│   ├── gm/
│   ├── director/
│   ├── reception/
│   ├── cashier/
│   ├── bar/
│   ├── kitchen/
│   ├── kitchen_operations/
│   ├── housekeeping/
│   ├── maintenance/
│   ├── facilities/
│   ├── procurement/
│   ├── reports/
│   ├── notifications/
│   ├── search/
│   └── settings/
└── main.dart
```

## Feature Ownership

Each feature should contain:

```text
features/{feature}/
├── data/
│   ├── models/
│   ├── repositories/
│   └── services/
├── domain/
│   ├── entities/
│   ├── providers.dart
│   └── permissions.dart
└── presentation/
    ├── pages/
    ├── sections/
    ├── widgets/
    └── controllers/
```

Existing folders may keep their current naming if already used, but new migrated code should follow this boundary.

## State Management

Use Riverpod:

- `FutureProvider` for simple read-only fetches.
- `AsyncNotifier` for screens with refresh, mutations, pagination, filters, and loading/error state.
- `StateNotifier` or `Notifier` for local dashboard section selection.
- Repositories are injected through providers and use Dio.

## Networking

- All HTTP calls go through `core/network/dio_client.dart`.
- Repositories normalize `{ success, data }`, raw lists, paginated objects, and bytes.
- Invalid branch IDs must be omitted.
- Export repositories use `ResponseType.bytes`.
- Upload repositories use `FormData`.

## Routing

- GoRouter remains central in `core/router/app_router.dart`.
- Role entry routes remain coarse (`/auditor`, `/hr`, `/central-store`) unless deep links are required.
- Child routes should be added for pages with query params or direct navigation parity.
- `_routeRoles` must match backend access.

## UI

- Superadmin shell is canonical.
- Shared role shell widgets should live under `core/widgets` once extracted.
- Feature widgets should compose cards/tables/dialogs instead of redefining visual systems.

## Error Handling

- Repository catches known 400/404 empty-state cases only when the web app treated them as empty.
- Permission errors become a permission state.
- Unexpected errors remain errors and show retry.
- UI must not display raw `DioException` boilerplate.

## File Downloads and Uploads

- Downloads save to the user Downloads directory when available, otherwise application documents.
- Filenames must be sanitized.
- Uploads use file picker + Dio `FormData`.
- Export buttons must be disabled while export is running.

## Permissions

- Backend authorization is source of truth.
- Flutter hides or disables actions based on role, but must still handle 403 gracefully.
- Global roles can select branch; branch roles use stored branch.
