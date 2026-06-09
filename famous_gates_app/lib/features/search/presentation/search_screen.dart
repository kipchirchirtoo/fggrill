import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/models.dart';
import '../domain/providers.dart';

final _allModules = [
  'staff',
  'guest',
  'booking',
  'order',
  'bill',
  'transaction',
  'receipt',
  'payment'
];

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(searchProvider);

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () {
            final router = GoRouter.of(context);
            if (router.canPop()) {
              router.pop();
            } else {
              router.go('/terminal?hub=1');
            }
          },
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
        ),
        title: const Text('Search'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: TextField(
              controller: _searchController,
              focusNode: _focusNode,
              onChanged: (value) =>
                  ref.read(searchProvider.notifier).search(value),
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Search staff, guests, bookings, orders...',
                prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          ref.read(searchProvider.notifier).search('');
                          _focusNode.requestFocus();
                        },
                      )
                    : null,
                filled: true,
                fillColor: AppColors.kSurface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          Expanded(child: _buildResults(searchState)),
        ],
      ),
    );
  }

  Widget _buildResults(AsyncValue<SearchResponse?> searchState) {
    return searchState.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline,
                  color: AppColors.kError, size: 48),
              const SizedBox(height: 12),
              const Text('Search failed',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text('$error',
                  style: const TextStyle(color: AppColors.kTextSecondary)),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => ref
                    .read(searchProvider.notifier)
                    .search(_searchController.text),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (response) {
        if (response == null) {
          return _buildEmptyState();
        }
        if (response.results.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIcons.magnifyingGlass(),
                    size: 56, color: AppColors.kTextSecondary),
                const SizedBox(height: 12),
                const Text('No results found', style: TextStyle(fontSize: 16)),
                const SizedBox(height: 4),
                Text('No matches for "${response.query}"',
                    style: const TextStyle(color: AppColors.kTextSecondary)),
              ],
            ),
          );
        }

        final grouped = _groupByType(response.results);
        return RefreshIndicator(
          onRefresh: () async =>
              ref.read(searchProvider.notifier).search(_searchController.text),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text('${response.count} results for "${response.query}"',
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 13)),
              ),
              ...grouped.entries
                  .map((entry) => _buildTypeGroup(entry.key, entry.value)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIcons.magnifyingGlass(),
                size: 64, color: AppColors.kTextSecondary),
            const SizedBox(height: 16),
            const Text('Search across all modules',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('Search domains:',
                style: TextStyle(color: AppColors.kTextSecondary)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              alignment: WrapAlignment.center,
              children: _allModules
                  .map((m) => Chip(
                        label: Text(m[0].toUpperCase() + m.substring(1),
                            style: const TextStyle(fontSize: 12)),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.compact,
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }

  Map<String, List<SearchResult>> _groupByType(List<SearchResult> results) {
    final map = <String, List<SearchResult>>{};
    for (final r in results) {
      map.putIfAbsent(r.type, () => []).add(r);
    }
    return map;
  }

  Widget _buildTypeGroup(String type, List<SearchResult> results) {
    final first = results.first;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, top: 12, bottom: 6),
          child: Row(
            children: [
              Icon(first.icon, color: first.color, size: 16),
              const SizedBox(width: 6),
              Text(
                  '${type[0].toUpperCase()}${type.substring(1)} (${results.length})',
                  style: TextStyle(
                      color: first.color,
                      fontWeight: FontWeight.bold,
                      fontSize: 13)),
            ],
          ),
        ),
        ...results.map((r) => Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 6),
              child: ListTile(
                dense: true,
                leading: CircleAvatar(
                  backgroundColor: r.color.withValues(alpha: 0.12),
                  child: Icon(r.icon, color: r.color, size: 20),
                ),
                title: Text(r.title,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle:
                    Text(r.subtitle, style: const TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.chevron_right,
                    size: 18, color: AppColors.kTextSecondary),
              ),
            )),
      ],
    );
  }
}
