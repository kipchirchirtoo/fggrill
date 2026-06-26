import 'package:flutter/material.dart';

class VarianceExplanationForm extends StatefulWidget {
  final double variance;
  final String selectedReason;
  final ValueChanged<String> onReasonChanged;
  final String explanation;
  final ValueChanged<String> onExplanationChanged;
  final ValueChanged<String> onNotesChanged;
  final String notes;

  const VarianceExplanationForm({
    super.key,
    required this.variance,
    required this.selectedReason,
    required this.onReasonChanged,
    required this.explanation,
    required this.onExplanationChanged,
    required this.onNotesChanged,
    required this.notes,
  });

  @override
  State<VarianceExplanationForm> createState() => _VarianceExplanationFormState();
}

class _VarianceExplanationFormState extends State<VarianceExplanationForm> {
  final List<String> _reasons = [
    'Counting Error',
    'Theft',
    'Damage',
    'Customer Refund',
    'Float Adjustment',
    'Banking Error',
    'System Error',
    'Pending Deposit',
    'Other'
  ];

  late TextEditingController _explanationController;
  late TextEditingController _notesController;
  late TextEditingController _refController;

  @override
  void initState() {
    super.initState();
    _explanationController = TextEditingController(text: widget.explanation);
    _notesController = TextEditingController(text: widget.notes);
    _refController = TextEditingController();
  }

  @override
  void didUpdateWidget(covariant VarianceExplanationForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.explanation != widget.explanation && _explanationController.text != widget.explanation) {
      _explanationController.text = widget.explanation;
    }
    if (oldWidget.notes != widget.notes && _notesController.text != widget.notes) {
      _notesController.text = widget.notes;
    }
  }

  @override
  void dispose() {
    _explanationController.dispose();
    _notesController.dispose();
    _refController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.variance == 0) {
      // Notes is optional if variance is 0
      return Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: Colors.grey.shade200),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Reconciliation Notes',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _notesController,
                minLines: 4,
                maxLines: 6,
                decoration: InputDecoration(
                  hintText: 'Provide reconciliation notes, explanations, or observations...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                ),
                onChanged: widget.onNotesChanged,
              ),
            ],
          ),
        ),
      );
    }

    final int charsRemaining = 30 - widget.explanation.trim().length;

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.red.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Colors.red),
                const SizedBox(width: 8),
                Text(
                  'Variance Action Form (Required)',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.red.shade900),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Reason Category',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _reasons.contains(widget.selectedReason) ? widget.selectedReason : _reasons.first,
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
              ),
              items: _reasons.map((r) {
                return DropdownMenuItem(value: r, child: Text(r));
              }).toList(),
              onChanged: (val) {
                if (val != null) widget.onReasonChanged(val);
              },
            ),
            const SizedBox(height: 16),
            const Text(
              'Detailed Explanation (Min 30 characters)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _explanationController,
              minLines: 3,
              maxLines: 5,
              decoration: InputDecoration(
                hintText: 'Explain the discrepancy in detail...',
                errorText: charsRemaining > 0 ? 'Need $charsRemaining more characters' : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
              ),
              onChanged: widget.onExplanationChanged,
            ),
            const SizedBox(height: 16),
            const Text(
              'Reference Number (Optional)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _refController,
              decoration: InputDecoration(
                hintText: 'e.g. Deposit slip #, Receipt #',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Supporting Evidence (Receipt / Image / PDF)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: () {
                // Upload placeholder
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 20),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.cloud_upload_outlined, color: Colors.grey),
                    SizedBox(width: 8),
                    Text(
                      'Upload file or drag and drop',
                      style: TextStyle(color: Colors.grey, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Observations / Action Plan Notes',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _notesController,
              minLines: 3,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Observations, cash count breakdown details...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
              ),
              onChanged: widget.onNotesChanged,
            ),
          ],
        ),
      ),
    );
  }
}
