import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/repository.dart';

class HousekeepingScreen extends ConsumerStatefulWidget {
  const HousekeepingScreen({super.key});

  @override
  ConsumerState<HousekeepingScreen> createState() => _HousekeepingScreenState();
}

class _HousekeepingScreenState extends ConsumerState<HousekeepingScreen> with SingleTickerProviderStateMixin {
  late final ReceptionRepository _repository;
  late TabController _tabController;

  List<Map<String, dynamic>> _tasks = [];
  List<Map<String, dynamic>> _rooms = [];
  bool _isLoading = false;

  @override
  void initState() {
    _repository = ref.read(receptionRepositoryProvider);
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final tasks = await _repository.getHousekeepingTasks();
      final rooms = await _repository.getHousekeepingRooms();
      setState(() {
        _tasks = tasks;
        _rooms = rooms;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load data: $e')),
        );
      }
    }
  }

  Future<void> _updateTaskStatus(String taskId, String status) async {
    try {
      await _repository.updateHousekeepingTask(taskId, status);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Task updated'), backgroundColor: Colors.green),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update task: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Housekeeping'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Tasks', icon: Icon(Icons.checklist)),
            Tab(text: 'Rooms', icon: Icon(Icons.bed)),
          ],
          indicatorColor: Colors.white,
          labelColor: Colors.white,
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildTasksTab(),
                _buildRoomsTab(),
              ],
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Create new task
        },
        backgroundColor: AppColors.kPrimary,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildTasksTab() {
    final pendingTasks = _tasks.where((t) => t['status'] == 'pending').toList();
    final inProgressTasks = _tasks.where((t) => t['status'] == 'in_progress').toList();
    final completedTasks = _tasks.where((t) => t['status'] == 'completed').toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Summary Cards
          Row(
            children: [
              Expanded(child: _taskSummaryCard('Pending', pendingTasks.length, Colors.orange)),
              const SizedBox(width: 12),
              Expanded(child: _taskSummaryCard('In Progress', inProgressTasks.length, Colors.blue)),
              const SizedBox(width: 12),
              Expanded(child: _taskSummaryCard('Completed', completedTasks.length, Colors.green)),
            ],
          ),
          const SizedBox(height: 16),

          // Pending Tasks
          if (pendingTasks.isNotEmpty) ...[
            const Text('Pending Tasks', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...pendingTasks.map((task) => _TaskCard(
                  task: task,
                  onStatusChange: (status) => _updateTaskStatus(task['id'], status),
                )),
            const SizedBox(height: 16),
          ],

          // In Progress Tasks
          if (inProgressTasks.isNotEmpty) ...[
            const Text('In Progress', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...inProgressTasks.map((task) => _TaskCard(
                  task: task,
                  onStatusChange: (status) => _updateTaskStatus(task['id'], status),
                )),
            const SizedBox(height: 16),
          ],

          // Completed Tasks
          if (completedTasks.isNotEmpty) ...[
            const Text('Completed Today', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...completedTasks.take(5).map((task) => _TaskCard(
                  task: task,
                  onStatusChange: (status) => _updateTaskStatus(task['id'], status),
                )),
          ],
        ],
      ),
    );
  }

  Widget _buildRoomsTab() {
    final dirtyRooms = _rooms.where((r) => r['status'] == 'cleaning' || r['is_clean'] == false).toList();
    final cleanRooms = _rooms.where((r) => r['is_clean'] == true && r['status'] != 'cleaning').toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Summary
          Row(
            children: [
              Expanded(child: _roomSummaryCard('Needs Cleaning', dirtyRooms.length, Colors.red)),
              const SizedBox(width: 12),
              Expanded(child: _roomSummaryCard('Clean', cleanRooms.length, Colors.green)),
            ],
          ),
          const SizedBox(height: 16),

          // Dirty Rooms
          if (dirtyRooms.isNotEmpty) ...[
            const Text('Rooms Needing Attention', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...dirtyRooms.map((room) => _RoomStatusCard(room: room, onRefresh: _loadData)),
            const SizedBox(height: 16),
          ],

          // Clean Rooms
          if (cleanRooms.isNotEmpty) ...[
            const Text('Clean Rooms', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...cleanRooms.map((room) => _RoomStatusCard(room: room, onRefresh: _loadData)),
          ],
        ],
      ),
    );
  }

  Widget _taskSummaryCard(String label, int count, Color color) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color),
            ),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _roomSummaryCard(String label, int count, Color color) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color),
            ),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  final Function(String) onStatusChange;

  const _TaskCard({required this.task, required this.onStatusChange});

  Color _getPriorityColor() {
    switch (task['priority']) {
      case 'high':
        return Colors.red;
      case 'medium':
        return Colors.orange;
      case 'low':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = task['status'] ?? 'pending';
    final isCompleted = status == 'completed';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 4,
          color: _getPriorityColor(),
        ),
        title: Text(
          task['task_type'] ?? task['description'] ?? 'Task',
          style: TextStyle(
            decoration: isCompleted ? TextDecoration.lineThrough : null,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (task['room_number'] != null) Text('Room ${task['room_number']}'),
            if (task['assigned_to_name'] != null) Text('Assigned to: ${task['assigned_to_name']}'),
            if (task['due_date'] != null)
              Text('Due: ${DateFormat('MMM dd, HH:mm').format(DateTime.parse(task['due_date']))}'),
          ],
        ),
        trailing: PopupMenuButton<String>(
          onSelected: onStatusChange,
          itemBuilder: (context) => [
            const PopupMenuItem(value: 'pending', child: Text('Pending')),
            const PopupMenuItem(value: 'in_progress', child: Text('In Progress')),
            const PopupMenuItem(value: 'completed', child: Text('Completed')),
          ],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: isCompleted ? Colors.green : Colors.orange,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              status.toUpperCase(),
              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ),
    );
  }
}

class _RoomStatusCard extends StatelessWidget {
  final Map<String, dynamic> room;
  final VoidCallback onRefresh;

  const _RoomStatusCard({required this.room, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final isClean = room['is_clean'] == true;
    final roomNumber = room['room_number'] ?? room['number'] ?? '-';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(
          isClean ? Icons.check_circle : Icons.cleaning_services,
          color: isClean ? Colors.green : Colors.orange,
        ),
        title: Text('Room $roomNumber'),
        subtitle: Text(room['room_type'] ?? room['type'] ?? ''),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (room['last_cleaned_at'] != null)
              Text(
                'Cleaned ${DateFormat('HH:mm').format(DateTime.parse(room['last_cleaned_at']))}',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isClean ? Colors.green : Colors.red,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                isClean ? 'CLEAN' : 'DIRTY',
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
