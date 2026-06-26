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
  late final TextEditingController _searchCtrl;

  @override
  void initState() {
    super.initState();
    _searchCtrl = TextEditingController(text: widget.search);
  }

  @override
  void didUpdateWidget(covariant FilterBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.search != widget.search && _searchCtrl.text != widget.search) {
      _searchCtrl.text = widget.search;
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: isDark ? theme.colorScheme.surface : Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Wrap(
          spacing: 16,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            // Search field
            SizedBox(
              width: 280,
              height: 44,
              child: TextField(
                controller: _searchCtrl,
                style: const TextStyle(fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search product name or SKU...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () {
                            _searchCtrl.clear();
                            widget.onSearchChanged('');
                          },
                        )
                      : null,
                  contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: theme.primaryColor, width: 1.5),
                  ),
                ),
                onChanged: widget.onSearchChanged,
              ),
            ),

            // Category Filter
            _buildDropdownFilter(
              label: 'Category',
              value: widget.selectedCategory,
              icon: Icons.grid_view_outlined,
              items: [
                const DropdownMenuItem(value: 'all', child: Text('All Categories')),
                ...widget.categories.map((c) => DropdownMenuItem(value: c, child: Text(c))),
              ],
              onChanged: (v) {
                if (v != null) widget.onCategoryChanged(v);
              },
            ),

            // Location/Outlet Filter (Only editable for Bar stocktake)
            if (widget.isBarType)
              _buildDropdownFilter(
                label: 'Outlet',
                value: widget.selectedLocation,
                icon: Icons.storefront_outlined,
                items: [
                  const DropdownMenuItem(value: 'main_bar', child: Text('Main Bar')),
                  if (widget.hasExecutiveBar)
                    const DropdownMenuItem(value: 'executive_bar', child: Text('Executive Bar')),
                ],
                onChanged: (v) {
                  if (v != null) widget.onLocationChanged(v);
                },
              )
            else
              _buildDropdownFilter(
                label: 'Store',
                value: widget.selectedLocation,
                icon: Icons.store_outlined,
                items: const [
                  DropdownMenuItem(value: 'branch_store', child: Text('Main Store')),
                ],
                onChanged: null, // read-only
              ),

            // Date Filter
            InkWell(
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
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Icon(Icons.calendar_month_outlined, size: 18, color: Colors.grey.shade600),
                    const SizedBox(width: 6),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Date',
                          style: TextStyle(
                            fontSize: 9,
                            color: Colors.grey.shade600,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          () {
                            try {
                              return DateFormat('d MMM yyyy')
                                  .format(DateFormat('yyyy-MM-dd').parse(widget.selectedDate));
                            } catch (_) {
                              return DateFormat('d MMM yyyy').format(DateTime.now());
                            }
                          }(),
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_drop_down, size: 18),
                  ],
                ),
              ),
            ),

            // Apply Filters button
            ElevatedButton.icon(
              onPressed: widget.onApply,
              style: ElevatedButton.styleFrom(
                backgroundColor: theme.primaryColor,
                foregroundColor: Colors.white,
                minimumSize: const Size(120, 44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              icon: const Icon(Icons.filter_alt_outlined, size: 18),
              label: const Text(
                'Apply Filters',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDropdownFilter({
    required String label,
    required String value,
    required IconData icon,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?>? onChanged,
  }) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade600),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 9,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w600,
                ),
              ),
              SizedBox(
                height: 20,
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: value,
                    items: items,
                    onChanged: onChanged,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
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
}
