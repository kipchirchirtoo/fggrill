// FamousGate PowerSync exports
//
// This is the top-level entry point for PowerSync integration in the Flutter app.
// The actual implementation lives in `core/powersync/`; this file just re-exports
// the public API so other features can import `package:famous_gates_app/powersync.dart`.
//
// PowerSync instance URL: https://6a3baa5435ca576ca0df47ea.powersync.journeyapps.com
//
// To run with PowerSync enabled:
//   flutter run --dart-define=POWERSYNC_ENABLED=true \
//               --dart-define=POWERSYNC_URL=https://6a3baa5435ca576ca0df47ea.powersync.journeyapps.com

export 'core/powersync/powersync_connector.dart' show FamousGatesPowerSyncConnector;
export 'core/powersync/powersync_service.dart' show PowerSyncService, powerSyncServiceProvider, powerSyncHotReadsEnabledProvider;
export 'core/powersync/powersync_schema.dart' show powerSyncSchema;
