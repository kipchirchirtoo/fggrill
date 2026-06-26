import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz; // KENYA TIME
import '../models/shift_reconciliation_model.dart';

class AuditTimelineCard extends StatelessWidget {
  final ShiftReconciliationModel shift;

  const AuditTimelineCard({
    super.key,
    required this.shift,
  });

  @override
  Widget build(BuildContext context) {
    final nairobi = tz.getLocation('Africa/Nairobi'); // KENYA TIME
    final df = DateFormat('yyyy-MM-dd HH:mm');

    final List<_TimelineEvent> events = [];

    // Always shift opened
    final openTimeKenya = tz.TZDateTime.from(shift.shiftStart.toLocal(), nairobi); // KENYA TIME
    events.add(_TimelineEvent(
      title: 'Shift Opened',
      subtitle: 'Cashier: ${shift.cashierName}',
      time: df.format(openTimeKenya),
      icon: Icons.lock_open,
      color: Colors.green,
    ));

    // Shift Closed (if closed)
    if (shift.shiftEnd != null) {
      final closeTimeKenya = tz.TZDateTime.from(shift.shiftEnd!.toLocal(), nairobi); // KENYA TIME
      events.add(_TimelineEvent(
        title: 'Shift Closed',
        subtitle: 'Cashier logged out & counted cash drawer',
        time: df.format(closeTimeKenya),
        icon: Icons.lock_outline,
        color: Colors.red,
      ));
    }

    // Reconciliation Submitted
    if (shift.status.toLowerCase() == 'reconciled' || shift.status.toLowerCase() == 'verified') {
      final timeKenya = shift.reconciledAt != null
          ? tz.TZDateTime.from(shift.reconciledAt!.toLocal(), nairobi) // KENYA TIME
          : tz.TZDateTime.from(DateTime.now(), nairobi); // KENYA TIME
      events.add(_TimelineEvent(
        title: 'Reconciliation Submitted',
        subtitle: 'Cashier/Supervisor cleared collections',
        time: df.format(timeKenya),
        icon: Icons.checklist_rtl_rounded,
        color: Colors.blue,
      ));
    }

    // Accountant review completed
    if (shift.status.toLowerCase() == 'verified') {
      final timeKenya = shift.reconciledAt != null
          ? tz.TZDateTime.from(shift.reconciledAt!.toLocal(), nairobi) // KENYA TIME
          : tz.TZDateTime.from(DateTime.now(), nairobi); // KENYA TIME
      events.add(_TimelineEvent(
        title: 'Accountant Review Completed',
        subtitle: 'Approved and closed in accounts',
        time: df.format(timeKenya),
        icon: Icons.verified_user_rounded,
        color: Colors.green,
      ));
    }

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
              'Shift Audit Timeline',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 16),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: events.length,
              itemBuilder: (context, idx) {
                final ev = events[idx];
                final isLast = idx == events.length - 1;

                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: ev.color.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(ev.icon, color: ev.color, size: 16),
                          ),
                          if (!isLast)
                            Expanded(
                              child: Container(
                                width: 2,
                                color: Colors.grey.shade200,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    ev.title,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                                  ),
                                  Text(
                                    ev.time,
                                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                ev.subtitle,
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _TimelineEvent {
  final String title;
  final String subtitle;
  final String time;
  final IconData icon;
  final Color color;

  _TimelineEvent({
    required this.title,
    required this.subtitle,
    required this.time,
    required this.icon,
    required this.color,
  });
}
