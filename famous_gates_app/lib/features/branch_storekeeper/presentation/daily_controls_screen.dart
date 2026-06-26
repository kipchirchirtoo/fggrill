import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../../core/config/app_config.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

class DailyControlsScreen extends ConsumerStatefulWidget {
  const DailyControlsScreen({Key? key, this.initialDate, this.initialShift}) : super(key: key);

  final DateTime? initialDate;
  final String? initialShift;

  @override
  ConsumerState<DailyControlsScreen> createState() => _DailyControlsScreenState();
}

class _DailyControlsScreenState extends ConsumerState<DailyControlsScreen> {
  DateTime _selectedDate = DateTime.now();
  String _selectedShift = 'A';
  bool _isLoading = false;
  List<dynamic> _controls = [];
  Map<String, dynamic> _salesSummary = {};
  int? _kitchenSessionId;
  bool _hasStocktake = false;
  String? _stocktakeStatus;

  final List<String> _shiftOptions = ['A', 'B'];

  @override
  void initState() {
    super.initState();
    if (widget.initialDate != null) {
      _selectedDate = widget.initialDate!;
    }
    if (widget.initialShift != null) {
      _selectedShift = widget.initialShift!;
    }
    if (widget.initialDate == null && widget.initialShift == null) {
      // Default to yesterday if it's early morning shift A
      if (DateTime.now().hour < 10) {
        _selectedDate = DateTime.now().subtract(const Duration(days: 1));
        _selectedShift = 'B';
      }
    }
    _fetchControls();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2023, 6, 19),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
      _fetchControls();
    }
  }

  Future<void> _fetchControls() async {
    setState(() {
      _isLoading = true;
      _controls = [];
      _salesSummary = {};
      _hasStocktake = false;
      _stocktakeStatus = null;
    });

    try {
      final storage = ref.read(secureStorageProvider);
      final token = await storage.read(key: AuthRepository.jwtKey) ?? '';
      final branchId = await storage.read(key: AuthRepository.branchIdKey) ?? '';
      final dateStr = _selectedDate.toIso8601String().split('T')[0];

      final response = await http.get(
        Uri.parse('${AppConfig.mainApiUrl}/kitchen/shift-controls/analyze?branch_id=$branchId&shift_date=$dateStr&shift_type=$_selectedShift'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body)['data'];
        setState(() {
          _controls = data['controls'] ?? [];
          _salesSummary = data['sales_summary'] ?? {};
          _kitchenSessionId = data['kitchen_session_id'];
          _hasStocktake = data['has_stocktake'] ?? false;
          _stocktakeStatus = data['stocktake_status'];
        });
      } else {
        _showError('Failed to load controls: ${json.decode(response.body)['message'] ?? response.statusCode}');
      }
    } catch (e) {
      _showError('Error fetching controls: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  void _openCreditBillDialog(Map<String, dynamic> control) {
    // Only allow billing if there is a shortage (variance > 0)
    if ((control['variance'] ?? 0) <= 0) {
      _showError('Can only bill staff for shortages');
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => _CreditBillDialog(
        control: control,
        date: _selectedDate,
        shiftType: _selectedShift,
        onSuccess: () {
          Navigator.of(ctx).pop();
          _showSuccess('Staff billed successfully. Awaiting Accountant approval.');
          _fetchControls();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateStr = _selectedDate.toIso8601String().split('T')[0];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Daily Kitchen Controls'),
        backgroundColor: Colors.teal[700],
      ),
      body: Column(
        children: [
          // Filter Section
          Container(
            padding: const EdgeInsets.all(16.0),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => _selectDate(context),
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Date',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(dateStr, style: const TextStyle(fontSize: 16)),
                          const Icon(Icons.calendar_today, size: 20),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _selectedShift,
                    decoration: const InputDecoration(
                      labelText: 'Shift',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: _shiftOptions.map((String value) {
                      return DropdownMenuItem<String>(
                        value: value,
                        child: Text('Shift $value'),
                      );
                    }).toList(),
                    onChanged: (newValue) {
                      if (newValue != null) {
                        setState(() {
                          _selectedShift = newValue;
                        });
                        _fetchControls();
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
          
          if (_kitchenSessionId == null && !_isLoading)
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.amber[100],
              width: double.infinity,
              child: const Text(
                'Warning: No Kitchen Session found for this shift. Raw ingredient actual usage may be 0.',
                style: TextStyle(color: Colors.amber),
                textAlign: TextAlign.center,
              ),
            ),

          if (!_hasStocktake && !_isLoading)
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.red[50],
              width: double.infinity,
              child: const Text(
                'Warning: No Kitchen Stocktake found for this shift. Prepared counter controls will not be shown.',
                style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            )
          else if (_stocktakeStatus == 'draft' && !_isLoading)
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.amber[50],
              width: double.infinity,
              child: const Text(
                'Warning: Kitchen Stocktake is in DRAFT. Prepared counter controls may be incomplete.',
                style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ),

          // Content
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _controls.isEmpty
                    ? const Center(child: Text('No controls data found for this shift.'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(8.0),
                        itemCount: _controls.length,
                        itemBuilder: (context, index) {
                          final control = _controls[index];
                          final expected = (control['expected_usage'] ?? 0).toDouble();
                          final actual = (control['actual_usage'] ?? 0).toDouble();
                          final variance = (control['variance'] ?? 0).toDouble();
                          final isShortage = variance > 0;

                          return Card(
                            margin: const EdgeInsets.symmetric(vertical: 6.0, horizontal: 8.0),
                            elevation: 2,
                            child: Padding(
                              padding: const EdgeInsets.all(12.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        control['item_name'] ?? 'Unknown',
                                        style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      if (isShortage)
                                        ElevatedButton.icon(
                                          onPressed: () => _openCreditBillDialog(control),
                                          icon: const Icon(Icons.receipt_long, size: 16),
                                          label: const Text('Bill Staff'),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: Colors.red[50],
                                            foregroundColor: Colors.red[900],
                                            elevation: 0,
                                            padding: const EdgeInsets.symmetric(horizontal: 12),
                                          ),
                                        )
                                      else
                                        Chip(
                                          label: const Text('OK', style: TextStyle(color: Colors.white, fontSize: 12)),
                                          backgroundColor: Colors.green[600],
                                          padding: EdgeInsets.zero,
                                        ),
                                    ],
                                  ),
                                  const Divider(),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                                    children: [
                                      _buildStatColumn('Expected', expected.toStringAsFixed(2), Colors.blue[700]!),
                                      _buildStatColumn('Actual Used', actual.toStringAsFixed(2), Colors.purple[700]!),
                                      _buildStatColumn(
                                        'Variance', 
                                        variance.toStringAsFixed(2), 
                                        isShortage ? Colors.red[700]! : Colors.green[700]!
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatColumn(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: Colors.grey),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }
}

class _CreditBillDialog extends ConsumerStatefulWidget {
  const _CreditBillDialog({
    Key? key,
    required this.control,
    required this.date,
    required this.shiftType,
    required this.onSuccess,
  }) : super(key: key);

  final Map<String, dynamic> control;
  final DateTime date;
  final String shiftType;
  final VoidCallback onSuccess;

  @override
  ConsumerState<_CreditBillDialog> createState() => __CreditBillDialogState();
}

class __CreditBillDialogState extends ConsumerState<_CreditBillDialog> {
  final _amountController = TextEditingController();
  final _reasonController = TextEditingController();
  String? _selectedStaffId;
  List<dynamic> _staffList = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchStaff();
    final variance = widget.control['variance'];
    final itemName = widget.control['item_name'];
    final dateStr = widget.date.toIso8601String().split('T')[0];
    _reasonController.text = 'Shortage of $variance $itemName in Kitchen Shift ${widget.shiftType} on $dateStr';
  }

  Future<void> _fetchStaff() async {
    try {
      final storage = ref.read(secureStorageProvider);
      final token = await storage.read(key: AuthRepository.jwtKey) ?? '';
      final branchId = await storage.read(key: AuthRepository.branchIdKey) ?? '';

      final response = await http.get(
        Uri.parse('${AppConfig.mainApiUrl}/hr/staff?branch_id=$branchId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body)['data'];
        setState(() {
          _staffList = data;
        });
      }
    } catch (e) {
      // ignore
    }
  }

  Future<void> _submitCreditBill() async {
    if (_selectedStaffId == null || _amountController.text.isEmpty || _reasonController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final storage = ref.read(secureStorageProvider);
      final token = await storage.read(key: AuthRepository.jwtKey) ?? '';
      final branchId = await storage.read(key: AuthRepository.branchIdKey) ?? '';

      final response = await http.post(
        Uri.parse('${AppConfig.mainApiUrl}/kitchen/shift-controls/bill-staff'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'branch_id': branchId,
          'shift_date': widget.date.toIso8601String().split('T')[0],
          'shift_type': widget.shiftType,
          'item_name': widget.control['item_name'],
          'variance': widget.control['variance'],
          'staff_id': _selectedStaffId,
          'amount': double.tryParse(_amountController.text) ?? 0,
          'reason': _reasonController.text,
        }),
      );

      if (response.statusCode == 200) {
        widget.onSuccess();
      } else {
        final message = json.decode(response.body)['message'] ?? response.statusCode;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit bill: $message')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final itemName = widget.control['item_name'];
    final variance = widget.control['variance'];

    return AlertDialog(
      title: const Text('Credit Bill Staff'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Item: $itemName'),
            Text('Shortage: $variance', style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: 'Select Staff Member'),
              value: _selectedStaffId,
              items: _staffList.map((staff) {
                final fname = staff['first_name'];
                final lname = staff['last_name'];
                return DropdownMenuItem<String>(
                  value: staff['id'].toString(),
                  child: Text('$fname $lname'),
                );
              }).toList(),
              onChanged: (val) {
                setState(() {
                  _selectedStaffId = val;
                });
              },
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              decoration: const InputDecoration(
                labelText: 'Amount to Deduct (KES)',
                prefixText: 'KES ',
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason',
              ),
              maxLines: 3,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _isLoading ? null : _submitCreditBill,
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red[700], foregroundColor: Colors.white),
          child: _isLoading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Submit Bill'),
        ),
      ],
    );
  }
}
