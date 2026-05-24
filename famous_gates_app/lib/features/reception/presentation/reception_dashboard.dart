import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class ReceptionDashboard extends StatelessWidget {
  const ReceptionDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reception / Front Desk'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: Icon(PhosphorIcons.bell()), onPressed: () {}),
          const SizedBox(width: 16),
        ],
      ),
      body: Row(
        children: [
          _buildSidebar(context),
          Expanded(child: _buildMainContent(context)),
        ],
      ),
    );
  }

  Widget _buildSidebar(BuildContext context) {
    return Container(
      width: 240,
      color: Colors.white,
      decoration: const BoxDecoration(
        border: Border(right: BorderSide(color: AppColors.kDivider)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 16),
          _buildSidebarItem('Bookings', PhosphorIcons.calendar(), true),
          _buildSidebarItem('Check-in', PhosphorIcons.signIn()),
          _buildSidebarItem('Check-out', PhosphorIcons.signOut()),
          _buildSidebarItem('Room Status', PhosphorIcons.bed()),
          _buildSidebarItem('Guests', PhosphorIcons.users()),
          const Spacer(),
          _buildSidebarItem('Settings', PhosphorIcons.gear()),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildSidebarItem(String label, IconData icon, [bool isSelected = false]) {
    return ListTile(
      leading: Icon(icon, color: isSelected ? AppColors.kPrimary : AppColors.kTextSecondary),
      title: Text(label, style: TextStyle(
        color: isSelected ? AppColors.kPrimary : AppColors.kTextPrimary,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 14,
      )),
      selected: isSelected,
      onTap: () {},
    );
  }

  Widget _buildMainContent(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Room Availability', style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.add),
                label: const Text('New Booking'),
                style: ElevatedButton.styleFrom(minimumSize: const Size(160, 48)),
              ),
            ],
          ),
          const SizedBox(height: 32),
          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 6,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
              ),
              itemCount: 30,
              itemBuilder: (context, index) {
                final isOccupied = index % 4 == 0;
                final isDirty = index % 7 == 0;
                return _buildRoomCard(index + 101, isOccupied, isDirty);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoomCard(int roomNo, bool isOccupied, bool isDirty) {
    Color statusColor = isOccupied ? AppColors.kWarning : AppColors.kSuccess;
    if (isDirty) statusColor = AppColors.kError;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: statusColor, width: 2),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('$roomNo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: statusColor)),
          const SizedBox(height: 4),
          Text(isOccupied ? 'Occupied' : (isDirty ? 'Dirty' : 'Available'), style: TextStyle(fontSize: 10, color: statusColor)),
        ],
      ),
    );
  }
}
