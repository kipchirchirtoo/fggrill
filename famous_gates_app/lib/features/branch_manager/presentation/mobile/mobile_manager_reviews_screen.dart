import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_notifier.dart';
import '../../data/repository.dart';

class ManagerReview {
  final String id;
  final String location;
  final String reviewText;
  final int rating;
  final String date;
  final String reviewer;
  final String? reviewerEmail;
  bool responded;
  String? responseText;
  final String sentiment;
  final double sentimentConfidence;
  final List<String> issues;

  ManagerReview({
    required this.id,
    required this.location,
    required this.reviewText,
    required this.rating,
    required this.date,
    required this.reviewer,
    this.reviewerEmail,
    required this.responded,
    this.responseText,
    required this.sentiment,
    required this.sentimentConfidence,
    required this.issues,
  });

  /// Maps GET /reviews/manager/list's row shape (backend/src/controllers/
  /// reviews.controller.ts) onto this UI model.
  factory ManagerReview.fromJson(Map<String, dynamic> json) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    String formattedDate = '${json['created_at'] ?? ''}';
    final parsed = DateTime.tryParse('${json['created_at'] ?? ''}');
    if (parsed != null) {
      formattedDate =
          '${months[parsed.month - 1]} ${parsed.day.toString().padLeft(2, '0')}, ${parsed.year}';
    }
    final issuesRaw = json['issues_mentioned'];
    return ManagerReview(
      id: '${json['id'] ?? ''}',
      location: '${json['branch_label'] ?? 'Unknown branch'}',
      reviewText: '${json['content'] ?? ''}',
      rating: int.tryParse('${json['rating'] ?? 0}') ?? 0,
      date: formattedDate,
      reviewer: '${json['reviewer_name'] ?? 'Guest'}',
      reviewerEmail: json['reviewer_email'] as String?,
      responded: json['responded'] == true,
      responseText: json['response_text'] as String?,
      sentiment: '${json['sentiment'] ?? 'Neutral'}',
      sentimentConfidence:
          double.tryParse('${json['sentiment_confidence'] ?? 0}') ?? 0,
      issues: issuesRaw is List
          ? issuesRaw.map((e) => '$e').toList()
          : const [],
    );
  }
}

class MobileManagerReviewsScreen extends ConsumerStatefulWidget {
  const MobileManagerReviewsScreen({super.key});

  @override
  ConsumerState<MobileManagerReviewsScreen> createState() =>
      _MobileManagerReviewsScreenState();
}

class _MobileManagerReviewsScreenState
    extends ConsumerState<MobileManagerReviewsScreen> {
  List<ManagerReview> _reviews = [];
  bool _loading = true;
  String? _error;

  BranchManagerRepository get _repo =>
      ref.read(branchManagerRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _repo.getReviews();
      if (!mounted) return;
      setState(() {
        _reviews = rows.map(ManagerReview.fromJson).toList();
        _loading = false;
        // The Listing dropdown's items are derived from _reviews (see
        // _listingOptions) — reset its selection so it can't end up
        // pointing at a value that no longer exists in the new list.
        _selectedListing = 'All';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load reviews: $e';
        _loading = false;
      });
    }
  }

  // Filters State
  String _selectedAccount = 'All';
  String _selectedListing = 'All';
  String _selectedResponded = 'All';
  String _selectedRating = 'All';
  String _searchQuery = '';

  // Controllers
  final _searchController = TextEditingController();

  List<String> get _listingOptions {
    final labels = _reviews.map((r) => r.location).toSet().toList()..sort();
    return ['All', ...labels];
  }

  List<ManagerReview> get _filteredReviews {
    return _reviews.where((rev) {
      // Search query
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchesText = rev.reviewText.toLowerCase().contains(q);
        final matchesReviewer = rev.reviewer.toLowerCase().contains(q);
        final matchesLocation = rev.location.toLowerCase().contains(q);
        if (!matchesText && !matchesReviewer && !matchesLocation) return false;
      }

      // Responded filter
      if (_selectedResponded == 'Responded' && !rev.responded) return false;
      if (_selectedResponded == 'Not Responded' && rev.responded) return false;

      // Rating filter
      if (_selectedRating != 'All') {
        final expectedStars = int.tryParse(_selectedRating.split(' ').first);
        if (expectedStars != null && rev.rating != expectedStars) {
          return false;
        }
      }

      // Listing filter — options are the actual branch labels present in
      // the loaded reviews (see _listingOptions), not a hardcoded guess.
      if (_selectedListing != 'All' && rev.location != _selectedListing) {
        return false;
      }

      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final displayed = _filteredReviews;

    return Container(
      color: const Color(0xFFF9FAFC),
      child: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title Header mimicking the uploaded UI
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Review Management',
                  style: TextStyle(
                    fontSize: 32,
                    fontFamily: 'SF Pro Display',
                    fontWeight: FontWeight.w300,
                    color: Color(0xFF2C3E50),
                  ),
                ),
                IconButton(
                  onPressed: _loading ? null : _load,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh',
                ),
              ],
            ),
            const SizedBox(height: 24),

            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFDECEA),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFF5C6CB)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Color(0xFFB91C1C)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(_error!,
                          style: const TextStyle(color: Color(0xFFB91C1C))),
                    ),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),

            // Google UI-style filters row
            _buildFiltersCard(),
            const SizedBox(height: 16),

            // Copy/CSV/Print toolbar & Search box
            _buildToolbarAndSearch(),
            const SizedBox(height: 16),

            // Review list / Datatable container
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 64),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              _buildReviewsTableCard(displayed),
          ],
        ),
        ),
      ),
    );
  }

  Widget _buildFiltersCard() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Wrap(
          spacing: 24,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _buildDropdownFilter(
              label: 'Google Account',
              value: _selectedAccount,
              items: ['All', 'Primary Account', 'Secondary Account'],
              onChanged: (v) => setState(() => _selectedAccount = v!),
            ),
            _buildDropdownFilter(
              label: 'Listing',
              value: _selectedListing,
              items: _listingOptions,
              onChanged: (v) => setState(() => _selectedListing = v!),
            ),
            _buildDropdownFilter(
              label: 'Responded',
              value: _selectedResponded,
              items: ['All', 'Responded', 'Not Responded'],
              onChanged: (v) => setState(() => _selectedResponded = v!),
            ),
            _buildDropdownFilter(
              label: 'Rating',
              value: _selectedRating,
              items: [
                'All',
                '5 Stars',
                '4 Stars',
                '3 Stars',
                '2 Stars',
                '1 Star'
              ],
              onChanged: (v) => setState(() => _selectedRating = v!),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDropdownFilter({
    required String label,
    required String value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$label  ',
          style: const TextStyle(
            fontSize: 13,
            color: Color(0xFF7F8C8D),
            fontWeight: FontWeight.w500,
          ),
        ),
        Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F9FA),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: const Color(0xFFDCDDE1)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isDense: true,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF2C3E50),
                fontWeight: FontWeight.bold,
              ),
              items: items
                  .map((i) => DropdownMenuItem(value: i, child: Text(i)))
                  .toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildToolbarAndSearch() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Action buttons
        Wrap(
          spacing: 6,
          children: ['Copy', 'CSV', 'Excel', 'PDF', 'Print'].map((btn) {
            return OutlinedButton(
              onPressed: () {
                AppNotifier.showSnackBar(
                  context,
                  SnackBar(content: Text('Exported matching data as $btn')),
                );
              },
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(60, 32),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(4),
                ),
                side: const BorderSide(color: Color(0xFFDCDDE1)),
                foregroundColor: const Color(0xFF57606F),
                textStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: Text(btn),
            );
          }).toList(),
        ),

        // Search text box on right
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Search: ',
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF7F8C8D),
              ),
            ),
            Container(
              width: 180,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: const Color(0xFFDCDDE1)),
              ),
              child: TextField(
                controller: _searchController,
                style: const TextStyle(fontSize: 13),
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.only(left: 8, bottom: 12),
                ),
                onChanged: (v) {
                  setState(() => _searchQuery = v);
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildReviewsTableCard(List<ManagerReview> displayed) {
    return Card(
      elevation: 1,
      color: Colors.white,
      shadowColor: Colors.black.withValues(alpha: 0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(6),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Grid Headers matching the uploaded image exactly
            Container(
              decoration: const BoxDecoration(
                color: Color(0xFFFCFCFD),
                border: Border(bottom: BorderSide(color: Color(0xFFECEFF1))),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: const Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: Text('Location',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: Color(0xFF2C3E50))),
                  ),
                  Expanded(
                    flex: 4,
                    child: Text('Review',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: Color(0xFF2C3E50))),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text('Rating',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: Color(0xFF2C3E50))),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text('Review Date & Reviewer',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: Color(0xFF2C3E50))),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text('Responded',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: Color(0xFF2C3E50))),
                  ),
                  SizedBox(
                    width: 80,
                    child: Text('Actions',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: Color(0xFF2C3E50)),
                        textAlign: TextAlign.center),
                  ),
                ],
              ),
            ),

            // Rows
            if (displayed.isEmpty)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(
                  child: Text(
                    'No reviews match the selected filters.',
                    style: TextStyle(color: Color(0xFF7F8C8D), fontSize: 14),
                  ),
                ),
              )
            else
              ...displayed.asMap().entries.map((entry) {
                final idx = entry.key;
                final rev = entry.value;
                final isEven = idx % 2 == 0;

                return Container(
                  decoration: BoxDecoration(
                    color: isEven ? Colors.white : const Color(0xFFF9FAFC),
                    border: const Border(
                        bottom: BorderSide(color: Color(0xFFECEFF1))),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Location
                      Expanded(
                        flex: 2,
                        child: Text(
                          rev.location,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF57606F),
                          ),
                        ),
                      ),

                      // Review (Blue clickable text matching uploaded UI)
                      Expanded(
                        flex: 4,
                        child: Padding(
                          padding: const EdgeInsets.only(right: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              GestureDetector(
                                onTap: () => _openResponseDialog(rev),
                                child: Text(
                                  rev.reviewText,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF2980B9),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              if (rev.responded &&
                                  rev.responseText != null) ...[
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF1F2F6),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                        color: const Color(0xFFE4E7EB)),
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.reply,
                                          size: 14, color: Color(0xFF7F8C8D)),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          'Response: ${rev.responseText}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontStyle: FontStyle.italic,
                                            color: Color(0xFF57606F),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),

                      // Rating (Stars row matching uploaded UI)
                      Expanded(
                        flex: 2,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: List.generate(5, (star) {
                            return Icon(
                              Icons.star,
                              size: 15,
                              color: star < rev.rating
                                  ? const Color(0xFFFFBE21)
                                  : const Color(0xFFE2E8F0),
                            );
                          }),
                        ),
                      ),

                      // Review Date & Reviewer (Stacked layout matching uploaded UI)
                      Expanded(
                        flex: 2,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              rev.date,
                              style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFF57606F),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              rev.reviewer,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF7F8C8D),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Responded Status (Green/Grey pill button matching uploaded UI)
                      Expanded(
                        flex: 2,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: rev.responded
                                  ? const Color(0xFF2ECC71)
                                  : const Color(0xFF95A5A6),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(
                              rev.responded ? 'RESPONDED' : 'NOT RESPONDED',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ),

                      // Action Button (Orange pen edit button matching uploaded UI exactly)
                      SizedBox(
                        width: 80,
                        child: Center(
                          child: InkWell(
                            onTap: () => _openResponseDialog(rev),
                            borderRadius: BorderRadius.circular(4),
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFB822),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Icon(
                                Icons.edit,
                                size: 16,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  // --- Open Response & Sentiment Analysis Dialog ---
  void _openResponseDialog(ManagerReview review) {
    final responseController = TextEditingController(text: review.responseText);
    String selectedEscalation = 'None';
    bool isSubmitting = false;
    final screenContext = context;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (dialogContext, setDialogState) {
          return AlertDialog(
            title: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Public Reply & Sentiment Audit'),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            content: SizedBox(
              width: 580,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Sentiment Analysis card (AI Feature)
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F1FD),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFE0DAFB)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.psychology,
                                  color: Color(0xFF6200EE)),
                              const SizedBox(width: 8),
                              const Text(
                                'Smart AI Sentiment Insights',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: Color(0xFF6200EE),
                                ),
                              ),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: review.sentiment == 'Positive'
                                      ? Colors.green.shade50
                                      : review.sentiment == 'Neutral'
                                          ? Colors.amber.shade50
                                          : Colors.red.shade50,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text(
                                  '${review.sentiment} (${review.sentimentConfidence}%)',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: review.sentiment == 'Positive'
                                        ? Colors.green.shade800
                                        : review.sentiment == 'Neutral'
                                            ? Colors.amber.shade800
                                            : Colors.red.shade800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: review.issues.map((issue) {
                              return Chip(
                                label: Text(issue,
                                    style: const TextStyle(fontSize: 11)),
                                visualDensity: VisualDensity.compact,
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Review Quote
                    const Text(
                      'Review Content:',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: Color(0xFF7F8C8D)),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '"${review.reviewText}"',
                      style: const TextStyle(
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: Color(0xFF2C3E50),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Public Response Input
                    const Text(
                      'Your Public Response (Visible on Booking Portal & Landing Page):',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: Color(0xFF2C3E50)),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: responseController,
                      maxLines: 4,
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        hintText: 'Thank you for your feedback...',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.all(12),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Internal Escalation option
                    Row(
                      children: [
                        const Text(
                          'Internal Escalation Tag: ',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF7F8C8D)),
                        ),
                        const SizedBox(width: 12),
                        DropdownButton<String>(
                          value: selectedEscalation,
                          style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF2C3E50),
                              fontWeight: FontWeight.bold),
                          items: [
                            'None',
                            'Food & Beverage',
                            'Front Office',
                            'General Manager',
                            'Facilities'
                          ]
                              .map((i) =>
                                  DropdownMenuItem(value: i, child: Text(i)))
                              .toList(),
                          onChanged: (v) {
                            setDialogState(() => selectedEscalation = v!);
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: isSubmitting
                    ? null
                    : () async {
                        setDialogState(() => isSubmitting = true);
                        final responseText = responseController.text.trim();
                        try {
                          await _repo.respondToReview(review.id, responseText);
                          if (!mounted) return;
                          setState(() {
                            review.responded = responseText.isNotEmpty;
                            review.responseText =
                                responseText.isEmpty ? null : responseText;
                          });
                          if (!dialogContext.mounted) return;
                          Navigator.pop(dialogContext);
                          if (!screenContext.mounted) return;
                          ScaffoldMessenger.of(screenContext).showSnackBar(
                            const SnackBar(
                                content:
                                    Text('Response published successfully!')),
                          );
                        } catch (e) {
                          setDialogState(() => isSubmitting = false);
                          if (!dialogContext.mounted) return;
                          ScaffoldMessenger.of(dialogContext).showSnackBar(
                            SnackBar(
                                content: Text('Failed to publish response: $e')),
                          );
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                ),
                child: isSubmitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Publish Response'),
              ),
            ],
          );
        });
      },
    );
  }
}
