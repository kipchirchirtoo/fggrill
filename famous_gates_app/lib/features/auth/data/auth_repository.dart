import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/utils/api_error_message.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../domain/models.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.read(dioProvider), ref);
});

class AuthRepository {
  AuthRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  static const jwtKey = 'fg_jwt';
  static const refreshKey = 'fg_refresh';
  static const branchIdKey = 'fg_branch_id';
  static const branchNameKey = 'fg_branch_name';
  static const roleKey = 'fg_role';
  static const licenseKey = 'fg_license';
  static const userIdKey = 'fg_user_id';
  static const userNameKey = 'fg_user_name';
  static const outletIdKey = 'fg_outlet_id';
  static const outletTypeKey = 'fg_outlet_type';
  static const outletPrefixKey = 'fg_outlet_prefix';
  static const activeShiftIdKey = 'fg_active_shift_id';
  // Remember-me keys
  static const rememberMeKey = 'fg_remember_me';
  static const rememberedEmailKey = 'fg_remembered_email';

  Future<User> login(String email, String password,
      {bool rememberMe = false}) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final authData = _authDataFromResponse(response.data);
      final user = User.fromJson(_userJsonFromAuthData(authData));
      final sessionJson = _sessionJsonFromAuthData(authData);
      final accessToken = _stringValue(
        authData['access_token'] ??
            sessionJson?['access_token'] ??
            authData['token'],
      );
      final refreshToken = _stringValue(
        authData['refresh_token'] ?? sessionJson?['refresh_token'],
      );
      if (accessToken.isEmpty) {
        throw Exception('No access token received');
      }
      await _storeSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: user,
      );
      // Persist remember-me preference and (optionally) email.
      final storage = _ref.read(secureStorageProvider);
      await storage.write(
          key: rememberMeKey, value: rememberMe ? 'true' : 'false');
      if (rememberMe) {
        await storage.write(key: rememberedEmailKey, value: email);
      } else {
        await storage.delete(key: rememberedEmailKey);
      }
      return user;
    } on DioException catch (error) {
      throw Exception(_messageFromDio(error));
    }
  }

  /// Returns the email that was previously saved with "Remember me",
  /// or null if none was saved.
  Future<String?> getRememberedEmail() async {
    final storage = _ref.read(secureStorageProvider);
    return storage.read(key: rememberedEmailKey);
  }

  Future<User> posLogin(String pin) async {
    try {
      final response = await _dio.post('/auth/pos-login', data: {
        'pin': pin,
      });
      final authData = _authDataFromResponse(response.data);
      final prefix = pin.trim().toUpperCase().substring(0, 1);
      authData['active_outlet_prefix'] ??= prefix;
      authData['active_outlet_type'] ??= _outletTypeFromPinPrefix(prefix);
      final user = User.fromJson(_userJsonFromAuthData(authData));
      final sessionJson = _sessionJsonFromAuthData(authData);
      final accessToken = _stringValue(
        authData['access_token'] ??
            sessionJson?['access_token'] ??
            authData['token'],
      );
      final refreshToken = _stringValue(
        authData['refresh_token'] ?? sessionJson?['refresh_token'],
      );
      if (accessToken.isEmpty) {
        throw Exception('No access token received');
      }
      await _storeSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: user,
      );
      return user;
    } on DioException catch (error) {
      throw Exception(_messageFromDio(error));
    }
  }

  Map<String, dynamic> _authDataFromResponse(Object? responseData) {
    if (responseData is! Map) {
      throw Exception('Invalid auth response');
    }
    final data = Map<String, dynamic>.from(responseData);
    return data['data'] is Map
        ? Map<String, dynamic>.from(data['data'] as Map)
        : data;
  }

  Map<String, dynamic> _userJsonFromAuthData(Map<String, dynamic> authData) {
    final userJson = authData['user'];
    if (userJson is! Map) {
      throw Exception('No user received');
    }
    final normalized = Map<String, dynamic>.from(userJson);
    if (authData['outlet'] is Map && normalized['outlet'] == null) {
      normalized['outlet'] =
          Map<String, dynamic>.from(authData['outlet'] as Map);
    }
    normalized['active_shift_id'] ??= authData['active_shift_id'];
    return normalized;
  }

  Map<String, dynamic>? _sessionJsonFromAuthData(
      Map<String, dynamic> authData) {
    final sessionJson = authData['session'];
    return sessionJson is Map ? Map<String, dynamic>.from(sessionJson) : null;
  }

  String? _outletTypeFromPinPrefix(String prefix) {
    switch (prefix) {
      case 'R':
        return 'restaurant';
      case 'M':
        return 'main_bar';
      case 'E':
        return 'executive_bar';
      case 'N':
        return 'non_consumables';
      case 'C':
        return 'cashier';
      default:
        return null;
    }
  }

  String _stringValue(Object? value) {
    final string = value?.toString() ?? '';
    return string == 'null' ? '' : string;
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {
      // Local logout must still complete if the network request fails.
    } finally {
      await _ref.read(secureStorageProvider).deleteAll();
    }
  }

  Future<User?> getCurrentUser() async {
    final storage = _ref.read(secureStorageProvider);

    // If the user did NOT tick "Remember me" last time, clear the stored token
    // so the next app launch requires a fresh login.
    final rememberMe = await storage.read(key: rememberMeKey);
    if (rememberMe == 'false') {
      await storage.delete(key: jwtKey);
      await storage.delete(key: refreshKey);
      return null;
    }

    final token = await storage.read(key: jwtKey);
    if (token == null || token.isEmpty) return null;

    try {
      final response = await _dio.get('/auth/me');
      final data = Map<String, dynamic>.from(response.data as Map);
      final payload = data['data'] is Map
          ? Map<String, dynamic>.from(data['data'] as Map)
          : data;
      final userJson = Map<String, dynamic>.from(
          (payload['user'] is Map ? payload['user'] : payload) as Map);
      userJson['active_outlet_id'] ??= await storage.read(key: outletIdKey);
      userJson['active_outlet_type'] ??= await storage.read(key: outletTypeKey);
      userJson['active_outlet_prefix'] ??=
          await storage.read(key: outletPrefixKey);
      userJson['active_shift_id'] ??= await storage.read(key: activeShiftIdKey);
      final user = User.fromJson(userJson);
      await _storeUser(user);
      return user;
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        await storage.delete(key: jwtKey);
        return null;
      }
      rethrow;
    }
  }

  Future<String> refreshToken() async {
    final storage = _ref.read(secureStorageProvider);
    final refreshToken = await storage.read(key: refreshKey);
    if (refreshToken == null || refreshToken.isEmpty) {
      throw Exception('Missing refresh token');
    }

    final response = await _dio.post('/auth/refresh-token', data: {
      'refresh_token': refreshToken,
    });
    final data = Map<String, dynamic>.from(response.data as Map);
    final accessToken = '${data['access_token']}';
    await storage.write(key: jwtKey, value: accessToken);
    return accessToken;
  }

  Future<LicenseInfo> validateLicense(
      String licenseKey, String branchCode) async {
    try {
      final response = await _dio.post('/auth/license/validate', data: {
        'license_key': licenseKey,
        'branch_code': branchCode,
      });
      final info =
          LicenseInfo.fromJson(Map<String, dynamic>.from(response.data as Map));
      if (!info.isValid) {
        throw Exception('License is not valid');
      }
      final storage = _ref.read(secureStorageProvider);
      await storage.write(key: AuthRepository.licenseKey, value: licenseKey);
      await storage.write(key: branchIdKey, value: info.branchId);
      await storage.write(key: branchNameKey, value: info.branchName);
      return info;
    } on DioException catch (error) {
      throw Exception(_messageFromDio(error));
    }
  }

  Future<bool> hasStoredLicense() async {
    final license =
        await _ref.read(secureStorageProvider).read(key: licenseKey);
    return license != null && license.isNotEmpty;
  }

  Future<void> _storeSession({
    required String accessToken,
    required String refreshToken,
    required User user,
  }) async {
    final storage = _ref.read(secureStorageProvider);
    await storage.write(key: jwtKey, value: accessToken);
    await storage.write(key: refreshKey, value: refreshToken);
    await _storeUser(user);
  }

  Future<void> _storeUser(User user) async {
    final storage = _ref.read(secureStorageProvider);
    await storage.write(key: userIdKey, value: user.id);
    await storage.write(key: userNameKey, value: user.name);
    await storage.write(key: roleKey, value: user.role);
    await storage.write(key: branchIdKey, value: user.branchId);
    await storage.write(key: branchNameKey, value: user.branchName);
    await _writeOptional(storage, outletIdKey, user.outletId);
    await _writeOptional(storage, outletTypeKey, user.outletType);
    await _writeOptional(storage, outletPrefixKey, user.outletPrefix);
    await _writeOptional(storage, activeShiftIdKey, user.activeShiftId);
  }

  Future<void> _writeOptional(
      FlutterSecureStorage storage, String key, String? value) async {
    if (value == null || value.isEmpty) {
      await storage.delete(key: key);
      return;
    }
    await storage.write(key: key, value: value);
  }

  String _messageFromDio(DioException error) {
    return apiErrorMessage(error, fallback: 'Authentication failed');
  }
}
