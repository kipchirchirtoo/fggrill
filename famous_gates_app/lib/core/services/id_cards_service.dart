import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/dio_client.dart';

final idCardsServiceProvider = Provider<IdCardsService>((ref) {
  return IdCardsService(ref.watch(pythonDioProvider));
});

class IdCardsService {
  IdCardsService(this.dio);

  final Dio dio;

  Future<Uint8List> generate(Map<String, dynamic> data,
      {String? photoPath}) async {
    return _postCard('/id-cards/generate', data, photoPath: photoPath);
  }

  Future<Uint8List> preview(Map<String, dynamic> data,
      {String? photoPath}) async {
    return _postCard('/id-cards/preview', data, photoPath: photoPath);
  }

  Future<Uint8List> _postCard(String path, Map<String, dynamic> data,
      {String? photoPath}) async {
    final formData = FormData.fromMap({
      'data': jsonEncode(data),
      if (photoPath != null && photoPath.isNotEmpty)
        'photo': await MultipartFile.fromFile(photoPath),
    });
    final response = await dio.post<List<int>>(
      path,
      data: formData,
      options: Options(
        responseType: ResponseType.bytes,
        contentType: 'multipart/form-data',
      ),
    );
    return Uint8List.fromList(response.data ?? const []);
  }
}
