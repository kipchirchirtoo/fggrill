import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/branch_search_repository.dart';
import 'branch_entity_detail_screen.dart';

IconData entityIcon(String key) {
  switch (key) {
    case 'user':
      return Icons.person;
    case 'identification':
      return Icons.badge;
    case 'clock':
      return Icons.schedule;
    case 'money':
      return Icons.payments;
    case 'receipt':
      return Icons.receipt_long;
    case 'bank':
      return Icons.account_balance;
    case 'book':
      return Icons.menu_book;
    case 'check':
      return Icons.check_circle;
    case 'fork':
      return Icons.restaurant;
    case 'wine':
      return Icons.wine_bar;
    case 'cart':
      return Icons.shopping_cart;
    case 'bed':
      return Icons.hotel;
    default:
      return Icons.description;
  }
}

/// Embedded section: search anything in the branch, then deep-dive into a record.
class BranchSearchSection extends ConsumerStatefulWidget {
  const BranchSearchSection({super.key});

  @override
  ConsumerState<BranchSearchSection> createState() => _BranchSearchSectionState();
}

class _BranchSearchSectionState extends ConsumerState<BranchSearchSection> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  final Set<String> _typeFilter = {};
  bool _loading = false;
  String? _error;
  SearchResponse? _response;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      setState(() => _query = value.trim());
      _runSearch();
    });
  }

  Future<void> _runSearch() async {
    if (_query.isEmpty) {
      setState(() {
        _response = null;
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(branchSearchRepositoryProvider).search(
            _query,
            types: _typeFilter.isEmpty ? null : _typeFilter.toList(),
          );
      if (!mounted) return;
      setState(() => _response = res);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openDetail(SearchResultItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BranchEntityDetailScreen(
          type: item.type,
          id: item.id,
          label: item.label,
        ),
      ),
    ).then((_) => _runSearch()); // refresh after edits/deletes
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Branch Search',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            'Search anything in your branch — staff, finances, POS orders, shifts, '
            'purchases, bookings and more. Tap a result to deep-dive, edit or act on it.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'Search name, number, reference, status…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _controller.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _controller.clear();
                        _onChanged('');
                      },
                    )
                  : null,
              border: const OutlineInputBorder(),
              isDense: true,
            ),
            onChanged: (v) {
              setState(() {}); // refresh suffix icon
              _onChanged(v);
            },
          ),
          const SizedBox(height: 12),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 40),
          const SizedBox(height: 8),
          Text(_error!, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          FilledButton(onPressed: _runSearch, child: const Text('Retry')),
        ]),
      );
    }
    if (_query.isEmpty) {
      return _hint('Start typing to search across your branch.');
    }
    final resp = _response;
    if (resp == null || resp.groups.isEmpty) {
      return _hint('No matches for "$_query".');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _filterChips(resp),
        const SizedBox(height: 8),
        Text('${resp.total} result${resp.total == 1 ? '' : 's'}',
            style: TextStyle(color: Colors.grey[600], fontSize: 12)),
        const SizedBox(height: 8),
        Expanded(
          child: ListView(
            children: [
              for (final g in resp.groups) ..._groupTiles(g),
            ],
          ),
        ),
      ],
    );
  }

  List<Widget> _groupTiles(SearchGroup g) {
    return [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Icon(entityIcon(g.icon), size: 18, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 8),
          Text(g.label, style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text('${g.count}', style: const TextStyle(fontSize: 11)),
          ),
        ]),
      ),
      ...g.results.map((item) => Card(
            elevation: 0,
            margin: const EdgeInsets.only(bottom: 6),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: BorderSide(color: Colors.grey.withValues(alpha: 0.2)),
            ),
            child: ListTile(
              leading: Icon(entityIcon(item.icon)),
              title: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: item.subtitle.isEmpty
                  ? null
                  : Text(item.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (item.amount != null)
                    Text('KES ${item.amount!.toStringAsFixed(0)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  if (item.status != null)
                    Text('${item.status}',
                        style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                ],
              ),
              onTap: () => _openDetail(item),
            ),
          )),
    ];
  }

  Widget _filterChips(SearchResponse resp) {
    // Build the chip set from the current result groups plus any active filters.
    final types = <String, String>{};
    for (final g in resp.groups) {
      types[g.type] = g.label;
    }
    for (final t in _typeFilter) {
      types.putIfAbsent(t, () => t);
    }
    return Wrap(
      spacing: 6,
      children: [
        FilterChip(
          label: const Text('All'),
          selected: _typeFilter.isEmpty,
          onSelected: (_) {
            setState(() => _typeFilter.clear());
            _runSearch();
          },
        ),
        ...types.entries.map((e) => FilterChip(
              label: Text(e.value),
              selected: _typeFilter.contains(e.key),
              onSelected: (sel) {
                setState(() {
                  if (sel) {
                    _typeFilter.add(e.key);
                  } else {
                    _typeFilter.remove(e.key);
                  }
                });
                _runSearch();
              },
            )),
      ],
    );
  }

  Widget _hint(String text) =>
      Center(child: Text(text, style: TextStyle(color: Colors.grey[600])));
}
