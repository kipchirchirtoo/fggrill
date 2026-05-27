import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';

// ─── Shared ────────────────────────────────────────────────────────────────

Widget _header(String title, IconData icon, {String? subtitle}) => Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: AppColors.kDivider))),
      child: Row(children: [
        Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: AppColors.kPrimary, size: 20)),
        const SizedBox(width: 14),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.kTextPrimary)),
          if (subtitle != null)
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
        ]),
      ]),
    );

class _Stat extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _Stat(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});
  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
        child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(height: 8),
              Text(value,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w700)),
              Text(label,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.kTextSecondary)),
            ])),
      );
}

Widget _emptyTable(String title) => Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14))),
        const Divider(height: 1),
        const Padding(
            padding: EdgeInsets.all(20),
            child: Center(
                child: Text('No records found',
                    style: TextStyle(color: AppColors.kTextSecondary)))),
      ]),
    );

// ═══════════════════════════════════════════════════════════════════
// CORPORATE FUNCTIONS / PROCUREMENT
// ═══════════════════════════════════════════════════════════════════

class ProcurementOverviewSection extends StatelessWidget {
  const ProcurementOverviewSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Procurement Overview', PhosphorIcons.shoppingCart(),
            subtitle: 'Central procurement management and purchasing'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _Stat(
                            label: 'Open POs',
                            value: '—',
                            icon: PhosphorIcons.fileText(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Pending Approval',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Spend This Month',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Active Suppliers',
                            value: '—',
                            icon: PhosphorIcons.users(),
                            color: Colors.blue)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Recent Purchase Orders'),
                ]))),
      ]);
}

class SupplierInvoicesSection extends StatelessWidget {
  const SupplierInvoicesSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Supplier Invoices', PhosphorIcons.receipt(),
            subtitle: 'Manage and track supplier invoices (accounts payable)'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _Stat(
                            label: 'Unpaid',
                            value: '—',
                            icon: PhosphorIcons.receipt(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Due This Week',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Paid This Month',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Invoices',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final supplierCtrl = TextEditingController();
                            final amountCtrl = TextEditingController();
                            final invoiceNoCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Record Supplier Invoice'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: supplierCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Supplier Name')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: invoiceNoCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Invoice Number')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: amountCtrl,
                                          keyboardType: TextInputType.number,
                                          decoration: const InputDecoration(
                                              labelText: 'Amount (KES)',
                                              prefixText: 'KES ')),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                    onPressed: () {
                                      Navigator.pop(ctx);
                                      AppNotifier.showSnackBar(
                                          context,
                                          SnackBar(
                                              content: Text(
                                                  'Invoice ${invoiceNoCtrl.text} recorded')));
                                    },
                                    child: const Text('Record'),
                                  ),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('Record Invoice'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _emptyTable('Supplier Invoices'),
                ]))),
      ]);
}

class ProcurementPaymentsSection extends StatelessWidget {
  const ProcurementPaymentsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Payments', PhosphorIcons.creditCard(),
            subtitle: 'Supplier payment processing and history'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _Stat(
                            label: 'Payments Today',
                            value: '—',
                            icon: PhosphorIcons.creditCard(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'This Month',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Outstanding',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Payment History'),
                ]))),
      ]);
}

// ═══════════════════════════════════════════════════════════════════
// HUMAN RESOURCES
// ═══════════════════════════════════════════════════════════════════

class AttendanceLogsSection extends StatelessWidget {
  const AttendanceLogsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Attendance Logs', PhosphorIcons.clockClockwise(),
            subtitle: 'Detailed staff attendance records and clock-in history'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _Stat(
                            label: 'Present Today',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Absent',
                            value: '—',
                            icon: PhosphorIcons.x(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Late',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'On Leave',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: Colors.blue)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Attendance Log'),
                ]))),
      ]);
}

class LeaveRequestsSection extends StatelessWidget {
  const LeaveRequestsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Leave Requests', PhosphorIcons.calendar(),
            subtitle: 'Manage and approve staff leave applications'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _Stat(
                            label: 'Pending',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Approved',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'On Leave Now',
                            value: '—',
                            icon: PhosphorIcons.users(),
                            color: Colors.blue)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Leave Requests'),
                ]))),
      ]);
}

class SalariesSection extends StatelessWidget {
  const SalariesSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Salaries', PhosphorIcons.creditCard(),
            subtitle: 'Staff salary records and compensation management'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _Stat(
                            label: 'Total Payroll',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Paid This Month',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Stat(
                            label: 'Pending',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Salary Records'),
                ]))),
      ]);
}

class PayrollProcessingSection extends StatelessWidget {
  const PayrollProcessingSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Payroll Processing', PhosphorIcons.coins(),
            subtitle: 'Run and process staff payroll'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Card(
                        elevation: 0,
                        color: AppColors.kPrimary.withValues(alpha: 0.05),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                                color:
                                    AppColors.kPrimary.withValues(alpha: 0.2))),
                        child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(children: [
                              Icon(PhosphorIcons.coins(),
                                  color: AppColors.kPrimary),
                              const SizedBox(width: 12),
                              const Expanded(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                    Text('Next Payroll Run',
                                        style: TextStyle(
                                            fontWeight: FontWeight.w600)),
                                    Text(
                                        'Process payroll for all active staff members',
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: AppColors.kTextSecondary)),
                                  ])),
                              ElevatedButton(
                                onPressed: () async {
                                  final confirm = await showDialog<bool>(
                                    context: context,
                                    builder: (ctx) => AlertDialog(
                                      title: const Text('Run Payroll'),
                                      content: const Text(
                                          'This will process payroll for all active staff. Continue?'),
                                      actions: [
                                        TextButton(
                                            onPressed: () =>
                                                Navigator.pop(ctx, false),
                                            child: const Text('Cancel')),
                                        ElevatedButton(
                                            style: ElevatedButton.styleFrom(
                                                backgroundColor:
                                                    AppColors.kPrimary),
                                            onPressed: () =>
                                                Navigator.pop(ctx, true),
                                            child: const Text('Run')),
                                      ],
                                    ),
                                  );
                                  if (confirm == true && context.mounted) {
                                    AppNotifier.showSnackBar(
                                        context,
                                        const SnackBar(
                                            content: Text(
                                                'Payroll processing started...')));
                                  }
                                },
                                style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.kPrimary,
                                    foregroundColor: Colors.white),
                                child: const Text('Run Payroll'),
                              ),
                            ])),
                      ),
                      const SizedBox(height: 20),
                      _emptyTable('Payroll History'),
                    ]))),
      ]);
}

class PayrollAdjustmentsSection extends StatelessWidget {
  const PayrollAdjustmentsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Adjustments', PhosphorIcons.arrowsLeftRight(),
            subtitle: 'Payroll deductions, bonuses and allowance adjustments'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: ElevatedButton.icon(
                      onPressed: () {
                        final staffCtrl = TextEditingController();
                        final amountCtrl = TextEditingController();
                        String type = 'bonus';
                        showDialog(
                          context: context,
                          builder: (ctx) => StatefulBuilder(
                            builder: (ctx, setS) => AlertDialog(
                              title: const Text('Add Payroll Adjustment'),
                              content: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    TextField(
                                        controller: staffCtrl,
                                        decoration: const InputDecoration(
                                            labelText: 'Staff Name')),
                                    const SizedBox(height: 12),
                                    DropdownButtonFormField<String>(
                                      initialValue: type,
                                      decoration: const InputDecoration(
                                          labelText: 'Type'),
                                      items: [
                                        'bonus',
                                        'deduction',
                                        'allowance',
                                        'overtime'
                                      ]
                                          .map((t) => DropdownMenuItem(
                                              value: t,
                                              child: Text(t.toUpperCase())))
                                          .toList(),
                                      onChanged: (v) =>
                                          setS(() => type = v ?? type),
                                    ),
                                    const SizedBox(height: 12),
                                    TextField(
                                        controller: amountCtrl,
                                        keyboardType: TextInputType.number,
                                        decoration: const InputDecoration(
                                            labelText: 'Amount (KES)',
                                            prefixText: 'KES ')),
                                  ]),
                              actions: [
                                TextButton(
                                    onPressed: () => Navigator.pop(ctx),
                                    child: const Text('Cancel')),
                                ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        SnackBar(
                                            content: Text(
                                                'Adjustment added for ${staffCtrl.text}')));
                                  },
                                  child: const Text('Add'),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('Add Adjustment'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    )),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Adjustments'),
                ]))),
      ]);
}
