import 'package:dio/dio.dart';
import '../domain/template_models.dart';
import '../../../core/utils/api_error_message.dart';

class TemplateRepository {
  TemplateRepository(this._dio);
  final Dio _dio;

  // ── SuperAdmin management ──────────────────────────────────────────────────
  Future<List<TemplateSummary>> listTemplates({int? branchId}) async {
    final r = await _get('/document-templates',
        query: {if (branchId != null) 'branch_id': branchId});
    final data = r.data['data'];
    if (data is List) {
      return data
          .map((e) => TemplateSummary.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return [];
  }

  Future<DocumentTemplate> getTemplate(String key, {int? branchId}) async {
    final r = await _get('/document-templates/$key',
        query: {if (branchId != null) 'branch_id': branchId});
    return DocumentTemplate.fromJson(
        Map<String, dynamic>.from(r.data['data'] ?? r.data));
  }

  Future<void> saveTemplate(
    String key,
    List<TemplateSection> sections, {
    String? name,
    int? branchId,
  }) async {
    await _put('/document-templates/$key', {
      'sections': sections.map((s) => s.toJson()).toList(),
      if (name != null) 'name': name,
      if (branchId != null) 'branch_id': branchId,
    });
  }

  Future<List<TemplateSection>> resetTemplate(String key,
      {int? branchId}) async {
    final r = await _post('/document-templates/$key/reset',
        query: {if (branchId != null) 'branch_id': branchId});
    final sections = r.data['data']?['sections'];
    if (sections is List) {
      return sections
          .map((e) => TemplateSection.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }
    return [];
  }

  // ── Till numbers ───────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> listTills() async {
    final r = await _get('/document-templates/tills');
    final data = r.data['data'];
    if (data is List) {
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<void> updateOutletTill(String outletId, String? tillNumber) async {
    await _put('/document-templates/tills/outlet/$outletId',
        {'till_number': tillNumber});
  }

  /// Paybill + account number (both required, or both empty to clear).
  Future<void> updateOutletPaybill(
      String outletId, String? paybill, String? account) async {
    await _put('/document-templates/tills/outlet/$outletId/paybill',
        {'paybill_number': paybill, 'paybill_account': account});
  }

  Future<void> updateBranchPaybill(
      String branchId, String? paybill, String? account) async {
    await _put('/document-templates/tills/branch/$branchId/paybill',
        {'default_paybill_number': paybill, 'default_paybill_account': account});
  }

  Future<void> updateBranchTill(String branchId, String? tillNumber) async {
    await _put('/document-templates/tills/branch/$branchId',
        {'default_till_number': tillNumber});
  }

  // ── Branch accountant: own-branch contact details + tills ─────────────────
  Future<Map<String, dynamic>> getBranchPrintSettings() async {
    final r = await _get('/document-templates/branch-settings');
    return Map<String, dynamic>.from(r.data['data'] ?? {});
  }

  Future<void> saveBranchPrintSettings(Map<String, dynamic> settings) async {
    await _put('/document-templates/branch-settings', settings);
  }

  // ── App-side resolve (for printing) ────────────────────────────────────────
  Future<ResolvedDocument?> resolve(
    String key, {
    String? branchId,
    String? outletId,
  }) async {
    try {
      final r = await _dio.get('/document-templates/resolve', queryParameters: {
        'key': key,
        if (branchId != null && branchId.isNotEmpty) 'branch_id': branchId,
        if (outletId != null && outletId.isNotEmpty) 'outlet_id': outletId,
      });
      final data = Map<String, dynamic>.from(r.data['data'] ?? r.data);
      final sections = (data['sections'] is List)
          ? (data['sections'] as List)
              .whereType<Map>()
              .map((e) => TemplateSection.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <TemplateSection>[];
      final contact = data['contact'] is Map
          ? Map<String, dynamic>.from(data['contact'] as Map)
          : const <String, dynamic>{};
      String? contactValue(String field) {
        final value = contact[field]?.toString().trim();
        return (value == null || value.isEmpty) ? null : value;
      }

      return ResolvedDocument(
        key: key,
        sections: sections,
        tillNumber: data['till_number']?.toString(),
        paybillNumber: data['paybill_number']?.toString(),
        paybillAccount: data['paybill_account']?.toString(),
        contactPhone: contactValue('phone'),
        contactEmail: contactValue('email'),
        contactAddress: contactValue('address'),
      );
    } catch (_) {
      // Offline / not configured → caller falls back to the built-in layout.
      return null;
    }
  }

  Future<Response<dynamic>> _get(String path,
      {Map<String, dynamic>? query}) async {
    try {
      return await _dio.get(path, queryParameters: query);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Template request failed');
    }
  }

  Future<Response<dynamic>> _put(String path, dynamic data) async {
    try {
      return await _dio.put(path, data: data);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Template save failed');
    }
  }

  Future<Response<dynamic>> _post(String path,
      {Map<String, dynamic>? query}) async {
    try {
      return await _dio.post(path, queryParameters: query);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Template request failed');
    }
  }
}

class ResolvedDocument {
  ResolvedDocument({
    required this.key,
    required this.sections,
    this.tillNumber,
    this.paybillNumber,
    this.paybillAccount,
    this.contactPhone,
    this.contactEmail,
    this.contactAddress,
  });
  final String key;
  final List<TemplateSection> sections;
  final String? tillNumber;
  final String? paybillNumber;
  final String? paybillAccount;

  /// Branch contact details set by the branch accountant (null = use the app default).
  final String? contactPhone;
  final String? contactEmail;
  final String? contactAddress;
}
