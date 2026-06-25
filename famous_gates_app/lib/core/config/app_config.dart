class AppConfig {
  static const bool powerSyncEnabled = bool.fromEnvironment(
    'POWERSYNC_ENABLED',
    defaultValue: true,
  );
  static const bool powerSyncHotReadsEnabled = bool.fromEnvironment(
    'POWERSYNC_HOT_READS_ENABLED',
    defaultValue: true,
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
}
