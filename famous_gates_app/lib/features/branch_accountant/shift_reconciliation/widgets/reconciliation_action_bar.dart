import 'package:flutter/material.dart';

class ReconciliationActionBar extends StatelessWidget {
  final bool isAccountant;
  final double variance;
  final bool explanationComplete;
  final VoidCallback onSaveDraft;
  final VoidCallback onSubmit;
  final VoidCallback onSendToAuditing;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback onRequestRecount;
  final VoidCallback onLockArchive;
  final bool isSaving;
  final bool isSubmitting;

  const ReconciliationActionBar({
    super.key,
    required this.isAccountant,
    required this.variance,
    required this.explanationComplete,
    required this.onSaveDraft,
    required this.onSubmit,
    required this.onSendToAuditing,
    required this.onApprove,
    required this.onReject,
    required this.onRequestRecount,
    required this.onLockArchive,
    required this.isSaving,
    required this.isSubmitting,
  });

  @override
  Widget build(BuildContext context) {
    final bool disableSubmission = variance != 0 && !explanationComplete;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, -4),
          )
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            if (isSaving)
              const Row(
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 8),
                  Text('Auto-saving draft...', style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              )
            else
              const Text('Draft saved', style: TextStyle(fontSize: 12, color: Colors.grey)),
            const Spacer(),
            if (!isAccountant) ...[
              OutlinedButton(
                onPressed: isSubmitting ? null : onSaveDraft,
                child: const Text('Save Draft'),
              ),
              const SizedBox(width: 12),
              FilledButton(
                onPressed: (isSubmitting || disableSubmission) ? null : onSubmit,
                style: FilledButton.styleFrom(backgroundColor: Colors.teal),
                child: const Text('Reconcile Shift'),
              ),
              const SizedBox(width: 12),
              FilledButton(
                onPressed: (isSubmitting || disableSubmission) ? null : onSendToAuditing,
                style: FilledButton.styleFrom(backgroundColor: Colors.blue.shade700),
                child: isSubmitting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Send for Auditing'),
              ),
            ] else ...[
              OutlinedButton(
                onPressed: isSubmitting ? null : onRequestRecount,
                style: OutlinedButton.styleFrom(foregroundColor: Colors.orange.shade800),
                child: const Text('Request Recount'),
              ),
              const SizedBox(width: 12),
              OutlinedButton(
                onPressed: isSubmitting ? null : onReject,
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade800),
                child: const Text('Reject'),
              ),
              const SizedBox(width: 12),
              FilledButton(
                onPressed: isSubmitting ? null : onApprove,
                style: FilledButton.styleFrom(backgroundColor: Colors.blue.shade700),
                child: isSubmitting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Approve Reconciliation'),
              ),
              const SizedBox(width: 12),
              FilledButton(
                onPressed: isSubmitting ? null : onLockArchive,
                style: FilledButton.styleFrom(backgroundColor: Colors.grey.shade900),
                child: const Text('Lock & Archive'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
