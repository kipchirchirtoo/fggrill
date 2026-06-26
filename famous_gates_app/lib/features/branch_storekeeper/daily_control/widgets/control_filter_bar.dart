import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ControlFilterBar extends StatelessWidget {
  const ControlFilterBar({
    super.key,
    required this.date,
    required this.onDateChanged,
    required this.onRefresh,
    required this.onExport,
    required this.isLoading,
    this.shift,
    this.onShiftChanged,
  });

  final String date;
  final ValueChanged<String> onDateChanged;
  final VoidCallback onRefresh;
  final VoidCallback onExport;
  final bool isLoading;

  /// Active shift filter: 'A', 'B', or null (full day).
  final String? shift;
  final ValueChanged<String?>? onShiftChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Wrap(
          spacing: 12,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            // ── Date picker ──────────────────────────────────────────────
            InkWell(
              onTap: () async {
                final initial = DateFormat('yyyy-MM-dd').parse(date);
                final picked = await showDatePicker(
                  context: context,
                  initialDate: initial,
                  firstDate: DateTime.now().subtract(const Duration(days: 90)),
                  lastDate: DateTime.now(),
                );
                if (picked != null) {
                  onDateChanged(DateFormat('yyyy-MM-dd').format(picked));
                }
              },
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.calendar_month_outlined,
                        size: 20, color: Colors.grey.shade600),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Date',
                            style: TextStyle(
                                fontSize: 10,
                                color: Colors.grey.shade600,
                                fontWeight: FontWeight.w600)),
                        Text(
                          DateFormat('d MMM yyyy')
                              .format(DateFormat('yyyy-MM-dd').parse(date)),
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_drop_down, size: 20),
                  ],
                ),
              ),
            ),

            // ── Shift filter chips ───────────────────────────────────────
            if (onShiftChanged != null) ...[
              _ShiftChip(
                label: 'All Day',
                selected: shift == null,
                onTap: () => onShiftChanged!(null),
              ),
              _ShiftChip(
                label: 'Shift A',
                subtitle: '6 am–6 pm',
                selected: shift == 'A',
                onTap: () => onShiftChanged!('A'),
              ),
              _ShiftChip(
                label: 'Shift B',
                subtitle: '6 pm–6 am',
                selected: shift == 'B',
                onTap: () => onShiftChanged!('B'),
              ),
            ],

            OutlinedButton.icon(
              onPressed: isLoading ? null : onRefresh,
              icon: isLoading
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.refresh, size: 18),
              label: const Text('Refresh'),
            ),
            FilledButton.icon(
              onPressed: isLoading ? null : onExport,
              style: FilledButton.styleFrom(backgroundColor: theme.primaryColor),
              icon: const Icon(Icons.download_outlined, size: 18),
              label: const Text('Export CSV'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShiftChip extends StatelessWidget {
  const _ShiftChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.subtitle,
  });

  final String label;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.12) : Colors.grey.shade100,
          border: Border.all(
            color: selected ? color : Colors.grey.shade300,
            width: selected ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                color: selected ? color : Colors.grey.shade700,
              ),
            ),
            if (subtitle != null)
              Text(
                subtitle!,
                style: TextStyle(
                  fontSize: 10,
                  color: selected ? color.withValues(alpha: 0.8) : Colors.grey.shade500,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
