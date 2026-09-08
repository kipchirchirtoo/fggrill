import 'package:flutter/material.dart';

/// Lets the receptionist enter the two guest-service surcharges that need to
/// show up on the final bill/folio with an explicit description —
/// "Double Occupancy Charge" (only relevant once a second adult is in the
/// room; single occupancy has no extra charge, so the field only appears at
/// 2+ adults) and "Breakfast Charge (addition)" (an opt-in toggle, for a
/// room whose rate doesn't already include breakfast — hidden entirely when
/// [breakfastIncluded] is true, so staff can't double-charge for something
/// the room rate already covers).
///
/// Shared by every check-in dialog/screen (Quick Check-in, the pre-check-in
/// confirm dialog, the Guest Check-In search screen, and the New
/// Reservation/Booking dialog) instead of each one growing its own copy —
/// the caller is responsible for actually posting the entered amounts to the
/// folio (via `ReceptionRepository.addFolioTransaction`) with these exact
/// description strings once the booking/check-in succeeds; see
/// `buildFolioInvoiceItems` / `_isAdditionalServiceTx`, which give any
/// "Additional Service" folio transaction its own named line on the printed
/// invoice instead of folding it into a generic total.
class OccupancyBreakfastCharges extends StatelessWidget {
  const OccupancyBreakfastCharges({
    super.key,
    required this.adults,
    required this.doubleOccCtrl,
    required this.addBreakfast,
    required this.onAddBreakfastChanged,
    required this.breakfastCtrl,
    this.breakfastIncluded = false,
  });

  final int adults;
  final TextEditingController doubleOccCtrl;
  final bool addBreakfast;
  final ValueChanged<bool> onAddBreakfastChanged;
  final TextEditingController breakfastCtrl;

  /// True when the room's current meal plan already includes breakfast
  /// (Bed & Breakfast, Half Board, Full Board, ...). Defaults to false
  /// (i.e. "show the option") for callers with no meal-plan concept at all
  /// — e.g. a walk-in Quick Check-in, where there's nothing to check against
  /// so we can't assume breakfast is covered.
  final bool breakfastIncluded;

  /// True when [mealPlan] — in any of the spellings used across the app
  /// ('bed_breakfast', 'BB', 'Half Board', 'FB', free text, ...) — already
  /// includes breakfast. An explicit "room only", or an unrecognised/blank
  /// value, counts as NOT included (we can't assume it's covered).
  static bool breakfastIncludedInMealPlan(String? mealPlan) {
    final p = (mealPlan ?? '').trim().toLowerCase();
    const notIncluded = {'room only', 'room_only', 'none', ''};
    if (notIncluded.contains(p)) return false;
    const includedTokens = [
      'breakfast',
      'bed & breakfast',
      'bed and breakfast',
      'bed_breakfast',
      'half board',
      'half_board',
      'full board',
      'full_board',
      'bb',
      'hb',
      'fb',
    ];
    return includedTokens.any((t) => p == t || p.contains(t));
  }

  /// Reads back the two charges as `{description: amount}`, ready to post
  /// via `addFolioTransaction`. Only includes a charge when its field is a
  /// positive number (Double Occupancy only at `adults >= 2`; Breakfast
  /// never when [breakfastIncluded] is true, regardless of what's typed in
  /// a since-hidden field).
  static Map<String, double> resolve({
    required int adults,
    required TextEditingController doubleOccCtrl,
    required bool addBreakfast,
    required TextEditingController breakfastCtrl,
    bool breakfastIncluded = false,
  }) {
    final doubleOcc =
        adults >= 2 ? double.tryParse(doubleOccCtrl.text.trim()) : null;
    final breakfast = (!breakfastIncluded && addBreakfast)
        ? double.tryParse(breakfastCtrl.text.trim())
        : null;
    return {
      if (doubleOcc != null && doubleOcc > 0)
        'Double Occupancy Charge': doubleOcc,
      if (breakfast != null && breakfast > 0)
        'Breakfast Charge (addition)': breakfast,
    };
  }

  @override
  Widget build(BuildContext context) {
    final isDoubleOccupancy = adults >= 2;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isDoubleOccupancy) ...[
          TextField(
            controller: doubleOccCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Double Occupancy Charge (KES)',
              helperText:
                  '2+ adults in this room. Leave blank if no extra charge applies.',
              prefixIcon: Icon(Icons.people_alt_outlined, size: 18),
              isDense: true,
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (!breakfastIncluded) ...[
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            value: addBreakfast,
            onChanged: (v) => onAddBreakfastChanged(v ?? false),
            title: const Text('Add breakfast (not included in room rate)'),
          ),
          if (addBreakfast)
            TextField(
              controller: breakfastCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Breakfast Charge (KES)',
                prefixIcon: Icon(Icons.free_breakfast_outlined, size: 18),
                isDense: true,
              ),
            ),
        ],
      ],
    );
  }
}
