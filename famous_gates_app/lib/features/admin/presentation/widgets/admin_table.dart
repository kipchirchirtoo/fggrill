import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class AdminTable extends StatefulWidget {
  final List<String> columns;
  final List<List<Widget>> rows;
  final bool hasActions;

  const AdminTable({
    super.key,
    required this.columns,
    required this.rows,
    this.hasActions = false,
  });

  @override
  State<AdminTable> createState() => _AdminTableState();
}

class _AdminTableState extends State<AdminTable> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scroll(double delta) {
    if (!_scrollController.hasClients) return;
    final target = (_scrollController.offset + delta).clamp(
      0.0,
      _scrollController.position.maxScrollExtent,
    );
    _scrollController.animateTo(
      target,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final normalizedRows = widget.rows.map((row) {
      if (row.length == widget.columns.length) return row;
      if (row.length > widget.columns.length) return row.take(widget.columns.length).toList();
      return [
        ...row,
        for (var i = row.length; i < widget.columns.length; i++)
          const SizedBox.shrink(),
      ];
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: Colors.blue.shade50.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: Colors.blue.shade100),
          ),
          child: Row(
            children: [
              const Icon(Icons.swap_horiz, size: 16, color: AppColors.kPrimary),
              const SizedBox(width: 6),
              const Text(
                'Scroll Tool:',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppColors.kPrimary,
                ),
              ),
              const Spacer(),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.kPrimary,
                  elevation: 1,
                ),
                onPressed: () => _scroll(-250),
                icon: const Icon(Icons.arrow_back, size: 12),
                label: const Text('Scroll Left', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 6),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                  elevation: 1,
                ),
                onPressed: () => _scroll(250),
                icon: const Icon(Icons.arrow_forward, size: 12),
                label: const Text('Scroll Right', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Scrollbar(
              controller: _scrollController,
              thumbVisibility: true,
              trackVisibility: true,
              child: SingleChildScrollView(
                controller: _scrollController,
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
                  border: TableBorder(
                    horizontalInside:
                        BorderSide(color: AppColors.kDivider.withValues(alpha: 0.3)),
                  ),
                  columnSpacing: 24,
                  columns: [
                    for (final col in widget.columns)
                      DataColumn(
                        label: Text(col,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                                color: AppColors.kTextSecondary)),
                      ),
                  ],
                  rows: [
                    for (int i = 0; i < normalizedRows.length; i++)
                      DataRow(
                        color: WidgetStateProperty.all(i.isEven
                            ? Colors.white
                            : AppColors.kSurface.withValues(alpha: 0.5)),
                        cells: normalizedRows[i]
                            .map((w) => DataCell(w))
                            .toList(),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String status;
  final Color? color;

  const StatusBadge({super.key, required this.status, this.color});

  Color _resolveColor() {
    if (color != null) return color!;
    switch (status.toLowerCase()) {
      case 'active':
      case 'available':
      case 'confirmed':
      case 'paid':
      case 'present':
        return AppColors.kSuccess;
      case 'inactive':
      case 'maintenance':
      case 'cancelled':
      case 'unpaid':
      case 'late':
        return AppColors.kError;
      case 'pending':
      case 'in progress':
      case 'cleaning':
        return AppColors.kWarning;
      default:
        return AppColors.kTextSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _resolveColor();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(status,
          style:
              TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: c)),
    );
  }
}
