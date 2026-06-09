import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/lina_repository.dart';
import '../../../core/network/dio_client.dart';

final linaRepositoryProvider = Provider<LinaRepository>((ref) {
  return LinaRepository(ref.read(dioProvider));
});

final linaContextProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(linaRepositoryProvider).getContext();
});

final linaMonitoringProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(linaRepositoryProvider).getMonitoring();
});

final linaExecutiveSummaryProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(linaRepositoryProvider).getExecutiveSummary();
});

final linaAnomalyReportProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(linaRepositoryProvider).getAnomalyReport();
});

final linaIncidentTimelineProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(linaRepositoryProvider).getIncidentTimeline();
});

final linaEmployeeIntelProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(linaRepositoryProvider).getEmployeeIntelligence();
});

final linaFinancialIntelProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(linaRepositoryProvider).getFinancialIntelligence();
});

final linaRecommendationsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(linaRepositoryProvider).getRecommendations();
});

final linaPendingRemediationsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(linaRepositoryProvider).getPendingRemediations();
});

final linaBranchBenchmarkProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(linaRepositoryProvider).getBranchBenchmark();
});

final linaForecastProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(linaRepositoryProvider).getForecast();
});

// ── Chat state ─────────────────────────────────────────────────────────────

class ChatMessage {
  final String role; // 'user' | 'assistant'
  final String content;
  final bool isStreaming;

  const ChatMessage({
    required this.role,
    required this.content,
    this.isStreaming = false,
  });

  ChatMessage copyWith({String? content, bool? isStreaming}) => ChatMessage(
        role: role,
        content: content ?? this.content,
        isStreaming: isStreaming ?? this.isStreaming,
      );
}

class ChatNotifier extends StateNotifier<List<ChatMessage>> {
  ChatNotifier() : super([]);

  void addUserMessage(String text) {
    state = [...state, ChatMessage(role: 'user', content: text)];
  }

  void startAssistantMessage() {
    state = [
      ...state,
      const ChatMessage(role: 'assistant', content: '', isStreaming: true)
    ];
  }

  void appendToLastAssistant(String delta) {
    if (state.isEmpty) return;
    final last = state.last;
    state = [
      ...state.sublist(0, state.length - 1),
      last.copyWith(content: last.content + delta),
    ];
  }

  void finishAssistantMessage() {
    if (state.isEmpty) return;
    final last = state.last;
    state = [
      ...state.sublist(0, state.length - 1),
      last.copyWith(isStreaming: false),
    ];
  }

  void clear() => state = [];
}

final chatProvider =
    StateNotifierProvider<ChatNotifier, List<ChatMessage>>((ref) => ChatNotifier());

final chatLoadingProvider = StateProvider<bool>((ref) => false);
