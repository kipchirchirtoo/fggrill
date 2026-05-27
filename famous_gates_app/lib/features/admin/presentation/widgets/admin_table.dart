import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class AdminTable extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final normalizedRows = rows.map((row) {
      if (row.length == columns.length) return row;
      if (row.length > columns.length) return row.take(columns.length).toList();
      return [
        ...row,
        for (var i = row.length; i < columns.length; i++)
          const SizedBox.shrink(),
      ];
    }).toList();

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
            border: TableBorder(
              horizontalInside:
                  BorderSide(color: AppColors.kDivider.withValues(alpha: 0.3)),
            ),
            columnSpacing: 24,
            columns: [
              for (final col in columns)
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
                  cells: normalizedRows[i].map((w) => DataCell(w)).toList(),
                ),
            ],
          ),
        ),
      ),
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
