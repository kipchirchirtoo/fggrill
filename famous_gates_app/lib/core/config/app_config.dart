class AppConfig {
  // PowerSync is intentionally hard-disabled for this app build path.
  // The app now uses the faster direct API / direct Supabase read path instead
  // of any local sync replica hot-read path.
  static const bool powerSyncEnabled = false;
  static const bool powerSyncHotReadsEnabled = false;
  static const String powerSyncUrl = '';
  static const String powerSyncToken = '';
  static const String mainApiBaseUrl = String.fromEnvironment(
    'MAIN_API_URL',
    defaultValue: String.fromEnvironment(
      'NEXT_PUBLIC_API_URL',
      defaultValue: String.fromEnvironment(
        'API_URL',
        defaultValue: 'http://localhost:5000/api',
      ),
    ),
  );
  static const String mainApiUrl = mainApiBaseUrl;
  static const String apiUrl = mainApiBaseUrl;

  static const String pythonServicesBaseUrl = String.fromEnvironment(
    'PYTHON_SERVICES_URL',
    defaultValue: String.fromEnvironment(
      'NEXT_PUBLIC_PYTHON_API_URL',
      defaultValue: String.fromEnvironment(
        'PYTHON_SERVICE_URL',
        defaultValue: 'http://localhost:5001',
      ),
    ),
  );

  static const String authBaseUrl = '$mainApiBaseUrl/auth';

  // Direct-to-Supabase reads (menu, kitchen/order status, stock, Realtime).
  // The anon key is meant to be public/shipped in clients — RLS is the
  // actual security boundary, not secrecy of this key. These defaults match
  // the real project so KDS/Realtime work out of the box; override via
  // --dart-define at build time only if pointing at a different project.
  //
  // Previously these all defaulted to disabled/empty with nothing in the
  // build pipeline ever passing --dart-define for them, which meant direct
  // Supabase (and therefore all Realtime, including the Kitchen Display)
  // was silently dead in every build.
  static const bool directSupabaseEnabled = bool.fromEnvironment(
    'DIRECT_SUPABASE_ENABLED',
    defaultValue: true,
  );
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://rvoaowhxyweswwuxbrzm.supabase.co',
  );
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2Fvd2h4eXdlc3d3dXhicnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MzYyNzgsImV4cCI6MjA5NzAxMjI3OH0.U_h1_DtI-SxkxgDUhCIz0o3PW7VNmcx-vI3dcA1MjX8',
  );
}
