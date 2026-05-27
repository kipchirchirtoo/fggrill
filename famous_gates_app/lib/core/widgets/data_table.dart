import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:shimmer/shimmer.dart';
import '../theme/app_theme.dart';

class DataColumn {
  const DataColumn({
    required this.label,
    this.flex = 1,
    this.alignment = Alignment.centerLeft,
  });

  final String label;
  final int flex;
  final Alignment alignment;
}

class DataRow {
  const DataRow({required this.cells, this.onTap, this.color});

  final List<Widget> cells;
  final VoidCallback? onTap;
  final Color? color;
}

class DataTableWidget extends StatelessWidget {
  const DataTableWidget({
    super.key,
    required this.columns,
    required this.rows,
    this.isLoading = false,
    this.isEmpty = false,
    this.emptyMessage = 'No data available.',
    this.onRefresh,
    this.searchQuery,
    this.onSearchChanged,
  });

  final List<DataColumn> columns;
  final List<DataRow> rows;
  final bool isLoading;
  final bool isEmpty;
  final String emptyMessage;
  final VoidCallback? onRefresh;
  final String? searchQuery;
  final ValueChanged<String>? onSearchChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (onSearchChanged != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
            child: SizedBox(
              width: 300,
              child: TextField(
                onChanged: onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'Search...',
                  prefixIcon: Icon(
                    PhosphorIcons.magnifyingGlass(),
                    size: 20,
                  ),
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  isDense: true,
                ),
              ),
            ),
          ),
        Expanded(
          child: isLoading
              ? _buildSkeleton()
              : isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            PhosphorIcons.package(),
                            size: 48,
                            color: AppColors.kDivider,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            emptyMessage,
                            style: const TextStyle(
                              color: AppColors.kTextSecondary,
                            ),
                          ),
                          if (onRefresh != null) ...[
                            const SizedBox(height: 16),
                            OutlinedButton.icon(
                              onPressed: onRefresh,
                              icon: const Icon(Icons.refresh, size: 16),
                              label: const Text('Refresh'),
                            ),
                          ],
                        ],
                      ),
                    )
                  : _buildTable(),
        ),
      ],
    );
  }

  Widget _buildTable() {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.kDivider),
            borderRadius: BorderRadius.circular(12),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Column(
              children: [
                _buildHeader(),
                ...rows.asMap().entries.map((entry) {
                  final index = entry.key;
                  final row = entry.value;
                  return Column(
                    children: [
                      if (index > 0)
                        const Divider(height: 1, color: AppColors.kDivider),
                      InkWell(
                        onTap: row.onTap,
                        child: Container(
                          color: row.color ??
                              (index.isEven
                                  ? Colors.white
                                  : AppColors.kSurface),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          child: Row(
                            children: row.cells.asMap().entries.map((cell) {
                              final col = columns[cell.key];
                              return Expanded(
                                flex: col.flex,
                                child: Align(
                                  alignment: col.alignment,
                                  child: cell.value,
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ],
                  );
                }),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppColors.kPrimary,
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      child: Row(
        children: columns
            .map(
              (col) => Expanded(
                flex: col.flex,
                child: Align(
                  alignment: col.alignment,
                  child: Text(
                    col.label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _buildSkeleton() {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: List.generate(
            8,
            (_) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class Badge extends StatelessWidget {
  const Badge({
    super.key,
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
