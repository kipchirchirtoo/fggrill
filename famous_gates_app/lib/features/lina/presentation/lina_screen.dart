import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../domain/lina_providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../../../core/utils/api_error_message.dart';

// ── Lina accent colors (used sparingly on white bg) ───────────────────────────
const _kLinaAccent = Color(0xFF6C63FF); // electric purple
const _kLinaTeal = Color(0xFF00C4A0); // teal
const _kLinaCard = Colors.white;
const _kLinaBorder = Color(0xFFE8E8F0);

// ── Tab labels ────────────────────────────────────────────────────────────────
final _tabs = [
  ('Executive', PhosphorIcons.buildings()),
  ('Chat', PhosphorIcons.chatCircle()),
  ('Monitoring', PhosphorIcons.activity()),
  ('Audit', PhosphorIcons.shieldWarning()),
  ('Financial', PhosphorIcons.currencyDollar()),
  ('Employee', PhosphorIcons.users()),
  ('Recommendations', PhosphorIcons.brain()),
  ('Timeline', PhosphorIcons.clockCounterClockwise()),
  ('Fix Center', PhosphorIcons.wrench()),
];

// ═════════════════════════════════════════════════════════════════════════════
class LinaScreen extends ConsumerStatefulWidget {
  const LinaScreen({super.key});
  @override
  ConsumerState<LinaScreen> createState() => _LinaScreenState();
}

class _LinaScreenState extends ConsumerState<LinaScreen>
    with TickerProviderStateMixin {
  late TabController _tabCtrl;
  late AnimationController _pulse;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
    _pulse = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1000))
      ..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.5, end: 1.0)
        .animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader(),
        _buildTabBar(),
        Expanded(
          child: TabBarView(
            controller: _tabCtrl,
            physics: const NeverScrollableScrollPhysics(),
            children: const [
              _ExecutiveTab(),
              _ChatTab(),
              _MonitoringTab(),
              _AuditTab(),
              _FinancialTab(),
              _EmployeeTab(),
              _RecommendationsTab(),
              _TimelineTab(),
              _FixCenterTab(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        children: [
          // Lina logo pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_kLinaAccent, Color(0xFF8B5CF6)],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIcons.sparkle(), size: 16, color: Colors.white),
                const SizedBox(width: 6),
                const Text('LINA',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        letterSpacing: 1.5)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text('Ai Service',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey.shade600)),
          const SizedBox(width: 16),
          // LIVE badge
          AnimatedBuilder(
            animation: _pulseAnim,
            builder: (_, __) => Opacity(
              opacity: _pulseAnim.value,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.kSuccess.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: AppColors.kSuccess.withValues(alpha: 0.4)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                          color: AppColors.kSuccess, shape: BoxShape.circle)),
                  const SizedBox(width: 5),
                  const Text('LIVE',
                      style: TextStyle(
                          color: AppColors.kSuccess,
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Model badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _kLinaAccent.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _kLinaAccent.withValues(alpha: 0.25)),
            ),
            child: const Text('GROQ · GEMINI',
                style: TextStyle(
                    color: _kLinaAccent,
                    fontSize: 11,
                    fontWeight: FontWeight.w600)),
          ),
          const Spacer(),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('Central Intelligence System',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade700)),
            Text('Famous Gates Hotels',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
          ]),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: Colors.white,
      child: TabBar(
        controller: _tabCtrl,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        labelColor: _kLinaAccent,
        unselectedLabelColor: Colors.grey.shade500,
        indicatorColor: _kLinaAccent,
        indicatorWeight: 2.5,
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        unselectedLabelStyle:
            const TextStyle(fontSize: 13, fontWeight: FontWeight.w400),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        tabs: _tabs
            .map((t) => Tab(
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(t.$2, size: 15),
                    const SizedBox(width: 6),
                    Text(t.$1),
                  ]),
                ))
            .toList(),
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────
Widget _card({required Widget child, EdgeInsets? padding, Color? border}) {
  return Container(
    padding: padding ?? const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: _kLinaCard,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: border ?? _kLinaBorder),
      boxShadow: [
        BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2))
      ],
    ),
    child: child,
  );
}

Widget _kpiCard(String label, String value, IconData icon, Color color) {
  return Expanded(
    child: _card(
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value,
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.kTextPrimary)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.kTextSecondary)),
        ])),
      ]),
    ),
  );
}

Widget _sectionHeader(String title, {String? subtitle, Widget? action}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Row(children: [
      Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.kTextPrimary)),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(subtitle,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.kTextSecondary)),
        ],
      ])),
      if (action != null) action,
    ]),
  );
}

Widget _severityBadge(String severity) {
  final colors = {
    'CRITICAL': const Color(0xFFDC2626),
    'HIGH': const Color(0xFFEA580C),
    'MEDIUM': const Color(0xFFD97706),
    'LOW': const Color(0xFF16A34A),
  };
  final c = colors[severity.toUpperCase()] ?? Colors.grey;
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6)),
    child: Text(severity.toUpperCase(),
        style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w700)),
  );
}

Widget _loadingCard() => _card(
        child: const SizedBox(
      height: 120,
      child: Center(
          child:
              CircularProgressIndicator(color: _kLinaAccent, strokeWidth: 2)),
    ));

Widget _errorCard(Object error, VoidCallback retry) {
  final msg = apiErrorMessage(error);
  return _card(
      child: Column(children: [
    Icon(PhosphorIcons.warning(), color: AppColors.kError, size: 28),
    const SizedBox(height: 8),
    Text('Failed to load',
        style: const TextStyle(
            fontWeight: FontWeight.w600, color: AppColors.kTextPrimary)),
    const SizedBox(height: 4),
    Text(msg,
        style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
        textAlign: TextAlign.center,
        maxLines: 3,
        overflow: TextOverflow.ellipsis),
    const SizedBox(height: 12),
    OutlinedButton.icon(
      onPressed: retry,
      icon: Icon(PhosphorIcons.clockClockwise(), size: 14),
      label: const Text('Retry'),
      style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
    ),
  ]));
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Executive Tab
// ═════════════════════════════════════════════════════════════════════════════
class _ExecutiveTab extends ConsumerWidget {
  const _ExecutiveTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctxAsync = ref.watch(linaContextProvider);
    final summaryAsync = ref.watch(linaExecutiveSummaryProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Executive Briefing',
            subtitle: 'AI-generated summary of live system state',
            action: OutlinedButton.icon(
              onPressed: () {
                ref.invalidate(linaContextProvider);
                ref.invalidate(linaExecutiveSummaryProvider);
              },
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Refresh'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),

        // KPI row from context
        ctxAsync.when(
          data: (ctx) => _buildKpiRow(ctx),
          loading: () => const SizedBox(
              height: 96,
              child: Center(
                  child: CircularProgressIndicator(
                      color: _kLinaAccent, strokeWidth: 2))),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaContextProvider)),
        ),

        const SizedBox(height: 20),

        // AI summary
        summaryAsync.when(
          data: (data) => _card(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(PhosphorIcons.sparkle(), size: 18, color: _kLinaAccent),
                const SizedBox(width: 8),
                const Text('Lina Executive Briefing',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.kTextPrimary)),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _kLinaAccent.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('Gemini 1.5 Pro',
                      style: TextStyle(
                          color: _kLinaAccent,
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ),
              ]),
              const Divider(height: 24),
              Text(data['summary'] ?? 'No summary available',
                  style: const TextStyle(
                      fontSize: 13.5,
                      height: 1.7,
                      color: AppColors.kTextPrimary)),
              const SizedBox(height: 8),
              Text('Generated: ${data['generated_at'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.kTextSecondary)),
            ]),
          ),
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaExecutiveSummaryProvider)),
        ),
      ]),
    );
  }

  Widget _buildKpiRow(Map<String, dynamic> ctx) {
    final rev = ctx['revenue'] as Map<String, dynamic>? ?? {};
    final branches = ctx['branches'] as Map<String, dynamic>? ?? {};
    final anomalies = ctx['anomalies'] as Map<String, dynamic>? ?? {};
    final staff = ctx['staff_today'] as Map<String, dynamic>? ?? {};
    final revenue24h = (rev['total_24h'] as num?)?.toDouble() ?? 0;
    return Row(children: [
      _kpiCard('Active Branches', '${branches['active'] ?? 0}',
          PhosphorIcons.buildings(), AppColors.kPrimary),
      const SizedBox(width: 12),
      _kpiCard('Revenue 24h', 'KES ${(revenue24h / 1000).toStringAsFixed(1)}K',
          PhosphorIcons.currencyDollar(), _kLinaTeal),
      const SizedBox(width: 12),
      _kpiCard('Critical Alerts', '${anomalies['critical_count'] ?? 0}',
          PhosphorIcons.warning(), AppColors.kError),
      const SizedBox(width: 12),
      _kpiCard('Staff Present', '${staff['present'] ?? 0}',
          PhosphorIcons.users(), AppColors.kSuccess),
    ]);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Chat Tab
// ═════════════════════════════════════════════════════════════════════════════
class _ChatTab extends ConsumerStatefulWidget {
  const _ChatTab();
  @override
  ConsumerState<_ChatTab> createState() => _ChatTabState();
}

class _ChatTabState extends ConsumerState<_ChatTab> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  bool _loading = false;

  static const _suggestions = [
    'Revenue performance today?',
    'Which branch needs attention?',
    'Show staff anomalies',
    'Financial discrepancies this week?',
    'Security alerts summary',
  ];

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final msg = _controller.text.trim();
    if (msg.isEmpty || _loading) return;
    _controller.clear();

    final notifier = ref.read(chatProvider.notifier);
    notifier.addUserMessage(msg);
    notifier.startAssistantMessage();
    setState(() => _loading = true);
    _scrollBottom();

    try {
      final history = ref
          .read(chatProvider)
          .where((m) => !m.isStreaming)
          .map((m) => {'role': m.role, 'content': m.content})
          .toList();

      final repo = ref.read(linaRepositoryProvider);
      await for (final delta
          in repo.chatStream(msg, history.cast<Map<String, String>>())) {
        notifier.appendToLastAssistant(delta);
        _scrollBottom();
      }
      notifier.finishAssistantMessage();
    } catch (e) {
      notifier.appendToLastAssistant('\n\n⚠️ Error: ${e.toString()}');
      notifier.finishAssistantMessage();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scrollBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(chatProvider);

    return Column(children: [
      // Messages area
      Expanded(
        child: messages.isEmpty
            ? _buildEmptyState()
            : ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(20),
                itemCount: messages.length,
                itemBuilder: (_, i) => _buildMessage(messages[i]),
              ),
      ),

      // Input bar
      _buildInputBar(),
    ]);
  }

  Widget _buildEmptyState() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const SizedBox(height: 40),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: _kLinaAccent.withValues(alpha: 0.08),
            shape: BoxShape.circle,
          ),
          child: Icon(PhosphorIcons.sparkle(), size: 40, color: _kLinaAccent),
        ),
        const SizedBox(height: 20),
        const Text('Ask Lina anything',
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppColors.kTextPrimary)),
        const SizedBox(height: 8),
        const Text(
            'Lina has live access to all Famous Gates data — staff, revenue, branches, anomalies.',
            style: TextStyle(fontSize: 13, color: AppColors.kTextSecondary),
            textAlign: TextAlign.center),
        const SizedBox(height: 32),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          alignment: WrapAlignment.center,
          children: _suggestions
              .map((s) => ActionChip(
                    label: Text(s, style: const TextStyle(fontSize: 12)),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: _kLinaBorder),
                    onPressed: () {
                      _controller.text = s;
                      _send();
                    },
                  ))
              .toList(),
        ),
      ]),
    );
  }

  Widget _buildMessage(ChatMessage msg) {
    final isUser = msg.role == 'user';
    return Padding(
      padding: EdgeInsets.only(
        bottom: 16,
        left: isUser ? 64 : 0,
        right: isUser ? 0 : 64,
      ),
      child: Column(
        crossAxisAlignment:
            isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          // Role label
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(isUser ? 'You' : 'Lina',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isUser ? AppColors.kTextSecondary : _kLinaAccent)),
          ),
          // Bubble
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isUser ? _kLinaAccent : Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isUser ? 16 : 4),
                bottomRight: Radius.circular(isUser ? 4 : 16),
              ),
              border: isUser ? null : Border.all(color: _kLinaBorder),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 6,
                    offset: const Offset(0, 2))
              ],
            ),
            child: msg.isStreaming && msg.content.isEmpty
                ? _TypingIndicator()
                : Text(
                    msg.content,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.6,
                      color: isUser ? Colors.white : AppColors.kTextPrimary,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(children: [
        // Clear
        IconButton(
          onPressed: () => ref.read(chatProvider.notifier).clear(),
          icon: Icon(PhosphorIcons.trash(),
              size: 18, color: Colors.grey.shade400),
          tooltip: 'Clear chat',
        ),
        const SizedBox(width: 8),
        // Text field
        Expanded(
          child: TextField(
            controller: _controller,
            onSubmitted: (_) => _send(),
            maxLines: null,
            decoration: InputDecoration(
              hintText: 'Ask Lina anything about Famous Gates...',
              hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
              filled: true,
              fillColor: Colors.grey.shade50,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: const BorderSide(color: _kLinaAccent, width: 1.5),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            ),
          ),
        ),
        const SizedBox(width: 10),
        // Send
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          child: FilledButton(
            onPressed: _loading ? null : _send,
            style: FilledButton.styleFrom(
              backgroundColor: _kLinaAccent,
              shape: const CircleBorder(),
              padding: const EdgeInsets.all(14),
            ),
            child: _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2))
                : Icon(PhosphorIcons.paperPlaneTilt(),
                    size: 18, color: Colors.white),
          ),
        ),
      ]),
    );
  }
}

class _TypingIndicator extends StatefulWidget {
  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<double>> _animations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
        3,
        (i) => AnimationController(
            vsync: this, duration: const Duration(milliseconds: 600))
          ..repeat(
              reverse: true, period: Duration(milliseconds: 600 + i * 200)));
    _animations = _controllers
        .map((c) => CurvedAnimation(parent: c, curve: Curves.easeInOut))
        .toList();
    for (var i = 0; i < 3; i++) {
      Future.delayed(Duration(milliseconds: i * 150), () {
        if (mounted) _controllers[i].repeat(reverse: true);
      });
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(
            3,
            (i) => AnimatedBuilder(
                  animation: _animations[i],
                  builder: (_, __) => Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: _kLinaAccent.withValues(
                          alpha: 0.3 + _animations[i].value * 0.7),
                      shape: BoxShape.circle,
                    ),
                  ),
                )));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Monitoring Tab
// ═════════════════════════════════════════════════════════════════════════════
class _MonitoringTab extends ConsumerStatefulWidget {
  const _MonitoringTab();
  @override
  ConsumerState<_MonitoringTab> createState() => _MonitoringTabState();
}

class _MonitoringTabState extends ConsumerState<_MonitoringTab> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      ref.invalidate(linaMonitoringProvider);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final monAsync = ref.watch(linaMonitoringProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Live System Monitoring',
            subtitle: 'Auto-refreshes every 30 seconds',
            action: OutlinedButton.icon(
              onPressed: () => ref.invalidate(linaMonitoringProvider),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Refresh'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        monAsync.when(
          data: (data) => _buildMonitoring(data),
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaMonitoringProvider)),
        ),
      ]),
    );
  }

  Widget _buildMonitoring(Map<String, dynamic> data) {
    final system = data['system'] as Map<String, dynamic>? ?? {};
    final db = data['database'] as Map<String, dynamic>? ?? {};
    final ai = data['ai_providers'] as Map<String, dynamic>? ?? {};
    final groq = ai['groq'] as Map<String, dynamic>? ?? {};
    final geminiProv = ai['gemini'] as Map<String, dynamic>? ?? {};
    final dbOk = (db['status'] ?? '') == 'healthy';
    final maintenance = data['maintenance_mode'] == true;
    final pending = data['pending_remediations'] ?? 0;

    return Column(children: [
      Row(children: [
        _statusCard(
            'Database',
            dbOk ? 'Healthy' : 'Degraded',
            '${db['latency_ms'] ?? 0}ms latency',
            dbOk ? AppColors.kSuccess : AppColors.kError),
        const SizedBox(width: 12),
        _statusCard(
            'System',
            'Running',
            '${(system['uptime_seconds'] as int? ?? 0) ~/ 3600}h uptime · ${system['memory_mb'] ?? 0}MB RAM',
            AppColors.kSuccess),
        const SizedBox(width: 12),
        _statusCard(
            'Groq AI',
            groq['status'] == 'configured' ? 'Connected' : 'No Key',
            groq['model'] ?? '',
            groq['status'] == 'configured' ? _kLinaAccent : AppColors.kWarning),
        const SizedBox(width: 12),
        _statusCard(
            'Gemini AI',
            geminiProv['status'] == 'configured' ? 'Connected' : 'No Key',
            geminiProv['model'] ?? '',
            geminiProv['status'] == 'configured'
                ? _kLinaAccent
                : AppColors.kWarning),
      ]),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
            child: _card(
                child: Row(children: [
          Icon(PhosphorIcons.warning(),
              color: maintenance ? AppColors.kError : AppColors.kSuccess,
              size: 20),
          const SizedBox(width: 10),
          Text('Maintenance Mode: ${maintenance ? "ACTIVE" : "OFF"}',
              style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: maintenance ? AppColors.kError : AppColors.kSuccess)),
        ]))),
        const SizedBox(width: 12),
        Expanded(
            child: _card(
                child: Row(children: [
          Icon(PhosphorIcons.wrench(),
              color: pending > 0 ? AppColors.kWarning : AppColors.kSuccess,
              size: 20),
          const SizedBox(width: 10),
          Text('Pending Remediations: $pending',
              style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: pending > 0
                      ? AppColors.kWarning
                      : AppColors.kTextPrimary)),
        ]))),
      ]),
    ]);
  }

  Widget _statusCard(String title, String status, String sub, Color color) {
    return Expanded(
        child: _card(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(title,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      ]),
      const SizedBox(height: 6),
      Text(status,
          style: TextStyle(
              fontSize: 16, fontWeight: FontWeight.w700, color: color)),
      const SizedBox(height: 2),
      Text(sub,
          style:
              const TextStyle(fontSize: 11, color: AppColors.kTextSecondary)),
    ])));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Audit Tab
// ═════════════════════════════════════════════════════════════════════════════
class _AuditTab extends ConsumerWidget {
  const _AuditTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportAsync = ref.watch(linaAnomalyReportProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Audit Center',
            subtitle: 'AI-powered anomaly detection and fraud indicators',
            action: OutlinedButton.icon(
              onPressed: () => ref.invalidate(linaAnomalyReportProvider),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('New Report'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        reportAsync.when(
          data: (data) => _card(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Row(children: [
                  Icon(PhosphorIcons.shieldWarning(),
                      size: 18, color: _kLinaAccent),
                  const SizedBox(width: 8),
                  const Text('Anomaly Audit Report',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                        color: _kLinaAccent.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(6)),
                    child: const Text('Gemini 1.5 Pro',
                        style: TextStyle(
                            color: _kLinaAccent,
                            fontSize: 11,
                            fontWeight: FontWeight.w600)),
                  ),
                ]),
                const Divider(height: 24),
                Text(data['report'] ?? '',
                    style: const TextStyle(
                        fontSize: 13.5,
                        height: 1.7,
                        color: AppColors.kTextPrimary)),
                const SizedBox(height: 8),
                Text('Generated: ${data['generated_at'] ?? ''}',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.kTextSecondary)),
              ])),
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaAnomalyReportProvider)),
        ),
      ]),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Financial Tab
// ═════════════════════════════════════════════════════════════════════════════
class _FinancialTab extends ConsumerWidget {
  const _FinancialTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final finAsync = ref.watch(linaFinancialIntelProvider);
    final ctxAsync = ref.watch(linaContextProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Financial Intelligence',
            subtitle: '30-day revenue analysis and cash flow signals',
            action: OutlinedButton.icon(
              onPressed: () {
                ref.invalidate(linaFinancialIntelProvider);
                ref.invalidate(linaContextProvider);
              },
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Refresh'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        ctxAsync.when(
          data: (ctx) {
            final rev = ctx['revenue'] as Map<String, dynamic>? ?? {};
            final r24 = (rev['total_24h'] as num?)?.toDouble() ?? 0;
            final r7d = (rev['total_7d'] as num?)?.toDouble() ?? 0;
            final voids = rev['void_bills_7d'] ?? 0;
            return Row(children: [
              _kpiCard('Revenue 24h', 'KES ${(r24 / 1000).toStringAsFixed(1)}K',
                  PhosphorIcons.currencyDollar(), _kLinaTeal),
              const SizedBox(width: 12),
              _kpiCard('Revenue 7d', 'KES ${(r7d / 1000).toStringAsFixed(1)}K',
                  PhosphorIcons.trendUp(), AppColors.kSuccess),
              const SizedBox(width: 12),
              _kpiCard('Void Bills 7d', '$voids', PhosphorIcons.prohibit(),
                  AppColors.kError),
            ]);
          },
          loading: () => const SizedBox(
              height: 80,
              child: Center(
                  child: CircularProgressIndicator(
                      color: _kLinaAccent, strokeWidth: 2))),
          error: (_, __) => const SizedBox.shrink(),
        ),
        const SizedBox(height: 20),
        finAsync.when(
          data: (data) => _card(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Row(children: [
                  Icon(PhosphorIcons.currencyDollar(),
                      size: 18, color: _kLinaAccent),
                  const SizedBox(width: 8),
                  const Text('Financial Analysis',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                        color: _kLinaAccent.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(6)),
                    child: const Text('Gemini 1.5 Pro',
                        style: TextStyle(
                            color: _kLinaAccent,
                            fontSize: 11,
                            fontWeight: FontWeight.w600)),
                  ),
                ]),
                const Divider(height: 24),
                Text(data['analysis'] ?? '',
                    style: const TextStyle(
                        fontSize: 13.5,
                        height: 1.7,
                        color: AppColors.kTextPrimary)),
              ])),
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaFinancialIntelProvider)),
        ),
      ]),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. Employee Tab
// ═════════════════════════════════════════════════════════════════════════════
class _EmployeeTab extends ConsumerWidget {
  const _EmployeeTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final empAsync = ref.watch(linaEmployeeIntelProvider);
    final ctxAsync = ref.watch(linaContextProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Employee Intelligence',
            subtitle: 'Staff attendance, payroll signals and anomalies',
            action: OutlinedButton.icon(
              onPressed: () {
                ref.invalidate(linaEmployeeIntelProvider);
                ref.invalidate(linaContextProvider);
              },
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Refresh'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        ctxAsync.when(
          data: (ctx) {
            final staff = ctx['staff_today'] as Map<String, dynamic>? ?? {};
            return Row(children: [
              _kpiCard('Present Today', '${staff['present'] ?? 0}',
                  PhosphorIcons.checkCircle(), AppColors.kSuccess),
              const SizedBox(width: 12),
              _kpiCard('Absent Today', '${staff['absent'] ?? 0}',
                  PhosphorIcons.xCircle(), AppColors.kError),
              const SizedBox(width: 12),
              _kpiCard('Late Today', '${staff['late'] ?? 0}',
                  PhosphorIcons.clockCounterClockwise(), AppColors.kWarning),
              const SizedBox(width: 12),
              _kpiCard('On Overtime', '${staff['overtime'] ?? 0}',
                  PhosphorIcons.clockCountdown(), _kLinaAccent),
            ]);
          },
          loading: () => const SizedBox(
              height: 80,
              child: Center(
                  child: CircularProgressIndicator(
                      color: _kLinaAccent, strokeWidth: 2))),
          error: (_, __) => const SizedBox.shrink(),
        ),
        const SizedBox(height: 20),
        empAsync.when(
          data: (data) => _card(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Row(children: [
                  Icon(PhosphorIcons.users(), size: 18, color: _kLinaAccent),
                  const SizedBox(width: 8),
                  const Text('Staff Intelligence Report',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                        color: _kLinaAccent.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(6)),
                    child: const Text('Gemini 1.5 Pro',
                        style: TextStyle(
                            color: _kLinaAccent,
                            fontSize: 11,
                            fontWeight: FontWeight.w600)),
                  ),
                ]),
                const Divider(height: 24),
                Text(data['analysis'] ?? '',
                    style: const TextStyle(
                        fontSize: 13.5,
                        height: 1.7,
                        color: AppColors.kTextPrimary)),
              ])),
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaEmployeeIntelProvider)),
        ),
      ]),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. Recommendations Tab
// ═════════════════════════════════════════════════════════════════════════════
class _RecommendationsTab extends ConsumerWidget {
  const _RecommendationsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recsAsync = ref.watch(linaRecommendationsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Recommendations',
            subtitle: 'AI-ranked action items by business impact',
            action: OutlinedButton.icon(
              onPressed: () => ref.invalidate(linaRecommendationsProvider),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Refresh'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        recsAsync.when(
          data: (recs) => Column(
            children: recs.isEmpty
                ? [
                    _card(
                        child: const Center(
                            child: Padding(
                                padding: EdgeInsets.all(32),
                                child: Text('No recommendations at this time.',
                                    style: TextStyle(
                                        color: AppColors.kTextSecondary)))))
                  ]
                : recs
                    .map((r) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _buildRecCard(r, context),
                        ))
                    .toList(),
          ),
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaRecommendationsProvider)),
        ),
      ]),
    );
  }

  Widget _buildRecCard(Map<String, dynamic> r, BuildContext context) {
    final level = (r['remediation_level'] ?? '').toString();
    final levelColors = {
      'SAFE_AUTO': AppColors.kSuccess,
      'APPROVAL_REQUIRED': AppColors.kWarning,
      'MANUAL_ONLY': AppColors.kError,
    };
    final levelColor = levelColors[level] ?? Colors.grey;
    final isActionable = level != 'MANUAL_ONLY';

    return _card(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        _severityBadge(r['severity'] ?? 'LOW'),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
              color: levelColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6)),
          child: Text(level.replaceAll('_', ' '),
              style: TextStyle(
                  color: levelColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w600)),
        ),
        const Spacer(),
        if (r['module'] != null)
          Text(r['module'].toString(),
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary)),
      ]),
      const SizedBox(height: 10),
      Text(r['title'] ?? '',
          style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.kTextPrimary)),
      const SizedBox(height: 4),
      Text(r['impact'] ?? '',
          style: const TextStyle(
              fontSize: 13, color: AppColors.kTextSecondary, height: 1.5)),
      const SizedBox(height: 10),
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: Colors.grey.shade50, borderRadius: BorderRadius.circular(8)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(PhosphorIcons.brain(), size: 14, color: _kLinaAccent),
          const SizedBox(width: 8),
          Expanded(
              child: Text(r['suggested_action'] ?? '',
                  style: const TextStyle(
                      fontSize: 12.5,
                      height: 1.5,
                      color: AppColors.kTextPrimary))),
        ]),
      ),
      if (isActionable) ...[
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: OutlinedButton(
            onPressed: () => AppNotifier.showSnackBar(context,
                SnackBar(content: Text('Remediation logged: ${r['title']}'))),
            style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            child: const Text('Take Action'),
          ),
        ),
      ],
    ]));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. Timeline Tab
// ═════════════════════════════════════════════════════════════════════════════
class _TimelineTab extends ConsumerWidget {
  const _TimelineTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tlAsync = ref.watch(linaIncidentTimelineProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Incident Timeline',
            subtitle:
                'Live event stream — audit, anomalies, security, admin actions',
            action: OutlinedButton.icon(
              onPressed: () => ref.invalidate(linaIncidentTimelineProvider),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Refresh'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        tlAsync.when(
          data: (data) {
            final events = (data['events'] as List<dynamic>?) ?? [];
            if (events.isEmpty)
              return _card(
                  child: const Center(
                      child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Text('No events in the last 24h',
                              style: TextStyle(
                                  color: AppColors.kTextSecondary)))));
            return _card(
                child: Column(
              children: events
                  .take(80)
                  .map<Widget>((e) => _buildEvent(e as Map<String, dynamic>))
                  .toList(),
            ));
          },
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaIncidentTimelineProvider)),
        ),
      ]),
    );
  }

  Widget _buildEvent(Map<String, dynamic> e) {
    final type = e['event_type'] ?? '';
    final configs = {
      'audit': (AppColors.kPrimary, PhosphorIcons.clipboardText()),
      'anomaly': (AppColors.kError, PhosphorIcons.warning()),
      'superadmin': (Color(0xFFEA580C), PhosphorIcons.sparkle()),
      'auth': (AppColors.kWarning, PhosphorIcons.key()),
    };
    final (color, icon) = configs[type] ?? (Colors.grey, PhosphorIcons.info());

    final ts = e['timestamp'] as String? ?? '';
    String timeStr = ts;
    try {
      final dt = DateTime.parse(ts).toLocal();
      timeStr =
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {}

    final desc =
        e['description'] ?? e['action'] ?? e['action_type'] ?? e['email'] ?? '';
    final entity =
        e['entity_type'] ?? e['exception_type'] ?? e['target_type'] ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1), shape: BoxShape.circle),
          child: Icon(icon, size: 14, color: color),
        ),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(4)),
              child: Text(type.toUpperCase(),
                  style: TextStyle(
                      color: color, fontSize: 10, fontWeight: FontWeight.w700)),
            ),
            if (entity.isNotEmpty) ...[
              const SizedBox(width: 6),
              Text(entity,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.kTextSecondary)),
            ],
            const Spacer(),
            Text(timeStr,
                style: const TextStyle(
                    fontSize: 11, color: AppColors.kTextSecondary)),
          ]),
          if (desc.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(desc.toString(),
                style: const TextStyle(
                    fontSize: 12.5, color: AppColors.kTextPrimary),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],
        ])),
      ]),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. Fix Center Tab
// ═════════════════════════════════════════════════════════════════════════════
class _FixCenterTab extends ConsumerWidget {
  const _FixCenterTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final remsAsync = ref.watch(linaPendingRemediationsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Fix Center',
            subtitle: 'Pending AI-proposed remediations awaiting approval',
            action: OutlinedButton.icon(
              onPressed: () => ref.invalidate(linaPendingRemediationsProvider),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Refresh'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        remsAsync.when(
          data: (rems) => rems.isEmpty
              ? _card(
                  child: Center(
                      child: Padding(
                          padding: EdgeInsets.all(40),
                          child: Column(children: [
                            Icon(PhosphorIcons.checkCircle(),
                                size: 40, color: AppColors.kSuccess),
                            SizedBox(height: 12),
                            Text('No pending remediations',
                                style: TextStyle(
                                    color: AppColors.kTextSecondary,
                                    fontSize: 15)),
                          ]))))
              : Column(
                  children: rems
                      .map((r) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _buildRemCard(r, context, ref),
                          ))
                      .toList()),
          loading: () => _loadingCard(),
          error: (e, _) => _errorCard(
              e, () => ref.invalidate(linaPendingRemediationsProvider)),
        ),
      ]),
    );
  }

  Widget _buildRemCard(
      Map<String, dynamic> r, BuildContext context, WidgetRef ref) {
    final level = r['level'] ?? '';
    final isManual = level == 'MANUAL_ONLY';
    final levelColors = {
      'SAFE_AUTO': AppColors.kSuccess,
      'APPROVAL_REQUIRED': AppColors.kWarning,
      'MANUAL_ONLY': AppColors.kError
    };
    final lc = levelColors[level] ?? Colors.grey;

    return _card(
      border: lc.withValues(alpha: 0.3),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
                color: lc.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6)),
            child: Text(level.replaceAll('_', ' '),
                style: TextStyle(
                    color: lc, fontSize: 11, fontWeight: FontWeight.w700)),
          ),
          const Spacer(),
          Text(r['proposed_at'] ?? '',
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary)),
        ]),
        const SizedBox(height: 10),
        Text(r['action'] ?? r['description'] ?? '',
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.kTextPrimary)),
        if ((r['description'] ?? '').toString().isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(r['description'].toString(),
              style: const TextStyle(
                  fontSize: 13, color: AppColors.kTextSecondary, height: 1.5)),
        ],
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
              child: OutlinedButton(
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (_) => AlertDialog(
                        title: const Text('Reject remediation?'),
                        actions: [
                          TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Cancel')),
                          TextButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Reject',
                                  style: TextStyle(color: AppColors.kError))),
                        ],
                      ));
              if (confirmed == true) {
                try {
                  await ref
                      .read(linaRepositoryProvider)
                      .rejectRemediation(r['id']);
                  ref.invalidate(linaPendingRemediationsProvider);
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('Remediation rejected')));
                } catch (e) {
                  AppNotifier.showSnackBar(
                      context, SnackBar(content: Text(e.toString())));
                }
              }
            },
            style: OutlinedButton.styleFrom(foregroundColor: AppColors.kError),
            child: const Text('Reject'),
          )),
          const SizedBox(width: 12),
          Expanded(
              child: FilledButton(
            onPressed: isManual
                ? null
                : () async {
                    try {
                      await ref
                          .read(linaRepositoryProvider)
                          .approveRemediation(r['id']);
                      ref.invalidate(linaPendingRemediationsProvider);
                      AppNotifier.showSnackBar(
                          context,
                          const SnackBar(
                              content:
                                  Text('✅ Remediation approved and queued')));
                    } catch (e) {
                      AppNotifier.showSnackBar(
                          context, SnackBar(content: Text(e.toString())));
                    }
                  },
            style: FilledButton.styleFrom(
                backgroundColor:
                    isManual ? Colors.grey.shade300 : AppColors.kSuccess),
            child: Text(isManual ? 'Manual Only' : 'Approve',
                style: const TextStyle(color: Colors.white)),
          )),
        ]),
      ]),
    );
  }
}
