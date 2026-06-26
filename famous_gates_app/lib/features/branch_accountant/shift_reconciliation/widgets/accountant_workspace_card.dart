import 'package:flutter/material.dart';

class AccountantWorkspaceCard extends StatefulWidget {
  final VoidCallback onApprove;
  final ValueChanged<String> onReject;
  final VoidCallback onRequestRecount;
  final String notes;
  final ValueChanged<String> onNotesChanged;
  final String accountantName;

  const AccountantWorkspaceCard({
    super.key,
    required this.onApprove,
    required this.onReject,
    required this.onRequestRecount,
    required this.notes,
    required this.onNotesChanged,
    required this.accountantName,
  });

  @override
  State<AccountantWorkspaceCard> createState() => _AccountantWorkspaceCardState();
}

class _AccountantWorkspaceCardState extends State<AccountantWorkspaceCard> {
  String _selectedAdjType = 'Cash Shortage';
  final _adjAmountController = TextEditingController();
  final _adjReasonController = TextEditingController();
  final _adjRefController = TextEditingController();
  bool _approvalRequired = false;
  late TextEditingController _notesController;

  final List<String> _adjTypes = [
    'Cash Shortage',
    'Cash Overage',
    'Float Adjustment',
    'Banking Adjustment',
    'Credit Bill Adjustment',
    'Journal Correction'
  ];

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController(text: widget.notes);
  }

  @override
  void didUpdateWidget(covariant AccountantWorkspaceCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.notes != widget.notes && _notesController.text != widget.notes) {
      _notesController.text = widget.notes;
    }
  }

  @override
  void dispose() {
    _adjAmountController.dispose();
    _adjReasonController.dispose();
    _adjRefController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.blue.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.account_balance_rounded, color: Colors.blue.shade700),
                const SizedBox(width: 8),
                const Text(
                  'Accountant Workspace',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Financial Adjustments',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _selectedAdjType,
              decoration: const InputDecoration(
                labelText: 'Adjustment Type',
                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
              items: _adjTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedAdjType = val);
              },
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _adjAmountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Amount (KES)'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _adjRefController,
                    decoration: const InputDecoration(labelText: 'Journal Ref'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _adjReasonController,
              decoration: const InputDecoration(labelText: 'Adjustment Reason'),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Requires Supervisor Approval',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                Switch(
                  value: _approvalRequired,
                  onChanged: (val) => setState(() => _approvalRequired = val),
                ),
              ],
            ),
            const Divider(height: 24),
            const Text(
              'Reconciliation Tools',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _ToolButton(label: 'Recalculate Totals', icon: Icons.refresh, onTap: () {}),
                _ToolButton(label: 'Compare with System', icon: Icons.compare_arrows, onTap: () {}),
                _ToolButton(label: 'Detect Missing Txs', icon: Icons.find_in_page, onTap: () {}),
                _ToolButton(label: 'Validate Shift', icon: Icons.check_circle_outline, onTap: () {}),
                _ToolButton(label: 'Variance Report', icon: Icons.picture_as_pdf, onTap: () {}),
                _ToolButton(label: 'Audit Trail', icon: Icons.history, onTap: () {}),
              ],
            ),
            const Divider(height: 24),
            const Text(
              'Review Decision',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 10),
            Text(
              'Reviewed By: ${widget.accountantName}',
              style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notesController,
              minLines: 3,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Enter review comments or recount instructions...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onChanged: widget.onNotesChanged,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: widget.onRequestRecount,
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.orange.shade800),
                    child: const Text('Recount'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      _showRejectReasonDialog(context);
                    },
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade800),
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: widget.onApprove,
                    style: FilledButton.styleFrom(backgroundColor: Colors.blue.shade800),
                    child: const Text('Approve'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showRejectReasonDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Reconciliation'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Please provide a reason for rejecting this shift reconciliation:'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                hintText: 'Reason for rejection...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final reason = controller.text.trim();
              if (reason.isNotEmpty) {
                Navigator.pop(ctx);
                widget.onReject(reason);
              }
            },
            child: const Text('Submit Rejection'),
          ),
        ],
      ),
    );
  }
}

class _ToolButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _ToolButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 14),
      label: Text(label, style: const TextStyle(fontSize: 11)),
      onPressed: onTap,
      backgroundColor: const Color(0xFFF1F5F9),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    );
  }
}
