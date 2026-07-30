import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/admin_repository.dart';
import '../../data/models/branch.dart';
import '../../data/models/guest.dart';
import '../../data/models/room.dart';
import '../../data/models/supplier.dart';
import '../../data/models/system_user.dart';
import '../../data/models/vehicle.dart';
import '../../domain/admin_providers.dart';

Future<T?> showBranchDialog<T>(BuildContext context, {AdminBranch? branch}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _BranchDialog(branch: branch),
  );
}

Future<T?> showUserDialog<T>(BuildContext context,
    {AdminUser? user, bool isStaffMode = false}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _UserDialog(user: user, isStaffMode: isStaffMode),
  );
}

Future<T?> showRoomDialog<T>(BuildContext context, {AdminRoom? room}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _RoomDialog(room: room),
  );
}

Future<T?> showRoomStandardDialog<T>(BuildContext context, {AdminRoomType? type}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _RoomStandardDialog(type: type),
  );
}

Future<T?> showRatePlanDialog<T>(BuildContext context, {AdminRatePlan? plan}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _RatePlanDialog(plan: plan),
  );
}

Future<T?> showGuestDialog<T>(BuildContext context, {AdminGuest? guest}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _GuestDialog(guest: guest),
  );
}

Future<T?> showSupplierDialog<T>(BuildContext context,
    {AdminSupplier? supplier}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _SupplierDialog(supplier: supplier),
  );
}

Future<T?> showVehicleDialog<T>(BuildContext context, {AdminVehicle? vehicle}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _VehicleDialog(vehicle: vehicle),
  );
}

Future<bool?> showConfirmDialog(
    BuildContext context, String title, String message) {
  return showDialog<bool>(
    context: context,
    builder: (_) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Text(title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      content: Text(message,
          style: const TextStyle(color: AppColors.kTextSecondary)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel',
              style: TextStyle(color: AppColors.kTextSecondary)),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(context, true),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.kError,
            minimumSize: const Size(100, 40),
          ),
          child: const Text('Confirm'),
        ),
      ],
    ),
  );
}

class _DialogFormWrapper extends StatelessWidget {
  final String title;
  final GlobalKey<FormState> formKey;
  final bool isLoading;
  final VoidCallback onSubmit;
  final Widget content;

  const _DialogFormWrapper({
    required this.title,
    required this.formKey,
    required this.isLoading,
    required this.onSubmit,
    required this.content,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Row(
        children: [
          Expanded(
              child: Text(title,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.bold))),
          GestureDetector(
            onTap: isLoading ? null : () => Navigator.pop(context),
            child: Icon(PhosphorIcons.x(),
                size: 20, color: AppColors.kTextSecondary),
          ),
        ],
      ),
      content: SizedBox(
        width: 480,
        child: Form(
          key: formKey,
          child: SingleChildScrollView(child: content),
        ),
      ),
      actions: [
        TextButton(
          onPressed: isLoading ? null : () => Navigator.pop(context),
          child: const Text('Cancel',
              style: TextStyle(color: AppColors.kTextSecondary)),
        ),
        ElevatedButton(
          onPressed: isLoading ? null : onSubmit,
          child: isLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Text('Save'),
        ),
      ],
    );
  }
}

class _BranchDialog extends ConsumerStatefulWidget {
  final AdminBranch? branch;
  const _BranchDialog({this.branch});

  @override
  ConsumerState<_BranchDialog> createState() => _BranchDialogState();
}

class _BranchDialogState extends ConsumerState<_BranchDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _codeCtrl;
  late final TextEditingController _addressCtrl;
  late final TextEditingController _cityCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _emailCtrl;
  String _status = 'active';

  @override
  void initState() {
    super.initState();
    final b = widget.branch;
    _nameCtrl = TextEditingController(text: b?.name ?? '');
    _codeCtrl = TextEditingController(text: b?.code ?? '');
    _addressCtrl = TextEditingController(text: b?.address ?? '');
    _cityCtrl = TextEditingController(text: b?.city ?? '');
    _phoneCtrl = TextEditingController(text: b?.phone ?? '');
    _emailCtrl = TextEditingController(text: b?.email ?? '');
    _status = b?.status ?? 'active';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'code': _codeCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'city': _cityCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'status': _status,
      };
      final repo = ref.read(adminRepositoryProvider);
      if (widget.branch != null) {
        await repo.updateBranch(widget.branch!.id, data);
      } else {
        await repo.createBranch(data);
      }
      ref.invalidate(adminBranchesProvider);
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text(
                  widget.branch != null ? 'Branch updated' : 'Branch created'),
              backgroundColor: AppColors.kSuccess,
            ));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Error: $e'),
              backgroundColor: AppColors.kError,
            ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _DialogFormWrapper(
      title: widget.branch != null ? 'Edit Branch' : 'Add Branch',
      formKey: _formKey,
      isLoading: _isLoading,
      onSubmit: _submit,
      content: Column(
        children: [
          TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Branch Name'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null),
          const SizedBox(height: 16),
          TextFormField(
              controller: _codeCtrl,
              decoration: const InputDecoration(labelText: 'Branch Code'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null),
          const SizedBox(height: 16),
          TextFormField(
              controller: _addressCtrl,
              decoration: const InputDecoration(labelText: 'Address'),
              maxLines: 2),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _cityCtrl,
                      decoration: const InputDecoration(labelText: 'City'))),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _phoneCtrl,
                      decoration: const InputDecoration(labelText: 'Phone'))),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _emailCtrl,
                      decoration: const InputDecoration(labelText: 'Email'),
                      keyboardType: TextInputType.emailAddress)),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _status,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: ['active', 'inactive']
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setState(() => _status = v ?? 'active'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _UserDialog extends ConsumerStatefulWidget {
  final AdminUser? user;
  final bool isStaffMode;
  const _UserDialog({this.user, this.isStaffMode = false});

  @override
  ConsumerState<_UserDialog> createState() => _UserDialogState();
}

class _UserDialogState extends ConsumerState<_UserDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _posPinCtrl;
  late final TextEditingController _nationalIdCtrl;
  late final TextEditingController _departmentCtrl;
  String _selectedBranchId = '';
  String _selectedRole = '';
  bool _isActive = true;

  static const _roleGroups = [
    (
      'Management',
      ['super_admin', 'director', 'general_manager', 'hr_manager', 'auditor']
    ),
    ('Branch', ['branch_manager', 'assistant_manager', 'duty_manager']),
    (
      'Front Office',
      ['receptionist', 'front_desk_supervisor', 'concierge', 'bellboy']
    ),
    (
      'Finance',
      [
        'finance_manager',
        'accountant',
        'cashier',
        'restaurant_cashier',
        'main_bar_cashier',
        'executive_bar_cashier',
        'non_consumables_cashier',
        'auditor'
      ]
    ),
    (
      'Housekeeping',
      [
        'housekeeping_manager',
        'housekeeper',
        'laundry_attendant',
        'public_area_cleaner'
      ]
    ),
    (
      'Kitchen',
      [
        'kitchen_manager',
        'head_chef',
        'sous_chef',
        'line_cook',
        'kitchen_staff',
        'pastry_chef',
        'kitchen_operations',
        'choma_zone_kds'
      ]
    ),
    (
      'Restaurant',
      [
        'restaurant_manager',
        'waiter',
        'host',
        'bartender',
        'bar_manager',
        'bar_staff'
      ]
    ),
    ('Storekeeping', ['central_storekeeper', 'storekeeper', 'store_assistant']),
    (
      'Maintenance',
      ['maintenance_manager', 'technician', 'electrician', 'plumber']
    ),
    ('Security', ['security_manager', 'security_guard']),
    ('IT', ['it_manager', 'system_admin', 'support_technician']),
    ('Other', ['staff', 'intern']),
  ];

  @override
  void initState() {
    super.initState();
    final u = widget.user;
    _nameCtrl = TextEditingController(text: u?.name ?? '');
    _emailCtrl = TextEditingController(text: u?.email ?? '');
    _phoneCtrl = TextEditingController(text: u?.phone ?? '');
    _posPinCtrl = TextEditingController(text: u?.posPin ?? '');
    _nationalIdCtrl = TextEditingController(text: '');
    _departmentCtrl = TextEditingController(text: u?.department ?? '');
    _selectedBranchId = u?.branchId ?? '';
    _selectedRole = u?.role ?? '';
    _isActive = u?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _posPinCtrl.dispose();
    _nationalIdCtrl.dispose();
    _departmentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final repo = ref.read(adminRepositoryProvider);
      if (widget.isStaffMode) {
        final nameParts =
            _nameCtrl.text.trim().split(RegExp(r'\s+'));
        final data = {
          'first_name': nameParts.first,
          'last_name':
              nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '',
          'email': _emailCtrl.text.trim(),
          'phone': _phoneCtrl.text.trim(),
          'branch_id': _selectedBranchId,
          'role': _selectedRole,
          'status': _isActive ? 'active' : 'inactive',
          'pos_pin': _posPinCtrl.text.trim(),
          if (_nationalIdCtrl.text.trim().isNotEmpty)
            'national_id': _nationalIdCtrl.text.trim(),
          if (_departmentCtrl.text.trim().isNotEmpty)
            'department': _departmentCtrl.text.trim(),
        };
        if (widget.user != null) {
          await repo.updateStaff(widget.user!.id, data);
        } else {
          await repo.createStaff(data);
        }
        ref.invalidate(adminStaffProvider);
      } else {
        final data = {
          'name': _nameCtrl.text.trim(),
          'email': _emailCtrl.text.trim(),
          'phone': _phoneCtrl.text.trim(),
          'branch_id': _selectedBranchId,
          'role': _selectedRole,
          'is_active': _isActive,
          'pos_pin': _posPinCtrl.text.trim(),
        };
        if (widget.user != null) {
          await repo.updateUser(widget.user!.id, data);
        } else {
          await repo.createUser(data);
        }
        ref.invalidate(adminUsersProvider);
      }
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content:
                  Text(widget.user != null ? 'User updated' : 'User created'),
              backgroundColor: AppColors.kSuccess,
            ));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Error: $e'),
              backgroundColor: AppColors.kError,
            ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(adminBranchesProvider);
    return _DialogFormWrapper(
      title: widget.isStaffMode
          ? (widget.user != null ? 'Edit Staff' : 'Add Staff')
          : (widget.user != null ? 'Edit User' : 'Add User'),
      formKey: _formKey,
      isLoading: _isLoading,
      onSubmit: _submit,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Full Name'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null),
          const SizedBox(height: 16),
          TextFormField(
              controller: _emailCtrl,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _phoneCtrl,
                      decoration: const InputDecoration(labelText: 'Phone'))),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _posPinCtrl,
                      decoration: const InputDecoration(labelText: 'POS PIN'),
                      obscureText: true)),
            ],
          ),
          if (widget.isStaffMode) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _nationalIdCtrl,
                    decoration: const InputDecoration(
                      labelText: 'National ID / ID Number',
                      hintText: 'e.g. 12345678',
                    ),
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _departmentCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Department',
                      hintText: 'e.g. restaurant, kitchen',
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          branchesAsync.when(
            data: (branches) => DropdownButtonFormField<String>(
              initialValue:
                  _selectedBranchId.isEmpty ? null : _selectedBranchId,
              decoration: const InputDecoration(labelText: 'Branch'),
              items: [
                const DropdownMenuItem(value: '', child: Text('Select Branch')),
                ...branches.map(
                    (b) => DropdownMenuItem(value: b.id, child: Text(b.name))),
              ],
              onChanged: (v) => setState(() => _selectedBranchId = v ?? ''),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            loading: () => DropdownButtonFormField<String>(
                items: const [],
                onChanged: null,
                decoration: const InputDecoration(labelText: 'Branch')),
            error: (_, __) => const Text('Failed to load branches',
                style: TextStyle(color: AppColors.kError)),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _selectedRole.isEmpty ? null : _selectedRole,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Role'),
            items: [
              for (final group in _roleGroups)
                ...group.$2.map((r) => DropdownMenuItem(
                    value: r,
                    child: Text(
                      '${group.$1} — $r',
                      overflow: TextOverflow.ellipsis,
                    ))),
            ],
            onChanged: (v) => setState(() => _selectedRole = v ?? ''),
            validator: (v) => v == null || v.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            title: const Text('Active'),
            value: _isActive,
            onChanged: (v) => setState(() => _isActive = v),
            contentPadding: EdgeInsets.zero,
          ),
        ],
      ),
    );
  }
}

class _RoomDialog extends ConsumerStatefulWidget {
  final AdminRoom? room;
  const _RoomDialog({this.room});

  @override
  ConsumerState<_RoomDialog> createState() => _RoomDialogState();
}

class _RoomDialogState extends ConsumerState<_RoomDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late final TextEditingController _roomNumberCtrl;
  late final TextEditingController _floorCtrl;
  late final TextEditingController _priceCtrl;
  late final TextEditingController _capacityCtrl;
  late final TextEditingController _descriptionCtrl;
  String _type = 'Standard';
  bool _isSmoking = false;
  final Set<String> _selectedAmenities = {};

  static const _roomTypes = [
    'Standard',
    'Deluxe',
    'Suite',
    'Penthouse',
    'Villa'
  ];
  static const _allAmenities = [
    'WiFi',
    'AC',
    'TV',
    'MiniBar',
    'Safe',
    'Bathtub',
    'View'
  ];

  @override
  void initState() {
    super.initState();
    final r = widget.room;
    _roomNumberCtrl = TextEditingController(text: r?.roomNumber ?? '');
    _floorCtrl = TextEditingController(text: r?.floor.toString() ?? '');
    _priceCtrl = TextEditingController(text: r?.price.toString() ?? '');
    _capacityCtrl = TextEditingController(text: r?.capacity.toString() ?? '');
    _descriptionCtrl = TextEditingController(text: r?.description ?? '');
    _type = r?.type.isNotEmpty == true ? r!.type : 'Standard';
    _isSmoking = r?.isSmoking ?? false;
    if (r != null) _selectedAmenities.addAll(r.amenities);
  }

  @override
  void dispose() {
    _roomNumberCtrl.dispose();
    _floorCtrl.dispose();
    _priceCtrl.dispose();
    _capacityCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final data = {
        'room_number': _roomNumberCtrl.text.trim(),
        'type': _type,
        'floor': int.tryParse(_floorCtrl.text) ?? 0,
        'price': double.tryParse(_priceCtrl.text) ?? 0,
        'capacity': int.tryParse(_capacityCtrl.text) ?? 2,
        'description': _descriptionCtrl.text.trim(),
        'is_smoking': _isSmoking,
        'amenities': _selectedAmenities.toList(),
      };
      final repo = ref.read(adminRepositoryProvider);
      if (widget.room != null) {
        await repo.updateRoom(widget.room!.id, data);
      } else {
        await repo.createRoom(data);
      }
      ref.invalidate(adminRoomsProvider);
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content:
                  Text(widget.room != null ? 'Room updated' : 'Room created'),
              backgroundColor: AppColors.kSuccess,
            ));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Error: $e'),
              backgroundColor: AppColors.kError,
            ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _DialogFormWrapper(
      title: widget.room != null ? 'Edit Room' : 'Add Room',
      formKey: _formKey,
      isLoading: _isLoading,
      onSubmit: _submit,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _roomNumberCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Room Number'),
                      validator: (v) =>
                          v == null || v.trim().isEmpty ? 'Required' : null)),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _floorCtrl,
                      decoration: const InputDecoration(labelText: 'Floor'),
                      keyboardType: TextInputType.number)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _type,
                  decoration: const InputDecoration(labelText: 'Type'),
                  items: _roomTypes
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) => setState(() => _type = v ?? 'Standard'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _priceCtrl,
                      decoration: const InputDecoration(labelText: 'Price'),
                      keyboardType: TextInputType.number,
                      validator: (v) =>
                          v == null || v.trim().isEmpty ? 'Required' : null)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _capacityCtrl,
                      decoration: const InputDecoration(labelText: 'Capacity'),
                      keyboardType: TextInputType.number)),
              const SizedBox(width: 12),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Smoking', style: TextStyle(fontSize: 14)),
                  Switch(
                      value: _isSmoking,
                      onChanged: (v) => setState(() => _isSmoking = v)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
              controller: _descriptionCtrl,
              decoration: const InputDecoration(labelText: 'Description'),
              maxLines: 2),
          const SizedBox(height: 16),
          const Text('Amenities',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _allAmenities.map((amenity) {
              final selected = _selectedAmenities.contains(amenity);
              return FilterChip(
                label: Text(amenity,
                    style: TextStyle(
                        fontSize: 12,
                        color:
                            selected ? Colors.white : AppColors.kTextPrimary)),
                selected: selected,
                selectedColor: AppColors.kPrimary,
                checkmarkColor: Colors.white,
                onSelected: (v) {
                  setState(() {
                    if (v) {
                      _selectedAmenities.add(amenity);
                    } else {
                      _selectedAmenities.remove(amenity);
                    }
                  });
                },
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _GuestDialog extends ConsumerStatefulWidget {
  final AdminGuest? guest;
  const _GuestDialog({this.guest});

  @override
  ConsumerState<_GuestDialog> createState() => _GuestDialogState();
}

class _GuestDialogState extends ConsumerState<_GuestDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _idNumberCtrl;
  late final TextEditingController _addressCtrl;
  late final TextEditingController _nationalityCtrl;
  String _idType = 'NationalID';

  static const _idTypes = ['NationalID', 'Passport', 'DriversLicense'];

  @override
  void initState() {
    super.initState();
    final g = widget.guest;
    _nameCtrl = TextEditingController(text: g?.name ?? '');
    _emailCtrl = TextEditingController(text: g?.email ?? '');
    _phoneCtrl = TextEditingController(text: g?.phone ?? '');
    _idNumberCtrl = TextEditingController(text: g?.idNumber ?? '');
    _addressCtrl = TextEditingController(text: g?.address ?? '');
    _nationalityCtrl = TextEditingController(text: g?.nationality ?? '');
    _idType = g?.idType.isNotEmpty == true ? g!.idType : 'NationalID';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _idNumberCtrl.dispose();
    _addressCtrl.dispose();
    _nationalityCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'id_type': _idType,
        'id_number': _idNumberCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'nationality': _nationalityCtrl.text.trim(),
      };
      final repo = ref.read(adminRepositoryProvider);
      if (widget.guest != null) {
        await repo.updateGuest(widget.guest!.id, data);
      } else {
        await repo.createGuest(data);
      }
      ref.invalidate(adminGuestsProvider);
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text(
                  widget.guest != null ? 'Guest updated' : 'Guest created'),
              backgroundColor: AppColors.kSuccess,
            ));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Error: $e'),
              backgroundColor: AppColors.kError,
            ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _DialogFormWrapper(
      title: widget.guest != null ? 'Edit Guest' : 'Add Guest',
      formKey: _formKey,
      isLoading: _isLoading,
      onSubmit: _submit,
      content: Column(
        children: [
          TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Full Name'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _emailCtrl,
                      decoration: const InputDecoration(labelText: 'Email'),
                      keyboardType: TextInputType.emailAddress)),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _phoneCtrl,
                      decoration: const InputDecoration(labelText: 'Phone'))),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _idType,
                  decoration: const InputDecoration(labelText: 'ID Type'),
                  items: _idTypes
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) => setState(() => _idType = v ?? 'NationalID'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _idNumberCtrl,
                      decoration:
                          const InputDecoration(labelText: 'ID Number'))),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
              controller: _addressCtrl,
              decoration: const InputDecoration(labelText: 'Address'),
              maxLines: 2),
          const SizedBox(height: 16),
          TextFormField(
              controller: _nationalityCtrl,
              decoration: const InputDecoration(labelText: 'Nationality')),
        ],
      ),
    );
  }
}

class _SupplierDialog extends ConsumerStatefulWidget {
  final AdminSupplier? supplier;
  const _SupplierDialog({this.supplier});

  @override
  ConsumerState<_SupplierDialog> createState() => _SupplierDialogState();
}

class _SupplierDialogState extends ConsumerState<_SupplierDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _contactPersonCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _addressCtrl;
  late final TextEditingController _paymentTermsCtrl;
  late final TextEditingController _bankNameCtrl;
  late final TextEditingController _bankAccountCtrl;
  late final TextEditingController _bankCodeCtrl;

  @override
  void initState() {
    super.initState();
    final s = widget.supplier;
    _nameCtrl = TextEditingController(text: s?.name ?? '');
    _contactPersonCtrl = TextEditingController(text: s?.contactPerson ?? '');
    _phoneCtrl = TextEditingController(text: s?.phone ?? '');
    _emailCtrl = TextEditingController(text: s?.email ?? '');
    _addressCtrl = TextEditingController(text: s?.address ?? '');
    _paymentTermsCtrl = TextEditingController(text: s?.paymentTerms ?? '');
    _bankNameCtrl = TextEditingController(text: s?.bankName ?? '');
    _bankAccountCtrl = TextEditingController(text: s?.bankAccount ?? '');
    _bankCodeCtrl = TextEditingController(text: s?.bankCode ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _contactPersonCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _paymentTermsCtrl.dispose();
    _bankNameCtrl.dispose();
    _bankAccountCtrl.dispose();
    _bankCodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'contact_person': _contactPersonCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'payment_terms': _paymentTermsCtrl.text.trim(),
        'bank_name': _bankNameCtrl.text.trim(),
        'bank_account': _bankAccountCtrl.text.trim(),
        'bank_code': _bankCodeCtrl.text.trim(),
      };
      final repo = ref.read(adminRepositoryProvider);
      if (widget.supplier != null) {
        await repo.updateSupplier(widget.supplier!.id, data);
      } else {
        await repo.createSupplier(data);
      }
      ref.invalidate(adminSuppliersProvider);
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text(widget.supplier != null
                  ? 'Supplier updated'
                  : 'Supplier created'),
              backgroundColor: AppColors.kSuccess,
            ));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Error: $e'),
              backgroundColor: AppColors.kError,
            ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _DialogFormWrapper(
      title: widget.supplier != null ? 'Edit Supplier' : 'Add Supplier',
      formKey: _formKey,
      isLoading: _isLoading,
      onSubmit: _submit,
      content: Column(
        children: [
          TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Supplier Name'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _contactPersonCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Contact Person'))),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _phoneCtrl,
                      decoration: const InputDecoration(labelText: 'Phone'))),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _emailCtrl,
                      decoration: const InputDecoration(labelText: 'Email'),
                      keyboardType: TextInputType.emailAddress)),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _paymentTermsCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Payment Terms'))),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
              controller: _addressCtrl,
              decoration: const InputDecoration(labelText: 'Address'),
              maxLines: 2),
          const SizedBox(height: 16),
          const Text('Bank Details',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                  child: TextFormField(
                      controller: _bankNameCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Bank Name'))),
              const SizedBox(width: 12),
              Expanded(
                  child: TextFormField(
                      controller: _bankCodeCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Bank Code'))),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
              controller: _bankAccountCtrl,
              decoration: const InputDecoration(labelText: 'Bank Account')),
        ],
      ),
    );
  }
}

class _VehicleDialog extends ConsumerStatefulWidget {
  final AdminVehicle? vehicle;
  const _VehicleDialog({this.vehicle});

  @override
  ConsumerState<_VehicleDialog> createState() => _VehicleDialogState();
}

class _VehicleDialogState extends ConsumerState<_VehicleDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late final TextEditingController _registrationCtrl;
  late final TextEditingController _makeCtrl;
  late final TextEditingController _modelCtrl;
  late final TextEditingController _colorCtrl;
  late final TextEditingController _driverNameCtrl;
  late final TextEditingController _driverPhoneCtrl;
  late final TextEditingController _insuranceProviderCtrl;
  DateTime? _insuranceExpiry;
  DateTime? _lastService;
  DateTime? _nextService;

  @override
  void initState() {
    super.initState();
    final v = widget.vehicle;
    _registrationCtrl = TextEditingController(text: v?.registration ?? '');
    _makeCtrl = TextEditingController(text: v?.make ?? '');
    _modelCtrl = TextEditingController(text: v?.model ?? '');
    _colorCtrl = TextEditingController(text: v?.color ?? '');
    _driverNameCtrl = TextEditingController(text: v?.driverName ?? '');
    _driverPhoneCtrl = TextEditingController(text: v?.driverPhone ?? '');
    _insuranceProviderCtrl =
        TextEditingController(text: v?.insuranceProvider ?? '');
    _insuranceExpiry = v?.insuranceExpiry;
    _lastService = v?.lastService;
    _nextService = v?.nextService;
  }

  @override
  void dispose() {
    _registrationCtrl.dispose();
    _makeCtrl.dispose();
    _modelCtrl.dispose();
    _colorCtrl.dispose();
    _driverNameCtrl.dispose();
    _driverPhoneCtrl.dispose();
    _insuranceProviderCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(StateSetter setDialogState, DateTime? current,
      Function(DateTime) onPicked) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2040),
    );
    if (picked != null) {
      setDialogState(() => onPicked(picked));
    }
  }

  String _formatDate(DateTime? dt) {
    if (dt == null) return 'Select date';
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final data = {
        'registration': _registrationCtrl.text.trim(),
        'make': _makeCtrl.text.trim(),
        'model': _modelCtrl.text.trim(),
        'color': _colorCtrl.text.trim(),
        'driver_name': _driverNameCtrl.text.trim(),
        'driver_phone': _driverPhoneCtrl.text.trim(),
        'insurance_provider': _insuranceProviderCtrl.text.trim(),
        'insurance_expiry': _insuranceExpiry?.toIso8601String(),
        'last_service': _lastService?.toIso8601String(),
        'next_service': _nextService?.toIso8601String(),
      };
      final repo = ref.read(adminRepositoryProvider);
      if (widget.vehicle != null) {
        await repo.updateVehicle(widget.vehicle!.id, data);
      } else {
        await repo.createVehicle(data);
      }
      ref.invalidate(adminVehiclesProvider);
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text(widget.vehicle != null
                  ? 'Vehicle updated'
                  : 'Vehicle created'),
              backgroundColor: AppColors.kSuccess,
            ));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Error: $e'),
              backgroundColor: AppColors.kError,
            ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _DialogFormWrapper(
      title: widget.vehicle != null ? 'Edit Vehicle' : 'Add Vehicle',
      formKey: _formKey,
      isLoading: _isLoading,
      onSubmit: _submit,
      content: StatefulBuilder(
        builder: (context, setDialogState) => Column(
          children: [
            TextFormField(
                controller: _registrationCtrl,
                decoration: const InputDecoration(labelText: 'Registration'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                    child: TextFormField(
                        controller: _makeCtrl,
                        decoration: const InputDecoration(labelText: 'Make'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextFormField(
                        controller: _modelCtrl,
                        decoration: const InputDecoration(labelText: 'Model'))),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                    child: TextFormField(
                        controller: _colorCtrl,
                        decoration: const InputDecoration(labelText: 'Color'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextFormField(
                        controller: _insuranceProviderCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Insurance Provider'))),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                    child: TextFormField(
                        controller: _driverNameCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Driver Name'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextFormField(
                        controller: _driverPhoneCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Driver Phone'))),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => _pickDate(setDialogState, _insuranceExpiry,
                        (d) => _insuranceExpiry = d),
                    child: InputDecorator(
                      decoration:
                          const InputDecoration(labelText: 'Insurance Expiry'),
                      child: Text(_formatDate(_insuranceExpiry),
                          style: TextStyle(
                              color: _insuranceExpiry == null
                                  ? AppColors.kTextSecondary
                                  : AppColors.kTextPrimary)),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => _pickDate(
                        setDialogState, _lastService, (d) => _lastService = d),
                    child: InputDecorator(
                      decoration:
                          const InputDecoration(labelText: 'Last Service'),
                      child: Text(_formatDate(_lastService),
                          style: TextStyle(
                              color: _lastService == null
                                  ? AppColors.kTextSecondary
                                  : AppColors.kTextPrimary)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: () => _pickDate(
                        setDialogState, _nextService, (d) => _nextService = d),
                    child: InputDecorator(
                      decoration:
                          const InputDecoration(labelText: 'Next Service'),
                      child: Text(_formatDate(_nextService),
                          style: TextStyle(
                              color: _nextService == null
                                  ? AppColors.kTextSecondary
                                  : AppColors.kTextPrimary)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
class _RoomStandardDialog extends ConsumerStatefulWidget {
  final AdminRoomType? type;
  const _RoomStandardDialog({this.type});

  @override
  ConsumerState<_RoomStandardDialog> createState() => _RoomStandardDialogState();
}

class _RoomStandardDialogState extends ConsumerState<_RoomStandardDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _basePriceCtrl;
  late final TextEditingController _capacityCtrl;
  late final TextEditingController _descriptionCtrl;
  bool _isActive = true;

  @override
  void initState() {
    super.initState();
    final t = widget.type;
    _nameCtrl = TextEditingController(text: t?.name ?? '');
    _basePriceCtrl = TextEditingController(text: t?.basePrice.toString() ?? '');
    _capacityCtrl = TextEditingController(text: t?.capacity.toString() ?? '2');
    _descriptionCtrl = TextEditingController(text: t?.description ?? '');
    _isActive = t?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _basePriceCtrl.dispose();
    _capacityCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'base_price': double.tryParse(_basePriceCtrl.text) ?? 0,
        'capacity': int.tryParse(_capacityCtrl.text) ?? 2,
        'description': _descriptionCtrl.text.trim(),
        'is_active': _isActive,
      };
      final repo = ref.read(adminRepositoryProvider);
      if (widget.type != null) {
        await repo.updateRoomType(widget.type!.id, data);
      } else {
        await repo.createRoomType(data);
      }
      ref.invalidate(adminRoomTypesProvider);
      if (mounted) {
        AppNotifier.showSnackBar(context, const SnackBar(content: Text('Standard saved'), backgroundColor: AppColors.kSuccess));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.kError));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _DialogFormWrapper(
      title: widget.type != null ? 'Edit Standard' : 'Add Standard',
      formKey: _formKey,
      isLoading: _isLoading,
      onSubmit: _submit,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextFormField(
            controller: _nameCtrl,
            decoration: const InputDecoration(labelText: 'Standard Name (e.g., Deluxe)'),
            validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _basePriceCtrl,
                  decoration: const InputDecoration(labelText: 'Base Price (KES)'),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: _capacityCtrl,
                  decoration: const InputDecoration(labelText: 'Capacity (Pax)'),
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _descriptionCtrl,
            decoration: const InputDecoration(labelText: 'Description'),
            maxLines: 2,
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            title: const Text('Is Active'),
            value: _isActive,
            onChanged: (v) => setState(() => _isActive = v),
            contentPadding: EdgeInsets.zero,
          ),
        ],
      ),
    );
  }
}

class _RatePlanDialog extends ConsumerStatefulWidget {
  final AdminRatePlan? plan;
  const _RatePlanDialog({this.plan});

  @override
  ConsumerState<_RatePlanDialog> createState() => _RatePlanDialogState();
}

class _RatePlanDialogState extends ConsumerState<_RatePlanDialog> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _multiplierCtrl;
  late final TextEditingController _fixedAmountCtrl;
  late final TextEditingController _minNightsCtrl;
  late final TextEditingController _descriptionCtrl;
  String _rateType = 'FIXED';
  bool _active = true;

  @override
  void initState() {
    super.initState();
    final p = widget.plan;
    _nameCtrl = TextEditingController(text: p?.name ?? '');
    _multiplierCtrl = TextEditingController(text: p?.multiplier.toString() ?? '1.0');
    _fixedAmountCtrl = TextEditingController(text: p?.fixedAmount.toString() ?? '0');
    _minNightsCtrl = TextEditingController(text: p?.minNights.toString() ?? '1');
    _descriptionCtrl = TextEditingController(text: p?.description ?? '');
    _rateType = p?.rateType ?? 'FIXED';
    _active = p?.active ?? true;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _multiplierCtrl.dispose();
    _fixedAmountCtrl.dispose();
    _minNightsCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'rate_type': _rateType,
        'multiplier': double.tryParse(_multiplierCtrl.text) ?? 1.0,
        'fixed_amount': double.tryParse(_fixedAmountCtrl.text) ?? 0,
        'min_nights': int.tryParse(_minNightsCtrl.text) ?? 1,
        'description': _descriptionCtrl.text.trim(),
        'active': _active,
      };
      final repo = ref.read(adminRepositoryProvider);
      if (widget.plan != null) {
        await repo.updateRatePlan(widget.plan!.id, data);
      } else {
        await repo.createRatePlan(data);
      }
      ref.invalidate(adminRatePlansProvider);
      if (mounted) {
        AppNotifier.showSnackBar(context, const SnackBar(content: Text('Rate Plan saved'), backgroundColor: AppColors.kSuccess));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.kError));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _DialogFormWrapper(
      title: widget.plan != null ? 'Edit Rate Plan' : 'Add Rate Plan',
      formKey: _formKey,
      isLoading: _isLoading,
      onSubmit: _submit,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextFormField(
            controller: _nameCtrl,
            decoration: const InputDecoration(labelText: 'Plan Name (e.g., Bed & Breakfast)'),
            validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            isExpanded: true,
            initialValue: _rateType,
            decoration: const InputDecoration(labelText: 'Rate Calculation Type'),
            items: const [
              DropdownMenuItem(value: 'FIXED', child: Text('Fixed Price Addition')),
              DropdownMenuItem(value: 'PERCENTAGE', child: Text('Percentage Multiplier')),
            ],
            onChanged: (v) => setState(() => _rateType = v ?? 'FIXED'),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              if (_rateType == 'PERCENTAGE')
                Expanded(
                  child: TextFormField(
                    controller: _multiplierCtrl,
                    decoration: const InputDecoration(labelText: 'Multiplier (e.g., 1.2)'),
                    keyboardType: TextInputType.number,
                  ),
                ),
              if (_rateType == 'FIXED')
                Expanded(
                  child: TextFormField(
                    controller: _fixedAmountCtrl,
                    decoration: const InputDecoration(labelText: 'Fixed Amount (KES)'),
                    keyboardType: TextInputType.number,
                  ),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: _minNightsCtrl,
                  decoration: const InputDecoration(labelText: 'Minimum Nights'),
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _descriptionCtrl,
            decoration: const InputDecoration(labelText: 'Description'),
            maxLines: 2,
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            title: const Text('Is Active'),
            value: _active,
            onChanged: (v) => setState(() => _active = v),
            contentPadding: EdgeInsets.zero,
          ),
        ],
      ),
    );
  }
}
