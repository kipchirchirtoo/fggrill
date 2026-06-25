class AppConfig {
  static const bool powerSyncEnabled = bool.fromEnvironment(
    'POWERSYNC_ENABLED',
    defaultValue: false,
  );
  static const bool powerSyncHotReadsEnabled = bool.fromEnvironment(
    'POWERSYNC_HOT_READS_ENABLED',
    defaultValue: false,
  );
  static const String powerSyncUrl = String.fromEnvironment(
    'POWERSYNC_URL',
    defaultValue: 'https://6a3baa5435ca576ca0df47ea.powersync.journeyapps.com',
  );
  static const String powerSyncToken = String.fromEnvironment(
    'POWERSYNC_TOKEN',
    defaultValue: '',
  );
  static const String mainApiBaseUrl = String.fromEnvironment(
    'MAIN_API_URL',
    defaultValue: 'https://api.hirall.com/api',
  );
  static const String mainApiUrl = mainApiBaseUrl;

  static const String pythonServicesBaseUrl = String.fromEnvironment(
    'PYTHON_SERVICES_URL',
    defaultValue: 'https://services.hirall.com',
  );

  static const String authBaseUrl = '$mainApiBaseUrl/auth';

  // Direct-to-Supabase reads (menu, kitchen/order status, stock, Realtime).
  // The anon key is meant to be public/shipped in clients — RLS is the
  // actual security boundary, not secrecy of this key. Supplied via
  // --dart-define at build time, same as POWERSYNC_TOKEN above.
  static const bool directSupabaseEnabled = bool.fromEnvironment(
    'DIRECT_SUPABASE_ENABLED',
    defaultValue: false,
  );
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: '',
  );
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );
}
