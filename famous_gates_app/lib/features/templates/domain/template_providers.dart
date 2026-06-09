import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/template_repository.dart';
import '../../../core/network/dio_client.dart';

final templateRepositoryProvider = Provider<TemplateRepository>((ref) {
  return TemplateRepository(ref.read(dioProvider));
});

/// In-memory cache of resolved documents so printing doesn't refetch each time.
/// Keyed by "key|branch|outlet". Refreshed when a SuperAdmin edits a template
/// (the editor clears this).
class ResolvedTemplateCache {
  final Map<String, ResolvedDocument> _cache = {};

  String _k(String key, String? branchId, String? outletId) =>
      '$key|${branchId ?? ''}|${outletId ?? ''}';

  ResolvedDocument? peek(String key, {String? branchId, String? outletId}) =>
      _cache[_k(key, branchId, outletId)];

  void put(ResolvedDocument doc, {String? branchId, String? outletId}) {
    _cache[_k(doc.key, branchId, outletId)] = doc;
  }

  void clear() => _cache.clear();
}

final resolvedTemplateCacheProvider =
    Provider<ResolvedTemplateCache>((ref) => ResolvedTemplateCache());

/// Fetch (and cache) a resolved document for printing. Returns null if the
/// backend is unreachable / template not configured — caller falls back.
Future<ResolvedDocument?> resolveDocumentCached(
  dynamic ref,
  String key, {
  String? branchId,
  String? outletId,
}) async {
  final cache = ref.read(resolvedTemplateCacheProvider);
  final cached = cache.peek(key, branchId: branchId, outletId: outletId);
  if (cached != null) return cached;
  final doc = await ref
      .read(templateRepositoryProvider)
      .resolve(key, branchId: branchId, outletId: outletId);
  if (doc != null) cache.put(doc, branchId: branchId, outletId: outletId);
  return doc;
}

/// SuperAdmin: list of templates.
final templateListProvider =
    FutureProvider.autoDispose.family<List, int?>((ref, branchId) async {
  return ref.read(templateRepositoryProvider).listTemplates(branchId: branchId);
});

/// SuperAdmin: till numbers by branch.
final tillNumbersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(templateRepositoryProvider).listTills();
});
