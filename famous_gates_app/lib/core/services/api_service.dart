import 'package:dio/dio.dart';

/// Base API service that all other services extend
abstract class BaseApiService {
  final Dio dio;
  BaseApiService(this.dio);

  Future<T> get<T>(String path, {Map<String, dynamic>? queryParameters}) async {
    final response = await dio.get(path, queryParameters: queryParameters);
    return _handleResponse<T>(response);
  }

  Future<T> post<T>(String path,
      {dynamic data, Map<String, dynamic>? queryParameters}) async {
    final response =
        await dio.post(path, data: data, queryParameters: queryParameters);
    return _handleResponse<T>(response);
  }

  Future<T> put<T>(String path,
      {dynamic data, Map<String, dynamic>? queryParameters}) async {
    final response =
        await dio.put(path, data: data, queryParameters: queryParameters);
    return _handleResponse<T>(response);
  }

  Future<T> patch<T>(String path,
      {dynamic data, Map<String, dynamic>? queryParameters}) async {
    final response =
        await dio.patch(path, data: data, queryParameters: queryParameters);
    return _handleResponse<T>(response);
  }

  Future<T> delete<T>(String path,
      {Map<String, dynamic>? queryParameters}) async {
    final response = await dio.delete(path, queryParameters: queryParameters);
    return _handleResponse<T>(response);
  }

  T _handleResponse<T>(Response response) {
    if (response.statusCode! >= 200 && response.statusCode! < 300) {
      return response.data as T;
    }
    throw DioException(
      requestOptions: response.requestOptions,
      response: response,
      type: DioExceptionType.badResponse,
    );
  }
}

/// API Response wrapper matching backend response format
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final String? error;
  final int? count;

  ApiResponse({
    required this.success,
    this.data,
    this.message,
    this.error,
    this.count,
  });

  factory ApiResponse.fromJson(
      Map<String, dynamic> json, T Function(dynamic)? fromJson) {
    return ApiResponse(
      success: json['success'] ?? false,
      data: json['data'] != null && fromJson != null
          ? fromJson(json['data'])
          : json['data'] as T?,
      message: json['message'],
      error: json['error'],
      count: json['count'],
    );
  }

  bool get hasError => error != null || !success;
}

/// Generic list response
class ListResponse<T> {
  final List<T> items;
  final int? total;
  final int? page;
  final int? limit;

  ListResponse({
    required this.items,
    this.total,
    this.page,
    this.limit,
  });

  factory ListResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic) fromJson,
  ) {
    final data = json['data'] ?? json;
    return ListResponse(
      items: (data as List).map((e) => fromJson(e)).toList(),
      total: json['count'] ?? json['total'],
      page: json['page'],
      limit: json['limit'],
    );
  }
}
