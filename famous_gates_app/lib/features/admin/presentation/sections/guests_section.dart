import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/safe_avatar.dart';
import '../../data/models/guest.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import '../widgets/admin_dialogs.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

class GuestsSection extends ConsumerStatefulWidget {
  const GuestsSection({super.key});

  @override
  ConsumerState<GuestsSection> createState() => _GuestsSectionState();
}

class _GuestsSectionState extends ConsumerState<GuestsSection> {
  final _searchController = TextEditingController();
  String? _selectedGuestId;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final guestsAsync = ref.watch(adminGuestsProvider);

    return guestsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.table),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminGuestsProvider),
      ),
      data: (guests) {
        final filtered = _searchController.text.isEmpty
            ? guests
            : guests
                .where((g) =>
                    g.name
                        .toLowerCase()
                        .contains(_searchController.text.toLowerCase()) ||
                    g.email
                        .toLowerCase()
                        .contains(_searchController.text.toLowerCase()) ||
                    g.phone.contains(_searchController.text))
                .toList();

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adminGuestsProvider),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Guests',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 20),
                _buildSearchRow(context),
                const SizedBox(height: 20),
                if (filtered.isEmpty)
                  EmptyState(
                      message: 'No guests found', icon: PhosphorIcons.user())
                else
                  _buildGuestTable(filtered),
                const SizedBox(height: 20),
                if (_selectedGuestId != null)
                  _buildGuestDetail(
                    guests.firstWhere((g) => g.id == _selectedGuestId,
                        orElse: () => guests.first),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSearchRow(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search by name, email or phone...',
              prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
        const SizedBox(width: 16),
        ElevatedButton.icon(
          onPressed: () => showGuestDialog(context),
          icon: Icon(PhosphorIcons.plus(), size: 20),
          label: const Text('Add Guest'),
        ),
      ],
    );
  }

  Widget _buildGuestTable(List<AdminGuest> guests) {
    return AdminTable(
      columns: const [
        'Name',
        'Email',
        'Phone',
        'ID Type',
        'ID Number',
        'Visits',
        'Balance',
        ''
      ],
      rows: guests.map<List<Widget>>((g) {
        return [
          GestureDetector(
            onTap: () => setState(() {
              _selectedGuestId = _selectedGuestId == g.id ? null : g.id;
            }),
            child: Text(g.name,
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.kPrimary,
                    decoration: TextDecoration.underline,
                    decorationColor: AppColors.kPrimary)),
          ),
          Text(g.email, style: const TextStyle(fontSize: 13)),
          Text(g.phone),
          Text(g.idType),
          Text(g.idNumber),
          Text('${g.totalVisits}'),
          Text(
            '\$${g.balance.toStringAsFixed(2)}',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: g.balance > 0 ? AppColors.kError : AppColors.kSuccess,
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                onPressed: () => showGuestDialog(context, guest: g),
                tooltip: 'Edit',
              ),
              IconButton(
                icon: Icon(PhosphorIcons.prohibit(),
                    size: 18, color: AppColors.kError),
                onPressed: () => _confirmDelete(context, g),
                tooltip: 'Delete',
              ),
            ],
          ),
        ];
      }).toList(),
      hasActions: true,
    );
  }

  Widget _buildGuestDetail(AdminGuest guest) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SafeAvatar(
                  imageUrl: guest.profilePhoto,
                  name: guest.name,
                  radius: 28,
                  backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                  foregroundColor: AppColors.kPrimary,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(guest.name,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w600)),
                      Text(guest.email,
                          style:
                              const TextStyle(color: AppColors.kTextSecondary)),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(PhosphorIcons.x(), size: 18),
                  onPressed: () => setState(() => _selectedGuestId = null),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 12),
            Row(
              children: [
                _infoChip(PhosphorIcons.phone(), guest.phone),
                const SizedBox(width: 16),
                _infoChip(
                    PhosphorIcons.user(), '${guest.idType}: ${guest.idNumber}'),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _infoChip(PhosphorIcons.bookmark(), guest.nationality),
                const SizedBox(width: 16),
                _infoChip(PhosphorIcons.clock(), '${guest.totalVisits} visits'),
                const SizedBox(width: 16),
                _infoChip(
                  PhosphorIcons.wallet(),
                  '\$${guest.balance.toStringAsFixed(2)} balance',
                  color:
                      guest.balance > 0 ? AppColors.kError : AppColors.kSuccess,
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text('Booking History',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.kSurface,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Booking history will appear here.',
                style: TextStyle(color: AppColors.kTextSecondary),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoChip(IconData icon, String text, {Color? color}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color ?? AppColors.kTextSecondary),
        const SizedBox(width: 4),
        Text(text,
            style: TextStyle(
                fontSize: 13, color: color ?? AppColors.kTextSecondary)),
      ],
    );
  }

  void _confirmDelete(BuildContext context, AdminGuest guest) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Guest'),
        content: Text('Are you sure you want to delete "${guest.name}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(adminRepositoryProvider).deleteUser(guest.id);
              ref.invalidate(adminGuestsProvider);
            },
            child:
                const Text('Delete', style: TextStyle(color: AppColors.kError)),
          ),
        ],
      ),
    );
  }
}
