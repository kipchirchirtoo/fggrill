import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../domain/models.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepository(ref.read(dioProvider));
});

class SearchRepository {
  SearchRepository(this._dio);

  final Dio _dio;

  Future<SearchResponse> globalSearch(String query,
      {List<String>? modules}) async {
    final response = await _dio.get('/search', queryParameters: {
      'q': query,
      if (modules != null && modules.isNotEmpty) 'modules': modules.join(','),
    });
    return SearchResponse.fromJson(response.data);
  }
}
