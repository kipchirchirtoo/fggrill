import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

final _kesFormat = NumberFormat('#,##0.00', 'en_KE');

String formatKes(num value) => 'KES ${_kesFormat.format(value)}';

class KesText extends StatelessWidget {
  const KesText(
    this.amount, {
    super.key,
    this.style,
    this.showSymbol = true,
  });

  final num amount;
  final TextStyle? style;
  final bool showSymbol;

  @override
  Widget build(BuildContext context) {
    return Text(
      showSymbol ? formatKes(amount) : _kesFormat.format(amount),
      style: style,
    );
  }
}
