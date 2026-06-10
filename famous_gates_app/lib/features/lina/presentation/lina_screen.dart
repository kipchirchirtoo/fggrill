import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
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
  ('Forecast', PhosphorIcons.trendUp()),
  ('Benchmark', PhosphorIcons.trophy()),
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
        _buildAutomationStrip(),
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
              _ForecastTab(),
              _BranchBenchmarkTab(),
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
          Text('AI Command Center',
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
            child: const Text('LINA AI',
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

  Widget _buildAutomationStrip() {
    final lanes = [
      (
        'Cashier',
        'Shift logbook close, cash-change audit, unpaid bill migration',
        PhosphorIcons.receipt(),
        AppColors.kSuccess
      ),
      (
        'Branch Accountant',
        'Daily financial workspace, void review, director escalation',
        PhosphorIcons.bank(),
        _kLinaTeal
      ),
      (
        'Auditor',
        'Revenue exceptions, staff audit, void exposure, compliance trail',
        PhosphorIcons.shieldCheck(),
        AppColors.kWarning
      ),
      (
        'HR',
        'Payroll intelligence, staff audit signals, attendance variance',
        PhosphorIcons.users(),
        _kLinaAccent
      ),
      (
        'Central Store',
        'Stock logs, variance signals, issue trail, dispatch evidence',
        PhosphorIcons.package(),
        const Color(0xFF0F766E)
      ),
    ];

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 980) {
            final tileWidth = constraints.maxWidth < 560
                ? constraints.maxWidth
                : (constraints.maxWidth - 10) / 2;
            return Wrap(
              spacing: 10,
              runSpacing: 10,
              children: lanes
                  .map((lane) => SizedBox(
                        width: tileWidth,
                        child:
                            _automationLane(lane.$1, lane.$2, lane.$3, lane.$4),
                      ))
                  .toList(),
            );
          }
          return Row(
            children: [
              for (var i = 0; i < lanes.length; i++) ...[
                Expanded(
                  child: _automationLane(
                    lanes[i].$1,
                    lanes[i].$2,
                    lanes[i].$3,
                    lanes[i].$4,
                  ),
                ),
                if (i != lanes.length - 1) const SizedBox(width: 10),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _automationLane(
      String title, String subtitle, IconData icon, Color color) {
    return Container(
      constraints: const BoxConstraints(minHeight: 72),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.055),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 9),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: color, fontWeight: FontWeight.w800, fontSize: 12)),
            const SizedBox(height: 4),
            Text(subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    height: 1.25)),
          ]),
        ),
      ]),
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

// Dynamic source chip — internal providers are intentionally hidden from users.
Widget _modelChip(Map<String, dynamic> data) {
  final engine = data['engine'] == 'deterministic';
  final color = engine ? _kLinaTeal : _kLinaAccent;
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(engine ? PhosphorIcons.brain() : PhosphorIcons.sparkle(),
          size: 11, color: color),
      const SizedBox(width: 4),
      Text(engine ? 'LINA AI Engine' : 'LINA AI',
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    ]),
  );
}

// Health-score gauge chip (0-100 + grade).
Widget _scorePill(String label, num score, String grade) {
  final s = score.toDouble();
  final color = s >= 70
      ? AppColors.kSuccess
      : s >= 55
          ? AppColors.kWarning
          : AppColors.kError;
  return Expanded(
    child: _card(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('${score.round()}',
              style: TextStyle(
                  fontSize: 26, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(width: 2),
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text('/100',
                style:
                    TextStyle(fontSize: 11, color: AppColors.kTextSecondary)),
          ),
          const Spacer(),
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8)),
            child: Text(grade,
                style: TextStyle(
                    color: color, fontSize: 13, fontWeight: FontWeight.w800)),
          ),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: (s / 100).clamp(0.0, 1.0),
            minHeight: 5,
            backgroundColor: color.withValues(alpha: 0.12),
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
        const SizedBox(height: 6),
        Text(label,
            style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.kTextSecondary)),
      ]),
    ),
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
    const Text('Failed to load',
        style: TextStyle(
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

Widget _linaMarkdown(String value, {Color color = AppColors.kTextPrimary}) {
  final textStyle = TextStyle(fontSize: 13.5, height: 1.65, color: color);
  return MarkdownBody(
    data: value.trim().isEmpty ? 'No intelligence available yet.' : value,
    selectable: true,
    styleSheet: MarkdownStyleSheet(
      p: textStyle,
      listBullet: textStyle,
      strong: textStyle.copyWith(fontWeight: FontWeight.w700),
      h1: textStyle.copyWith(fontSize: 18, fontWeight: FontWeight.w800),
      h2: textStyle.copyWith(fontSize: 16, fontWeight: FontWeight.w800),
      h3: textStyle.copyWith(fontSize: 14.5, fontWeight: FontWeight.w700),
      blockquote: textStyle.copyWith(color: AppColors.kTextSecondary),
      code: textStyle.copyWith(
        fontFamily: 'monospace',
        color: color,
        backgroundColor: color == Colors.white
            ? Colors.white.withValues(alpha: 0.12)
            : const Color(0xFFF3F4F6),
      ),
    ),
  );
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

        // KPI row + health scores from context
        ctxAsync.when(
          data: (ctx) => Column(children: [
            _buildKpiRow(ctx),
            const SizedBox(height: 12),
            _buildHealthScores(ctx),
          ]),
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
                _modelChip(data),
              ]),
              const Divider(height: 24),
              _linaMarkdown(data['summary'] ?? 'No summary available'),
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

  Widget _buildHealthScores(Map<String, dynamic> ctx) {
    final hs = ctx['health_scores'] as Map<String, dynamic>? ?? {};
    final pillars = (hs['pillars'] as List<dynamic>?) ?? [];
    if (pillars.isEmpty) return const SizedBox.shrink();
    final children = <Widget>[];
    for (var i = 0; i < pillars.length; i++) {
      final p = pillars[i] as Map<String, dynamic>;
      children.add(_scorePill(
        (p['label'] ?? '').toString(),
        (p['score'] as num?) ?? 0,
        (p['grade'] ?? '—').toString(),
      ));
      if (i != pillars.length - 1) children.add(const SizedBox(width: 12));
    }
    return Row(children: children);
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
                : _linaMarkdown(
                    msg.content,
                    color: isUser ? Colors.white : AppColors.kTextPrimary,
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
    for (final c in _controllers) {
      c.dispose();
    }
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
    final linaAi = ai['lina'] as Map<String, dynamic>? ?? {};
    final aiReady = (linaAi['status'] ?? '') == 'configured';
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
            'LINA AI',
            aiReady ? 'Operational' : 'Fallback mode',
            aiReady
                ? 'Reasoning, workflow automation, verification'
                : 'Deterministic summaries active',
            aiReady ? _kLinaAccent : AppColors.kWarning),
        const SizedBox(width: 12),
        _statusCard(
            'Automation',
            pending == 0 ? 'Clear' : '$pending active',
            'Approvals, execution, verification',
            pending == 0 ? AppColors.kSuccess : AppColors.kWarning),
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
                  _modelChip(data),
                ]),
                const Divider(height: 24),
                _linaMarkdown(data['report'] ?? ''),
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
                  _modelChip(data),
                ]),
                const Divider(height: 24),
                _linaMarkdown(data['analysis'] ?? ''),
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
                  _modelChip(data),
                ]),
                const Divider(height: 24),
                _linaMarkdown(data['analysis'] ?? ''),
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
                          child: _buildRecCard(r, context, ref),
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

  Widget _buildRecCard(
      Map<String, dynamic> r, BuildContext context, WidgetRef ref) {
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
            onPressed: () async {
              try {
                await ref.read(linaRepositoryProvider).createRemediation({
                  'title': r['title'],
                  'action': r['title'],
                  'description': r['suggested_action'] ?? r['impact'],
                  'severity': r['severity'] ?? 'LOW',
                  'level': r['remediation_level'] ?? 'APPROVAL_REQUIRED',
                  'module': r['module'],
                  'kpi_impact': r['kpi_impact'],
                  'evidence': {
                    'impact': r['impact'],
                    'suggested_action': r['suggested_action'],
                    'source': 'lina_recommendations',
                  },
                  'blast_radius': {
                    'module': r['module'],
                    'estimated_effort': r['estimated_effort'],
                  },
                  'rollback_plan':
                      'Lina safe jobs are non-destructive; retry or mark failed if verification does not pass.',
                });
                ref.invalidate(linaPendingRemediationsProvider);
                if (!context.mounted) return;
                AppNotifier.showSnackBar(
                    context,
                    SnackBar(
                        content: Text('Remediation created: ${r['title']}')));
              } catch (e) {
                if (!context.mounted) return;
                AppNotifier.showSnackBar(
                    context, SnackBar(content: Text(e.toString())));
              }
            },
            style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            child: const Text('Create Proposal'),
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
            if (events.isEmpty) {
              return _card(
                  child: const Center(
                      child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Text('No events in the last 24h',
                              style: TextStyle(
                                  color: AppColors.kTextSecondary)))));
            }
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
      'superadmin': (const Color(0xFFEA580C), PhosphorIcons.sparkle()),
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
    final historyAsync = ref.watch(linaRemediationHistoryProvider);
    final logsAsync = ref.watch(linaAgentLogsProvider);
    final routerAsync = ref.watch(linaModelRouterProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Fix Center',
            subtitle:
                'Governed approvals, execution history, verification, and model routing',
            action: OutlinedButton.icon(
              onPressed: () {
                ref.invalidate(linaPendingRemediationsProvider);
                ref.invalidate(linaRemediationHistoryProvider);
                ref.invalidate(linaAgentLogsProvider);
                ref.invalidate(linaModelRouterProvider);
              },
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Refresh'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        _buildRouterPanel(routerAsync),
        const SizedBox(height: 14),
        const Text('Approval Review',
            style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.kTextPrimary)),
        const SizedBox(height: 10),
        remsAsync.when(
          data: (rems) => rems.isEmpty
              ? _card(
                  child: Center(
                      child: Padding(
                          padding: const EdgeInsets.all(40),
                          child: Column(children: [
                            Icon(PhosphorIcons.checkCircle(),
                                size: 40, color: AppColors.kSuccess),
                            const SizedBox(height: 12),
                            const Text('No pending remediations',
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
        const SizedBox(height: 18),
        _buildHistoryPanel(historyAsync),
        const SizedBox(height: 18),
        _buildAgentLogPanel(logsAsync),
      ]),
    );
  }

  Widget _buildRouterPanel(AsyncValue<Map<String, dynamic>> routerAsync) {
    return routerAsync.when(
      data: (data) {
        final lina = Map<String, dynamic>.from((data['lina_ai'] as Map?) ?? {});
        final tools = (lina['tools'] as List?) ?? const [];
        return _card(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(PhosphorIcons.brain(), size: 18, color: _kLinaAccent),
            const SizedBox(width: 8),
            const Text('LINA AI Governance',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.kTextPrimary)),
          ]),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _stateChip(
                  'Reasoning', (lina['reasoning'] ?? 'active').toString()),
              _stateChip('Automation',
                  (lina['automation'] ?? 'policy gated').toString()),
              _stateChip('Verification',
                  (lina['verification'] ?? 'enabled').toString()),
              _stateChip('Audit', (lina['audit'] ?? 'logged').toString()),
            ],
          ),
          if (tools.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              tools.take(5).join('   |   '),
              style: const TextStyle(
                  fontSize: 12, color: AppColors.kTextSecondary),
            ),
          ],
        ]));
      },
      loading: () => _loadingCard(),
      error: (e, _) => _card(
          child: Text('Model router unavailable: $e',
              style: const TextStyle(color: AppColors.kTextSecondary))),
    );
  }

  Widget _buildHistoryPanel(
      AsyncValue<List<Map<String, dynamic>>> historyAsync) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Execution & Verification History',
          style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.kTextPrimary)),
      const SizedBox(height: 10),
      historyAsync.when(
        data: (items) => items.isEmpty
            ? _card(
                child: const Text('No remediation history yet',
                    style: TextStyle(color: AppColors.kTextSecondary)))
            : Column(
                children: items.take(8).map((item) {
                  final execution =
                      (item['execution_status'] ?? 'not_queued').toString();
                  final verification =
                      (item['verification_status'] ?? 'not_verified')
                          .toString();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _card(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Expanded(
                                    child: Text(
                                        (item['title'] ??
                                                item['action'] ??
                                                'Remediation')
                                            .toString(),
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.kTextPrimary))),
                                Text((item['severity'] ?? 'LOW').toString(),
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.kTextSecondary)),
                              ]),
                              const SizedBox(height: 8),
                              Wrap(spacing: 8, runSpacing: 8, children: [
                                _stateChip(
                                    'Approval',
                                    (item['approval_status'] ?? 'pending')
                                        .toString()),
                                _stateChip('Execution', execution),
                                _stateChip('Verification', verification),
                              ]),
                              if ((item['execution_result'] as Map?)
                                      ?.isNotEmpty ==
                                  true) ...[
                                const SizedBox(height: 8),
                                Text(
                                    'Result: ${item['execution_result'].toString()}',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.kTextSecondary)),
                              ],
                            ])),
                  );
                }).toList(),
              ),
        loading: () => _loadingCard(),
        error: (e, _) => _card(
            child: Text('History unavailable: $e',
                style: const TextStyle(color: AppColors.kTextSecondary))),
      ),
    ]);
  }

  Widget _buildAgentLogPanel(AsyncValue<List<Map<String, dynamic>>> logsAsync) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Agent Audit Trail',
          style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.kTextPrimary)),
      const SizedBox(height: 10),
      logsAsync.when(
        data: (logs) => logs.isEmpty
            ? _card(
                child: const Text('No Lina agent logs yet',
                    style: TextStyle(color: AppColors.kTextSecondary)))
            : _card(
                child: Column(
                    children: logs.take(10).map((log) {
                  final status = (log['status'] ?? 'recorded').toString();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(PhosphorIcons.clockCounterClockwise(),
                              size: 16, color: _kLinaAccent),
                          const SizedBox(width: 10),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text(
                                    '${log['action'] ?? 'agent_action'} · ${log['tool_name'] ?? 'tool'}',
                                    style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.kTextPrimary)),
                                Text(
                                    '${log['actor_role'] ?? 'system'} · ${log['created_at'] ?? ''}',
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.kTextSecondary)),
                              ])),
                          _stateChip('Status', status),
                        ]),
                  );
                }).toList()),
              ),
        loading: () => _loadingCard(),
        error: (e, _) => _card(
            child: Text('Agent logs unavailable: $e',
                style: const TextStyle(color: AppColors.kTextSecondary))),
      ),
    ]);
  }

  Widget _buildRemCard(
      Map<String, dynamic> r, BuildContext context, WidgetRef ref) {
    final level = r['level'] ?? '';
    final isManual = level == 'MANUAL_ONLY';
    final approval = (r['approval_status'] ?? '').toString();
    final execution = (r['execution_status'] ?? '').toString();
    final verification = (r['verification_status'] ?? '').toString();
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
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _stateChip('Approval', approval.isEmpty ? 'pending' : approval),
            _stateChip(
                'Execution', execution.isEmpty ? 'not queued' : execution),
            _stateChip('Verification',
                verification.isEmpty ? 'not verified' : verification),
          ],
        ),
        if ((r['rollback_plan'] ?? '').toString().isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('Rollback: ${r['rollback_plan']}',
              style: const TextStyle(
                  fontSize: 12, color: AppColors.kTextSecondary)),
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
                  _refreshFixCenter(ref);
                  if (!context.mounted) return;
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('Remediation rejected')));
                } catch (e) {
                  if (!context.mounted) return;
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
            onPressed: isManual || approval == 'approved'
                ? null
                : () async {
                    try {
                      await ref
                          .read(linaRepositoryProvider)
                          .approveRemediation(r['id']);
                      _refreshFixCenter(ref);
                      if (!context.mounted) return;
                      AppNotifier.showSnackBar(
                          context,
                          const SnackBar(
                              content:
                                  Text('✅ Remediation approved and queued')));
                    } catch (e) {
                      if (!context.mounted) return;
                      AppNotifier.showSnackBar(
                          context, SnackBar(content: Text(e.toString())));
                    }
                  },
            style: FilledButton.styleFrom(
                backgroundColor:
                    isManual ? Colors.grey.shade300 : AppColors.kSuccess),
            child: Text(
                isManual
                    ? 'Manual Only'
                    : approval == 'approved'
                        ? 'Approved'
                        : 'Approve',
                style: const TextStyle(color: Colors.white)),
          )),
        ]),
        if (!isManual && approval == 'approved') ...[
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: execution == 'queued' ||
                        execution == 'running' ||
                        execution == 'succeeded'
                    ? null
                    : () async {
                        try {
                          await ref
                              .read(linaRepositoryProvider)
                              .executeRemediation(r['id']);
                          _refreshFixCenter(ref);
                          if (!context.mounted) return;
                          AppNotifier.showSnackBar(
                              context,
                              const SnackBar(
                                  content:
                                      Text('Execution job queued for Lina')));
                        } catch (e) {
                          if (!context.mounted) return;
                          AppNotifier.showSnackBar(
                              context, SnackBar(content: Text(e.toString())));
                        }
                      },
                icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
                label: Text(execution == 'queued' || execution == 'running'
                    ? 'Queued'
                    : execution == 'succeeded'
                        ? 'Executed'
                        : 'Execute'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: execution == 'succeeded' &&
                        verification != 'verified'
                    ? () async {
                        try {
                          await ref
                              .read(linaRepositoryProvider)
                              .verifyRemediation(r['id']);
                          _refreshFixCenter(ref);
                          if (!context.mounted) return;
                          AppNotifier.showSnackBar(
                              context,
                              const SnackBar(
                                  content:
                                      Text('Lina verification completed')));
                        } catch (e) {
                          if (!context.mounted) return;
                          AppNotifier.showSnackBar(
                              context, SnackBar(content: Text(e.toString())));
                        }
                      }
                    : null,
                icon: Icon(PhosphorIcons.checkCircle(), size: 15),
                label: Text(verification == 'verified' ? 'Verified' : 'Verify'),
              ),
            ),
          ]),
        ],
      ]),
    );
  }

  Widget _stateChip(String label, String value) {
    final normalized = value.toLowerCase();
    final color = normalized.contains('approved') ||
            normalized.contains('succeeded') ||
            normalized.contains('verified')
        ? AppColors.kSuccess
        : normalized.contains('failed') ||
                normalized.contains('rejected') ||
                normalized.contains('blocked')
            ? AppColors.kError
            : normalized.contains('running') || normalized.contains('queued')
                ? _kLinaAccent
                : AppColors.kWarning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text('$label: ${value.replaceAll('_', ' ')}',
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }

  void _refreshFixCenter(WidgetRef ref) {
    ref.invalidate(linaPendingRemediationsProvider);
    ref.invalidate(linaRemediationHistoryProvider);
    ref.invalidate(linaAgentLogsProvider);
    ref.invalidate(linaModelRouterProvider);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Forecast Tab — revenue projection (deterministic engine, always available)
// ═════════════════════════════════════════════════════════════════════════════
class _ForecastTab extends ConsumerWidget {
  const _ForecastTab();

  String _kes(num v) {
    if (v >= 1000000) return 'KES ${(v / 1000000).toStringAsFixed(2)}M';
    if (v >= 1000) return 'KES ${(v / 1000).toStringAsFixed(1)}K';
    return 'KES ${v.round()}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fcAsync = ref.watch(linaForecastProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Revenue Forecast',
            subtitle:
                '7-day projection from 30-day trend (least-squares engine)',
            action: OutlinedButton.icon(
              onPressed: () => ref.invalidate(linaForecastProvider),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Recompute'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        fcAsync.when(
          data: (d) {
            final history =
                ((d['history'] as List<dynamic>?) ?? []).cast<dynamic>();
            final forecast =
                ((d['forecast'] as List<dynamic>?) ?? []).cast<dynamic>();
            final trend = (d['trend'] ?? 'flat').toString();
            final trendColor = trend == 'up'
                ? AppColors.kSuccess
                : trend == 'down'
                    ? AppColors.kError
                    : AppColors.kTextSecondary;
            final hist = history
                .map((e) => ((e as Map)['value'] as num?)?.toDouble() ?? 0)
                .toList();
            final fc = forecast
                .map((e) => ((e as Map)['value'] as num?)?.toDouble() ?? 0)
                .toList();
            return Column(children: [
              Row(children: [
                _kpiCard(
                    'Avg / Day (7d)',
                    _kes((d['avg_daily_7d'] as num?) ?? 0),
                    PhosphorIcons.chartBar(),
                    _kLinaTeal),
                const SizedBox(width: 12),
                _kpiCard(
                    'Next 7d Projection',
                    _kes((d['next_7d_projection'] as num?) ?? 0),
                    PhosphorIcons.trendUp(),
                    AppColors.kPrimary),
                const SizedBox(width: 12),
                _kpiCard(
                    'Next 30d Projection',
                    _kes((d['next_30d_projection'] as num?) ?? 0),
                    PhosphorIcons.calendar(),
                    _kLinaAccent),
                const SizedBox(width: 12),
                _kpiCard(
                    'Trend',
                    trend.toUpperCase(),
                    trend == 'down'
                        ? PhosphorIcons.trendDown()
                        : PhosphorIcons.trendUp(),
                    trendColor),
              ]),
              const SizedBox(height: 20),
              _card(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Icon(PhosphorIcons.chartLine(),
                            size: 18, color: _kLinaAccent),
                        const SizedBox(width: 8),
                        const Text('30-Day History → 7-Day Forecast',
                            style: TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w700)),
                        const Spacer(),
                        _modelChip(d),
                      ]),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 180,
                        child: CustomPaint(
                          size: Size.infinite,
                          painter:
                              _ForecastPainter(history: hist, forecast: fc),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(children: [
                        _legendDot(_kLinaAccent, 'Actual'),
                        const SizedBox(width: 16),
                        _legendDot(AppColors.kSuccess, 'Forecast'),
                      ]),
                    ]),
              ),
              const SizedBox(height: 16),
              _card(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Daily Projection',
                          style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      ...forecast.map((e) {
                        final m = e as Map;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(children: [
                            Icon(PhosphorIcons.calendarBlank(),
                                size: 14, color: AppColors.kTextSecondary),
                            const SizedBox(width: 8),
                            Text((m['date'] ?? '').toString(),
                                style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.kTextSecondary)),
                            const Spacer(),
                            Text(_kes((m['value'] as num?) ?? 0),
                                style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.kTextPrimary)),
                          ]),
                        );
                      }),
                    ]),
              ),
            ]);
          },
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaForecastProvider)),
        ),
      ]),
    );
  }

  Widget _legendDot(Color c, String label) =>
      Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label,
            style:
                const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
      ]);
}

class _ForecastPainter extends CustomPainter {
  final List<double> history;
  final List<double> forecast;
  _ForecastPainter({required this.history, required this.forecast});

  @override
  void paint(Canvas canvas, Size size) {
    final all = [...history, ...forecast];
    if (all.isEmpty) return;
    final maxV = all.reduce((a, b) => a > b ? a : b);
    final minV = all.reduce((a, b) => a < b ? a : b);
    final range = (maxV - minV).abs() < 1 ? 1 : (maxV - minV);
    final n = all.length;
    if (n < 2) return;
    final dx = size.width / (n - 1);
    Offset pt(int i, double v) =>
        Offset(i * dx, size.height - ((v - minV) / range) * size.height);

    // grid baseline
    final grid = Paint()
      ..color = const Color(0xFFEFEFF5)
      ..strokeWidth = 1;
    for (var g = 0; g <= 3; g++) {
      final y = size.height * g / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    final histPaint = Paint()
      ..color = _kLinaAccent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    final fcPaint = Paint()
      ..color = AppColors.kSuccess
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    final histPath = Path();
    for (var i = 0; i < history.length; i++) {
      final o = pt(i, history[i]);
      if (i == 0) {
        histPath.moveTo(o.dx, o.dy);
      } else {
        histPath.lineTo(o.dx, o.dy);
      }
    }
    canvas.drawPath(histPath, histPaint);

    if (forecast.isNotEmpty) {
      final fcPath = Path();
      // connect from last history point
      final startIdx = history.isNotEmpty ? history.length - 1 : 0;
      final startVal = history.isNotEmpty ? history.last : forecast.first;
      var o = pt(startIdx, startVal);
      fcPath.moveTo(o.dx, o.dy);
      for (var i = 0; i < forecast.length; i++) {
        o = pt(history.length + i, forecast[i]);
        fcPath.lineTo(o.dx, o.dy);
      }
      canvas.drawPath(fcPath, fcPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _ForecastPainter old) =>
      old.history != history || old.forecast != forecast;
}

// ═════════════════════════════════════════════════════════════════════════════
// Branch Benchmark Tab — per-branch scorecards (deterministic, always available)
// ═════════════════════════════════════════════════════════════════════════════
class _BranchBenchmarkTab extends ConsumerWidget {
  const _BranchBenchmarkTab();

  String _kes(num v) {
    if (v >= 1000000) return 'KES ${(v / 1000000).toStringAsFixed(2)}M';
    if (v >= 1000) return 'KES ${(v / 1000).toStringAsFixed(1)}K';
    return 'KES ${v.round()}';
  }

  Color _gradeColor(String g) {
    switch (g) {
      case 'A':
        return AppColors.kSuccess;
      case 'B':
        return _kLinaTeal;
      case 'C':
        return AppColors.kWarning;
      case 'D':
        return const Color(0xFFEA580C);
      default:
        return AppColors.kError;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bmAsync = ref.watch(linaBranchBenchmarkProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionHeader('Branch Benchmark',
            subtitle:
                'Ranked scorecards — revenue, compliance & occupancy (7-day)',
            action: OutlinedButton.icon(
              onPressed: () => ref.invalidate(linaBranchBenchmarkProvider),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 15),
              label: const Text('Recompute'),
              style: OutlinedButton.styleFrom(foregroundColor: _kLinaAccent),
            )),
        bmAsync.when(
          data: (cards) => cards.isEmpty
              ? _card(
                  child: const Center(
                      child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Text('No branch data available.',
                              style:
                                  TextStyle(color: AppColors.kTextSecondary)))))
              : Column(children: cards.map((c) => _buildCard(c)).toList()),
          loading: () => _loadingCard(),
          error: (e, _) =>
              _errorCard(e, () => ref.invalidate(linaBranchBenchmarkProvider)),
        ),
      ]),
    );
  }

  Widget _buildCard(Map<String, dynamic> c) {
    final grade = (c['grade'] ?? '—').toString();
    final gc = _gradeColor(grade);
    final rank = c['rank'] ?? 0;
    final score = (c['score'] as num?) ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _card(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                  color: _kLinaAccent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(9)),
              child: Text('#$rank',
                  style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: _kLinaAccent)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text((c['name'] ?? '').toString(),
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.kTextPrimary)),
                    Text(
                        '${(c['status'] ?? '').toString()} · ${c['shifts'] ?? 0} shifts',
                        style: const TextStyle(
                            fontSize: 11.5, color: AppColors.kTextSecondary)),
                  ]),
            ),
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                  color: gc.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12)),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(grade,
                    style: TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 18, color: gc)),
                Text('${score.round()}',
                    style: TextStyle(
                        fontSize: 9, color: gc, fontWeight: FontWeight.w600)),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (score / 100).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: gc.withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation(gc),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(spacing: 18, runSpacing: 8, children: [
            _metric('Revenue 7d', _kes((c['revenue_7d'] as num?) ?? 0),
                PhosphorIcons.currencyDollar(), _kLinaTeal),
            _metric('Occupancy', '${c['occupancy_pct'] ?? 0}%',
                PhosphorIcons.bed(), AppColors.kPrimary),
            _metric(
                'Discrepancies',
                '${c['discrepancy_shifts'] ?? 0}',
                PhosphorIcons.warning(),
                ((c['discrepancy_shifts'] as num?) ?? 0) > 0
                    ? AppColors.kWarning
                    : AppColors.kSuccess),
            _metric(
                'Voids',
                '${c['voids'] ?? 0}',
                PhosphorIcons.prohibit(),
                ((c['voids'] as num?) ?? 0) > 0
                    ? AppColors.kError
                    : AppColors.kSuccess),
            _metric(
                'Critical',
                '${c['critical'] ?? 0}',
                PhosphorIcons.shieldWarning(),
                ((c['critical'] as num?) ?? 0) > 0
                    ? AppColors.kError
                    : AppColors.kSuccess),
          ]),
        ]),
      ),
    );
  }

  Widget _metric(String label, String value, IconData icon, Color color) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 15, color: color),
      const SizedBox(width: 6),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value,
            style: TextStyle(
                fontSize: 13.5, fontWeight: FontWeight.w700, color: color)),
        Text(label,
            style: const TextStyle(
                fontSize: 10.5, color: AppColors.kTextSecondary)),
      ]),
    ]);
  }
}
