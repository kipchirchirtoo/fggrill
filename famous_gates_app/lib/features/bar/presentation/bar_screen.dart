import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/widgets/dashboard_shell.dart';
import 'pos_tab.dart';
import 'orders_tab.dart';
import 'tabs_tab.dart';
import 'inventory_tab.dart';
import 'morning_count_tab.dart';

class BarPOSScreen extends ConsumerStatefulWidget {
  const BarPOSScreen({super.key});

  @override
  ConsumerState<BarPOSScreen> createState() => _BarPOSScreenState();
}

class _BarPOSScreenState extends ConsumerState<BarPOSScreen> {
  int _currentTab = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      DashboardTab(
          label: 'POS', icon: PhosphorIcons.wine(), content: const BarPOSTab()),
      DashboardTab(
          label: 'Orders',
          icon: PhosphorIcons.listBullets(),
          content: const BarOrdersTab()),
      DashboardTab(
          label: 'Tabs',
          icon: PhosphorIcons.bookmark(),
          content: const BarTabsTab()),
      DashboardTab(
          label: 'Inventory',
          icon: PhosphorIcons.cube(),
          content: const BarInventoryTab()),
      DashboardTab(
          label: 'Morning Count',
          icon: PhosphorIcons.sun(),
          content: const MorningCountTab()),
    ];

    return DashboardShell(
      title: 'Bar POS',
      tabs: tabs,
      currentTab: _currentTab,
      onTabChanged: (i) => setState(() => _currentTab = i),
    );
  }
}
