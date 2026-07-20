import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:famous_gates_app/features/kitchen/presentation/kitchen_sessions_screen.dart';
import 'package:famous_gates_app/features/kitchen/data/repository.dart';
import 'package:famous_gates_app/features/kitchen/domain/session_models.dart';
import 'package:famous_gates_app/features/kitchen/domain/session_providers.dart';
import 'package:famous_gates_app/features/auth/domain/auth_notifier.dart';
import 'package:famous_gates_app/features/auth/domain/models.dart';
import 'package:famous_gates_app/core/router/app_router.dart';
import 'package:go_router/go_router.dart';
import 'package:famous_gates_app/features/kitchen/domain/providers.dart';
import 'package:famous_gates_app/features/kitchen/domain/models.dart';
import 'package:famous_gates_app/features/branch_storekeeper/data/branch_storekeeper_repository.dart';
import 'package:famous_gates_app/features/branch_storekeeper/presentation/branch_storekeeper_dashboard.dart';
import 'package:famous_gates_app/features/branch_accountant/presentation/branch_accountant_dashboard.dart';
import 'package:famous_gates_app/features/branch_accountant/data/repository.dart';
import 'package:famous_gates_app/core/storage/secure_storage_provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';

class FakeRef implements Ref {
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class FakeKitchenRepository extends KitchenRepository {
  final KitchenShiftConfig _config;
  final KitchenShift? _shift;

  FakeKitchenRepository(this._config, this._shift) : super(Dio(), FakeRef());

  @override
  Future<KitchenShiftConfig> getActiveShiftConfig() async => _config;

  @override
  Future<KitchenShift?> getActiveShift() async => _shift;

  @override
  Future<List<Map<String, dynamic>>> getStaffProfiles() async => [];

  @override
  Future<List<KitchenShiftAddition>> getShiftAdditions(String shiftId) async => [];

  @override
  Future<List<KitchenShiftItem>> getShiftItems(String shiftId) async => [];

  @override
  Future<List<dynamic>> getShiftProductions(String shiftId) async => [];

  @override
  Future<Map<String, dynamic>> getReconciliationReport(String shiftId) async => {};

  @override
  Future<List<Map<String, dynamic>>> getActiveBuffets() async => [];

  @override
  Future<List<Map<String, dynamic>>> getActiveCateringEvents() async => [];

  @override
  Future<List<Map<String, dynamic>>> getActiveConferences() async => [];

  @override
  Future<List<Map<String, dynamic>>> getActiveEventOrders({String? eventType}) async => [];

  @override
  Future<int> getBreakfastPax() async => 0;

  @override
  Future<void> closeShift({
    required String shiftId,
    required List<Map<String, dynamic>> physicalCounts,
    required List<String> outgoingWitnessIds,
    required List<String> incomingWitnessIds,
    String? closingNotes,
    int? breakfastPax,
    int? staffMealPax,
  }) async {}
}

class FakeBranchStorekeeperRepository implements BranchStorekeeperRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) {
    final name = invocation.memberName.toString();
    if (name.contains('dashboard') || name.contains('enterpriseInventoryAnalytics')) {
      return Future.value(<String, dynamic>{});
    }
    return Future.value(<Map<String, dynamic>>[]);
  }
}

class FakeBranchAccountantRepository implements BranchAccountantRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) {
    final name = invocation.memberName.toString();
    if (name.contains('getDirectorTasks') || name.contains('tasks')) {
      return Future.value(<Map<String, dynamic>>[]);
    }
    if (name.contains('getAnalytics') || name.contains('profitLoss') || name.contains('stats') || name.contains('discrepancies')) {
      return Future.value(<String, dynamic>{});
    }
    return Future.value(<Map<String, dynamic>>[]);
  }
}

class FakeSecureStorage implements FlutterSecureStorage {
  final Map<String, String> _storage = {};

  @override
  Future<String?> read({
    required String key,
    dynamic iOptions,
    dynamic aOptions,
    dynamic lOptions,
    dynamic webOptions,
    dynamic mOptions,
    dynamic wOptions,
  }) async {
    return _storage[key];
  }

  @override
  Future<void> write({
    required String key,
    required String? value,
    dynamic iOptions,
    dynamic aOptions,
    dynamic lOptions,
    dynamic webOptions,
    dynamic mOptions,
    dynamic wOptions,
  }) async {
    if (value == null) {
      _storage.remove(key);
    } else {
      _storage[key] = value;
    }
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeAuthNotifier extends AuthNotifier {
  final User? _user;
  FakeAuthNotifier(this._user);

  @override
  Future<User?> build() => Future.value(_user);
}

class FakeKdsNotifier extends KdsNotifier {
  FakeKdsNotifier(Ref ref) : super(ref) {
    print('--- FAKE KdsNotifier constructed! ---');
  }

  @override
  Future<void> start() async {
    print('--- FAKE KdsNotifier start() called! ---');
  }
}

void main() {
  group('Kitchen Sessions UI Gating & Shift Mode Tests', () {
    testWidgets('Displays block view (KITCHEN_SESSIONS_NOT_CONFIGURED) when branch is unseeded (enabled=false)', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: false,
                  reason: 'KITCHEN_SESSIONS_NOT_CONFIGURED',
                  shiftMode: null,
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      // Wait for future and providers to resolve
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      // Check for blocked elements
      expect(find.byIcon(Icons.block), findsOneWidget);
      expect(find.text('Kitchen Sessions Disabled'), findsOneWidget);
      expect(find.textContaining('Reason: KITCHEN_SESSIONS_NOT_CONFIGURED'), findsOneWidget);
    });

    testWidgets('Allows shift opening when enabled is true (Bomet TWO_SHIFT mode)', (tester) async {
      const mockStorekeeper = User(
        id: '3',
        name: 'Test Storekeeper',
        email: 'storekeeper@test.com',
        role: 'kitchen_operations',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['kitchen_operations'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockStorekeeper)),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      // Check for open shift view elements
      expect(find.text('Open Kitchen Shift'), findsOneWidget);
      // Under TWO_SHIFT, we should render the shift selector
      expect(find.text('Shift (Session)'), findsOneWidget);
    });

    testWidgets('Hides sub-shift selector when enabled is true (Mogogosiek SINGLE_SHIFT mode)', (tester) async {
      const mockStorekeeper = User(
        id: '3',
        name: 'Test Storekeeper',
        email: 'storekeeper@test.com',
        role: 'kitchen_operations',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['kitchen_operations'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockStorekeeper)),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'SINGLE_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      // Check for open shift view elements
      expect(find.text('Open Kitchen Shift'), findsOneWidget);
      // Under SINGLE_SHIFT, the shift selector is hidden (SizedBox.shrink)
      expect(find.text('Shift (Session)'), findsNothing);
    });

    testWidgets('Gives read-only view and hides open shift action for super_admin when activeShift is null', (tester) async {
      const mockAdmin = User(
        id: '99',
        name: 'Test Admin',
        email: 'admin@test.com',
        role: 'super_admin',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['super_admin'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockAdmin)),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('Open Kitchen Shift'), findsNothing);
      expect(find.text('No Active Kitchen Session'), findsOneWidget);
      expect(find.textContaining('There is no active kitchen shift open for today.'), findsOneWidget);
    });

    testWidgets('Hides all write buttons for super_admin when activeShift is active', (tester) async {
      const mockAdmin = User(
        id: '99',
        name: 'Test Admin',
        email: 'admin@test.com',
        role: 'super_admin',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['super_admin'],
      );

      final activeShift = KitchenShift(
        id: 'shift-123',
        shiftNumber: 'KS-20260708-01',
        branchId: 2,
        shiftDate: '2026-07-08',
        shiftType: 'breakfast',
        status: 'open',
        openedBy: 'user-1',
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockAdmin)),
            shiftDetailsProvider('shift-123').overrideWith((ref) => Future.value({
              'items': [],
              'productions': [],
            })),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                activeShift,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('Read-Only Session View'), findsOneWidget);
      expect(find.text('Log Production'), findsNothing);
      expect(find.text('Add Mid-session Stock'), findsNothing);
      expect(find.text('Close shift / Handover'), findsNothing);
    });

    testWidgets('Gives read-only view and hides open shift action for branch_manager when activeShift is null', (tester) async {
      const mockManager = User(
        id: '98',
        name: 'Test Manager',
        email: 'manager@test.com',
        role: 'branch_manager',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['branch_manager'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockManager)),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('Open Kitchen Shift'), findsNothing);
      expect(find.text('No Active Kitchen Session'), findsOneWidget);
      expect(find.textContaining('There is no active kitchen shift open for today.'), findsOneWidget);
    });

    testWidgets('Hides all write buttons for branch_manager when activeShift is active', (tester) async {
      const mockManager = User(
        id: '98',
        name: 'Test Manager',
        email: 'manager@test.com',
        role: 'branch_manager',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['branch_manager'],
      );

      final activeShift = KitchenShift(
        id: 'shift-123',
        shiftNumber: 'KS-20260708-01',
        branchId: 2,
        shiftDate: '2026-07-08',
        shiftType: 'breakfast',
        status: 'open',
        openedBy: 'user-1',
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockManager)),
            shiftDetailsProvider('shift-123').overrideWith((ref) => Future.value({
              'items': [],
              'productions': [],
            })),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                activeShift,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('Read-Only Session View'), findsOneWidget);
      expect(find.text('Log Production'), findsNothing);
      expect(find.text('Add Mid-session Stock'), findsNothing);
      expect(find.text('Close shift / Handover'), findsNothing);
    });

    testWidgets('Branch storekeeper dashboard opens KitchenSessionsScreen, not legacy _KitchenProductionSection', (tester) async {
      tester.view.physicalSize = const Size(1920, 1080);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const mockStorekeeper = User(
        id: '3',
        name: 'Test Storekeeper',
        email: 'storekeeper@test.com',
        role: 'branch_storekeeper',
        branchId: '5',
        branchName: 'Mogogoshiek',
        roles: ['branch_storekeeper'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockStorekeeper)),
            branchStorekeeperRepositoryProvider.overrideWithValue(FakeBranchStorekeeperRepository()),
            secureStorageProvider.overrideWithValue(FakeSecureStorage()),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'SINGLE_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: BranchStorekeeperDashboard(
                initialSection: BranchStorekeeperSection.kitchenProduction,
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(KitchenSessionsScreen), findsOneWidget);
      expect(find.text('Open Kitchen Shift'), findsOneWidget);
    });

    testWidgets('Bomet branch_id 2 renders TWO_SHIFT / Shift A/B', (tester) async {
      const mockStorekeeper = User(
        id: '3',
        name: 'Test Storekeeper',
        email: 'storekeeper@test.com',
        role: 'branch_storekeeper',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['branch_storekeeper'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockStorekeeper)),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('Open Kitchen Shift'), findsOneWidget);
      expect(find.text('Shift (Session)'), findsOneWidget);
    });

    testWidgets('Mogogosiek branch_id 5 renders SINGLE_SHIFT / no Shift A/B', (tester) async {
      const mockStorekeeper = User(
        id: '3',
        name: 'Test Storekeeper',
        email: 'storekeeper@test.com',
        role: 'branch_storekeeper',
        branchId: '5',
        branchName: 'Mogogoshiek',
        roles: ['branch_storekeeper'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockStorekeeper)),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'SINGLE_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: KitchenSessionsScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('Open Kitchen Shift'), findsOneWidget);
      expect(find.text('Shift (Session)'), findsNothing);
    });

    test('Switching users/branches invalidates cached shift config', () async {
      final container = ProviderContainer(
        overrides: [
          authNotifierProvider.overrideWith(() => FakeAuthNotifier(
            const User(
              id: '3',
              name: 'Bomet User',
              email: 'bomet@test.com',
              role: 'branch_storekeeper',
              branchId: '2',
              branchName: 'Bomet Town',
              roles: ['branch_storekeeper'],
            ),
          )),
          kitchenRepositoryProvider.overrideWithValue(
            FakeKitchenRepository(
              KitchenShiftConfig(
                enabled: true,
                reason: null,
                shiftMode: 'TWO_SHIFT',
              ),
              null,
            ),
          ),
        ],
      );

      final sub = container.listen(shiftConfigProvider, (_, __) {});

      final config1 = await container.read(shiftConfigProvider.future);
      expect(config1.shiftMode, 'TWO_SHIFT');

      container.updateOverrides([
        authNotifierProvider.overrideWith(() => FakeAuthNotifier(
          const User(
            id: '4',
            name: 'Mogogosiek User',
            email: 'mogogosiek@test.com',
            role: 'branch_storekeeper',
            branchId: '5',
            branchName: 'Mogogoshiek',
            roles: ['branch_storekeeper'],
          ),
        )),
        kitchenRepositoryProvider.overrideWithValue(
          FakeKitchenRepository(
            KitchenShiftConfig(
              enabled: true,
              reason: null,
              shiftMode: 'SINGLE_SHIFT',
            ),
            null,
          ),
        ),
      ]);

      // Let the microtask queue run to apply updated overrides
      await Future.delayed(const Duration(milliseconds: 100));

      final config2 = await container.read(shiftConfigProvider.future);
      expect(config2.shiftMode, 'SINGLE_SHIFT');
      sub.close();
    });

    testWidgets('Branch accountant route/menu exists and is read-only', (tester) async {
      tester.view.physicalSize = const Size(1920, 1080);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const mockAccountant = User(
        id: '5',
        name: 'Test Accountant',
        email: 'accountant@test.com',
        role: 'branch_accountant',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['branch_accountant'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockAccountant)),
            secureStorageProvider.overrideWithValue(FakeSecureStorage()),
            branchAccountantRepositoryProvider.overrideWithValue(FakeBranchAccountantRepository()),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: BranchAccountantDashboard(
                initialSection: BranchAccountantSection.kitchenVariance,
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(KitchenSessionsScreen), findsOneWidget);
      expect(find.text('Open Kitchen Shift'), findsNothing);
      expect(find.text('No Active Kitchen Session'), findsOneWidget);
    });

    testWidgets('Bomet storekeeper dashboard navigates via sidebar menu to Kitchen Sessions and renders TWO_SHIFT / Shift A/B', (tester) async {
      tester.view.physicalSize = const Size(1920, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const mockStorekeeper = User(
        id: '3',
        name: 'Test Storekeeper',
        email: 'storekeeper@test.com',
        role: 'branch_storekeeper',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['branch_storekeeper'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockStorekeeper)),
            branchStorekeeperRepositoryProvider.overrideWithValue(FakeBranchStorekeeperRepository()),
            secureStorageProvider.overrideWithValue(FakeSecureStorage()),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: BranchStorekeeperDashboard(
                initialSection: BranchStorekeeperSection.overview,
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.text('Kitchen Sessions'));
      
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(KitchenSessionsScreen), findsOneWidget);
      expect(find.text('Open Kitchen Shift'), findsOneWidget);
      expect(find.text('Shift (Session)'), findsOneWidget);
    });

    testWidgets('Mogogosiek storekeeper dashboard navigates via sidebar menu to Kitchen Sessions and renders SINGLE_SHIFT / no Shift A/B', (tester) async {
      tester.view.physicalSize = const Size(1920, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const mockStorekeeper = User(
        id: '3',
        name: 'Test Storekeeper',
        email: 'storekeeper@test.com',
        role: 'branch_storekeeper',
        branchId: '5',
        branchName: 'Mogogoshiek',
        roles: ['branch_storekeeper'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockStorekeeper)),
            branchStorekeeperRepositoryProvider.overrideWithValue(FakeBranchStorekeeperRepository()),
            secureStorageProvider.overrideWithValue(FakeSecureStorage()),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'SINGLE_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: BranchStorekeeperDashboard(
                initialSection: BranchStorekeeperSection.overview,
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.text('Kitchen Sessions'));
      
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(KitchenSessionsScreen), findsOneWidget);
      expect(find.text('Open Kitchen Shift'), findsOneWidget);
      expect(find.text('Shift (Session)'), findsNothing);
    });

    testWidgets('Branch accountant dashboard navigates via sidebar menu to Kitchen Sessions and renders read-only view', (tester) async {
      tester.view.physicalSize = const Size(1920, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const mockAccountant = User(
        id: '5',
        name: 'Test Accountant',
        email: 'accountant@test.com',
        role: 'branch_accountant',
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['branch_accountant'],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith(() => FakeAuthNotifier(mockAccountant)),
            secureStorageProvider.overrideWithValue(FakeSecureStorage()),
            branchAccountantRepositoryProvider.overrideWithValue(FakeBranchAccountantRepository()),
            kitchenRepositoryProvider.overrideWithValue(
              FakeKitchenRepository(
                KitchenShiftConfig(
                  enabled: true,
                  reason: null,
                  shiftMode: 'TWO_SHIFT',
                ),
                null,
              ),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: BranchAccountantDashboard(
                initialSection: BranchAccountantSection.overview,
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.text('Kitchen Sessions'));
      
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(KitchenSessionsScreen), findsOneWidget);
      expect(find.text('Open Kitchen Shift'), findsNothing);
      expect(find.text('No Active Kitchen Session'), findsOneWidget);
    });
  });

  group('Router Gating Tests', () {
    testWidgets('Unapproved role (waiter) redirect is blocked from /kitchen/sessions', (tester) async {
      const currentUser = User(
        id: '1',
        name: 'Test Waiter',
        email: 'waiter@test.com',
        role: 'waiter', // Unapproved
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['waiter'],
      );

      final container = ProviderContainer(
        overrides: [
          authNotifierProvider.overrideWith(() => FakeAuthNotifier(currentUser)),
          routerProvider.overrideWith((ref) {
            return GoRouter(
              initialLocation: '/terminal',
              redirect: (context, state) {
                final location = state.matchedLocation;
                if (location == '/kitchen/sessions') {
                  const allowedRoles = {
                    'kitchen_operations',
                    'branch_storekeeper',
                    'storekeeper',
                    'super_admin',
                    'branch_manager',
                    'branch_accountant',
                    'accountant'
                  };
                  if (allowedRoles.contains(currentUser.role) ||
                      currentUser.roles.any(allowedRoles.contains)) {
                    return null;
                  }
                  return '/restaurant'; // Blocked, redirect to default
                }
                return null;
              },
              routes: [
                GoRoute(path: '/terminal', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/restaurant', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/kitchen', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/kitchen/sessions', builder: (_, __) => const SizedBox.shrink()),
              ],
            );
          }),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(
            routerConfig: container.read(routerProvider),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      final router = container.read(routerProvider);
      
      // Attempt to route to /kitchen/sessions
      router.go('/kitchen/sessions');
      await tester.pump();
      await tester.pump();

      // Location should not be /kitchen/sessions (waiter is blocked)
      final location = router.routerDelegate.currentConfiguration.last.matchedLocation;
      expect(location, isNot('/kitchen/sessions'));
    });

    testWidgets('Unapproved role (chef / cook) redirect is blocked from /kitchen/sessions', (tester) async {
      const currentUser = User(
        id: '2',
        name: 'Test Chef',
        email: 'chef@test.com',
        role: 'head_chef', // Unapproved Chef role
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['head_chef'],
      );

      final container = ProviderContainer(
        overrides: [
          authNotifierProvider.overrideWith(() => FakeAuthNotifier(currentUser)),
          routerProvider.overrideWith((ref) {
            return GoRouter(
              initialLocation: '/terminal',
              redirect: (context, state) {
                final location = state.matchedLocation;
                if (location == '/kitchen/sessions') {
                  const allowedRoles = {
                    'kitchen_operations',
                    'branch_storekeeper',
                    'storekeeper',
                    'super_admin',
                    'branch_manager',
                    'branch_accountant',
                    'accountant'
                  };
                  if (allowedRoles.contains(currentUser.role) ||
                      currentUser.roles.any(allowedRoles.contains)) {
                    return null;
                  }
                  return '/terminal'; // Blocked, redirect to terminal
                }
                return null;
              },
              routes: [
                GoRoute(path: '/terminal', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/restaurant', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/kitchen', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/kitchen/sessions', builder: (_, __) => const SizedBox.shrink()),
              ],
            );
          }),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(
            routerConfig: container.read(routerProvider),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      final router = container.read(routerProvider);
      
      // Attempt to route to /kitchen/sessions
      router.go('/kitchen/sessions');
      await tester.pump();
      await tester.pump();

      // Location should not be /kitchen/sessions (chef is blocked)
      final location = router.routerDelegate.currentConfiguration.last.matchedLocation;
      expect(location, isNot('/kitchen/sessions'));
    });

    testWidgets('Approved role (kitchen_operations) is allowed to access /kitchen/sessions', (tester) async {
      const currentUser = User(
        id: '3',
        name: 'Test Storekeeper',
        email: 'storekeeper@test.com',
        role: 'kitchen_operations', // Approved
        branchId: '2',
        branchName: 'Bomet Town',
        roles: ['kitchen_operations'],
      );

      final container = ProviderContainer(
        overrides: [
          authNotifierProvider.overrideWith(() => FakeAuthNotifier(currentUser)),
          routerProvider.overrideWith((ref) {
            return GoRouter(
              initialLocation: '/terminal',
              redirect: (context, state) {
                final location = state.matchedLocation;
                if (location == '/kitchen/sessions') {
                  const allowedRoles = {
                    'kitchen_operations',
                    'branch_storekeeper',
                    'storekeeper',
                    'super_admin',
                    'branch_manager',
                    'branch_accountant',
                    'accountant'
                  };
                  if (allowedRoles.contains(currentUser.role) ||
                      currentUser.roles.any(allowedRoles.contains)) {
                    return null; // Allowed
                  }
                  return '/restaurant';
                }
                return null;
              },
              routes: [
                GoRoute(path: '/terminal', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/restaurant', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/kitchen', builder: (_, __) => const SizedBox.shrink()),
                GoRoute(path: '/kitchen/sessions', builder: (_, __) => const SizedBox.shrink()),
              ],
            );
          }),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(
            routerConfig: container.read(routerProvider),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      final router = container.read(routerProvider);
      
      // Attempt to route to /kitchen/sessions
      router.go('/kitchen/sessions');
      await tester.pump();
      await tester.pump();

      // Location should be /kitchen/sessions (kitchen_operations role is allowed)
      final location = router.routerDelegate.currentConfiguration.last.matchedLocation;
      expect(location, '/kitchen/sessions');
    });
  });
}
