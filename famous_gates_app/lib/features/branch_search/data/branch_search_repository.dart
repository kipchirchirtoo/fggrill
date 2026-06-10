import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/utils/api_error_message.dart';

final branchSearchRepositoryProvider = Provider<BranchSearchRepository>((ref) {
  return BranchSearchRepository(ref.read(dioProvider));
});

class SearchResultItem {
  SearchResultItem({
    required this.type,
    required this.label,
    required this.icon,
    required this.id,
    required this.title,
    required this.subtitle,
    required this.status,
    required this.amount,
    required this.date,
  });

  final String type;
  final String label;
  final String icon;
  final String id;
  final String title;
  final String subtitle;
  final dynamic status;
  final double? amount;
  final String? date;

  factory SearchResultItem.fromJson(Map<String, dynamic> j) => SearchResultItem(
        type: j['type']?.toString() ?? '',
        label: j['label']?.toString() ?? '',
        icon: j['icon']?.toString() ?? 'file',
        id: j['id']?.toString() ?? '',
        title: j['title']?.toString() ?? '',
        subtitle: j['subtitle']?.toString() ?? '',
        status: j['status'],
        amount: j['amount'] == null ? null : (j['amount'] as num).toDouble(),
        date: j['date']?.toString(),
      );
}

class SearchGroup {
  SearchGroup({
    required this.type,
    required this.label,
    required this.group,
    required this.icon,
    required this.count,
    required this.results,
  });

  final String type;
  final String label;
  final String group;
  final String icon;
  final int count;
  final List<SearchResultItem> results;

  factory SearchGroup.fromJson(Map<String, dynamic> j) => SearchGroup(
        type: j['type']?.toString() ?? '',
        label: j['label']?.toString() ?? '',
        group: j['group']?.toString() ?? '',
        icon: j['icon']?.toString() ?? 'file',
        count: (j['count'] as num?)?.toInt() ?? 0,
        results: ((j['results'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => SearchResultItem.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class SearchResponse {
  SearchResponse({required this.total, required this.groups});
  final int total;
  final List<SearchGroup> groups;
}

class EntityDetail {
  EntityDetail({
    required this.type,
    required this.label,
    required this.group,
    required this.title,
    required this.record,
    required this.editableFields,
    required this.deletable,
    required this.creatable,
    required this.amountField,
    required this.dateField,
    required this.statusField,
  });

  final String type;
  final String label;
  final String group;
  final String title;
  final Map<String, dynamic> record;
  final List<String> editableFields;
  final bool deletable;
  final bool creatable;
  final String? amountField;
  final String? dateField;
  final String? statusField;

  factory EntityDetail.fromJson(Map<String, dynamic> j) {
    final meta = Map<String, dynamic>.from(j['meta'] ?? const {});
    return EntityDetail(
      type: j['type']?.toString() ?? '',
      label: j['label']?.toString() ?? '',
      group: j['group']?.toString() ?? '',
      title: j['title']?.toString() ?? '',
      record: Map<String, dynamic>.from(j['record'] ?? const {}),
      editableFields: ((meta['editable_fields'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(),
      deletable: meta['deletable'] == true,
      creatable: meta['creatable'] == true,
      amountField: meta['amount_field']?.toString(),
      dateField: meta['date_field']?.toString(),
      statusField: meta['status_field']?.toString(),
    );
  }
}

class BranchSearchRepository {
  BranchSearchRepository(this._dio);
  final Dio _dio;

  Future<SearchResponse> search(String q, {List<String>? types}) async {
    try {
      final r = await _dio.get('/branch-search', queryParameters: {
        'q': q,
        if (types != null && types.isNotEmpty) 'types': types.join(','),
      });
      final data = (r.data['data'] ?? r.data) as Map<String, dynamic>;
      final groups = ((data['groups'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => SearchGroup.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      return SearchResponse(total: (data['total'] as num?)?.toInt() ?? 0, groups: groups);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Search failed');
    }
  }

  Future<EntityDetail> getDetail(String type, String id) async {
    try {
      final r = await _dio.get('/branch-search/$type/$id');
      final data = (r.data['data'] ?? r.data) as Map<String, dynamic>;
      return EntityDetail.fromJson(data);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Could not load record');
    }
  }

  Future<void> update(String type, String id, Map<String, dynamic> fields) async {
    try {
      await _dio.put('/branch-search/$type/$id', data: fields);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Update failed');
    }
  }

  Future<void> delete(String type, String id) async {
    try {
      await _dio.delete('/branch-search/$type/$id');
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Delete failed');
    }
  }
}
