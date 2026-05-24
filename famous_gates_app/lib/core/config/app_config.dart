class AppConfig {
  static const String mainApiBaseUrl = String.fromEnvironment(
    'MAIN_API_URL',
    defaultValue: 'https://api.hirall.com',
  );
  
  static const String pythonServicesBaseUrl = String.fromEnvironment(
    'PYTHON_SERVICES_URL',
    defaultValue: 'https://services.hirall.com',
  );

  static const String authBaseUrl = '$mainApiBaseUrl/auth';
}
