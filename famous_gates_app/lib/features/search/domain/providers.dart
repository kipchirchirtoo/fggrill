import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider =
    FutureProvider.autoDispose<SearchResponse?>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.trim().length < 2) return null;
  return ref.read(searchRepositoryProvider).globalSearch(query.trim());
});

final searchProvider =
    StateNotifierProvider<SearchNotifier, AsyncValue<SearchResponse?>>((ref) {
  return SearchNotifier(ref);
});

class SearchNotifier extends StateNotifier<AsyncValue<SearchResponse?>> {
  SearchNotifier(this._ref) : super(const AsyncValue.data(null));

  final Ref _ref;
  Timer? _debounce;

  void search(String query) {
    _debounce?.cancel();
    if (query.trim().length < 2) {
      state = const AsyncValue.data(null);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      state = const AsyncValue.loading();
      try {
        final result = await _ref
            .read(searchRepositoryProvider)
            .globalSearch(query.trim());
        state = AsyncValue.data(result);
      } catch (error, stack) {
        state = AsyncValue.error(error, stack);
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }
}
