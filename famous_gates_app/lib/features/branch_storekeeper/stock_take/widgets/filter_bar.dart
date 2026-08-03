import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class FilterBar extends StatefulWidget {
  final String search;
  final String selectedCategory;
  final List<String> categories;
  final String selectedLocation;
  final bool hasExecutiveBar;
  final String selectedDate;
  final bool isBarType;

  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onCategoryChanged;
  final ValueChanged<String> onLocationChanged;
  final ValueChanged<String> onDateChanged;
  final VoidCallback onApply;

  const FilterBar({
    super.key,
    required this.search,
    required this.selectedCategory,
    required this.categories,
    required this.selectedLocation,
    required this.hasExecutiveBar,
    required this.selectedDate,
    required this.isBarType,
    required this.onSearchChanged,
    required this.onCategoryChanged,
    required this.onLocationChanged,
    required this.onDateChanged,
    required this.onApply,
  });

  @override
  State<FilterBar> createState() => _FilterBarState();
}

class _FilterBarState extends State<FilterBar> {
  // Constructed at declaration (not `late` + initState) so a hot reload —
  // which does not re-run initState — can never hit a LateInitializationError.
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _searchController.text = widget.search;
  }

  @override
  void didUpdateWidget(covariant FilterBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.search != widget.search &&
        _searchController.text != widget.search) {
      _searchController.text = widget.search;
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? theme.colorScheme.surface : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Wrap(
        spacing: 14,
        runSpacing: 14,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          SizedBox(
            width: 320,
            child: TextField(
              controller: _searchController,
              style: const TextStyle(fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search item name or SKU',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          setState(_searchController.clear);
                          widget.onSearchChanged('');
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 14,
                ),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFD0D7E2)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFD0D7E2)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(
                    color: theme.colorScheme.primary,
                    width: 1.4,
                  ),
                ),
              ),
              onChanged: (value) {
                setState(() {});
                widget.onSearchChanged(value);
              },
            ),
          ),
          _buildDropdownFilter(
            context: context,
            label: 'Category',
            value: widget.selectedCategory,
            icon: Icons.grid_view_outlined,
            items: [
              const DropdownMenuItem(
                value: 'all',
                child: Text('All Categories'),
              ),
              ...widget.categories.map(
                (category) => DropdownMenuItem(
                  value: category,
                  child: Text(category),
                ),
              ),
            ],
            onChanged: (value) {
              if (value != null) widget.onCategoryChanged(value);
            },
          ),
          if (widget.isBarType)
            _buildDropdownFilter(
              context: context,
              label: 'Outlet',
              value: widget.selectedLocation,
              icon: Icons.storefront_outlined,
              items: [
                const DropdownMenuItem(
                  value: 'main_bar',
                  child: Text('Main Bar'),
                ),
                if (widget.hasExecutiveBar)
                  const DropdownMenuItem(
                    value: 'executive_bar',
                    child: Text('Executive Bar'),
                  ),
              ],
              onChanged: (value) {
                if (value != null) widget.onLocationChanged(value);
              },
            )
          else
            _buildDropdownFilter(
              context: context,
              label: 'Store',
              value: widget.selectedLocation,
              icon: Icons.store_outlined,
              items: const [
                DropdownMenuItem(
                  value: 'branch_store',
                  child: Text('Main Store'),
                ),
              ],
              onChanged: null,
            ),
          _buildDateControl(context),
          FilledButton.icon(
            onPressed: widget.onApply,
            style: FilledButton.styleFrom(
              minimumSize: const Size(140, 52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            icon: const Icon(Icons.filter_alt_outlined, size: 18),
            label: const Text(
              'Apply Filters',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownFilter({
    required BuildContext context,
    required String label,
    required String value,
    required IconData icon,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?>? onChanged,
  }) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        border: Border.all(color: const Color(0xFFD0D7E2)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade600),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w600,
                ),
              ),
              SizedBox(
                height: 22,
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: value,
                    items: items,
                    onChanged: onChanged,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Theme.of(context).textTheme.bodyMedium?.color,
                    ),
                    icon: const Icon(Icons.arrow_drop_down, size: 16),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDateControl(BuildContext context) {
    return InkWell(
      onTap: () async {
        DateTime initial;
        try {
          initial = DateFormat('yyyy-MM-dd').parse(widget.selectedDate);
        } catch (_) {
          initial = DateTime.now();
        }
        final picked = await showDatePicker(
          context: context,
          initialDate: initial,
          firstDate: DateTime.now().subtract(const Duration(days: 30)),
          lastDate: DateTime.now().add(const Duration(days: 1)),
        );
        if (picked != null) {
          final formatted = DateFormat('yyyy-MM-dd').format(picked);
          widget.onDateChanged(formatted);
        }
      },
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          border: Border.all(color: const Color(0xFFD0D7E2)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.calendar_month_outlined, size: 18, color: Colors.grey.shade600),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Date',
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.grey.shade600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  () {
                    try {
                      return DateFormat('d MMM yyyy').format(
                        DateFormat('yyyy-MM-dd').parse(widget.selectedDate),
                      );
                    } catch (_) {
                      return DateFormat('d MMM yyyy').format(DateTime.now());
                    }
                  }(),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_drop_down, size: 18),
          ],
        ),
      ),
    );
  }
}
