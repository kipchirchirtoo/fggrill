import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_notifier.dart';

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
}

class MobileManagerReviewsScreen extends ConsumerStatefulWidget {
  const MobileManagerReviewsScreen({super.key});

  @override
  ConsumerState<MobileManagerReviewsScreen> createState() =>
      _MobileManagerReviewsScreenState();
}

class _MobileManagerReviewsScreenState
    extends ConsumerState<MobileManagerReviewsScreen> {
  // Mock Data mimicking the image and incorporating requirements
  final List<ManagerReview> _reviews = [
    ManagerReview(
      id: 'rev-1',
      location: 'FamousGate Cafe, Kericho',
      reviewText:
          'Great coffee, lovely staff, and good karma in each cup! ☕ Thank you x',
      rating: 5,
      date: 'June 10, 2026',
      reviewer: 'Andrea Howard',
      responded: false,
      sentiment: 'Positive',
      sentimentConfidence: 98.4,
      issues: ['Friendly staff', 'Clean rooms', 'Fast service'],
    ),
    ManagerReview(
      id: 'rev-2',
      location: 'FamousGate Hotel, Bomet',
      reviewText:
          'Great coffee, friendly service. We enjoyed our family brunch immensely.',
      rating: 5,
      date: 'June 14, 2026',
      reviewer: 'Carl Conder',
      responded: true,
      responseText:
          'Thank you Carl! We appreciate your wonderful feedback about our coffee and team.',
      sentiment: 'Positive',
      sentimentConfidence: 97.2,
      issues: ['Friendly staff', 'Good food'],
    ),
    ManagerReview(
      id: 'rev-3',
      location: 'FamousGate Cafe, Kericho',
      reviewText:
          'These guys know what they are doing. Awesome coffee served with genuine friendliness. Will definitely be back.',
      rating: 5,
      date: 'May 04, 2026',
      reviewer: 'Liz Leys',
      responded: true,
      responseText:
          'Dear Liz, thank you so much for your support! We look forward to welcoming you back.',
      sentiment: 'Positive',
      sentimentConfidence: 99.1,
      issues: ['Friendly staff', 'Fast service'],
    ),
    ManagerReview(
      id: 'rev-4',
      location: 'FamousGate Hotel, Kericho',
      reviewText:
          'The coffee selection was really well down. The staff were very friendly and helped us out through the experience. Would do it again',
      rating: 5,
      date: 'November 17, 2025',
      reviewer: 'Griffin Davis (s5157369)',
      responded: false,
      sentiment: 'Positive',
      sentimentConfidence: 95.8,
      issues: ['Friendly staff', 'Comfortable beds'],
    ),
    ManagerReview(
      id: 'rev-5',
      location: 'FamousGate Cafe, Bomet',
      reviewText:
          'THE best coffee, I have EVER had! And of course an AMAZING atmosphere!',
      rating: 5,
      date: 'June 05, 2025',
      reviewer: 'Hailey Grey',
      responded: true,
      responseText: 'Thank you Hailey! We are thrilled to be your top choice!',
      sentiment: 'Positive',
      sentimentConfidence: 99.5,
      issues: ['Quiet environment', 'Nice Wi-Fi'],
    ),
    ManagerReview(
      id: 'rev-6',
      location: 'FamousGate Hotel, Bomet',
      reviewText:
          'The room was average, but checkout took too long and the food was delayed by over 40 minutes. Breakfast was good though.',
      rating: 3,
      date: 'June 16, 2025',
      reviewer: 'Hazel Mwetwa',
      responded: true,
      responseText:
          'Dear Hazel, we apologize for the check-out and kitchen delay. We are actively working to speed up these flows.',
      sentiment: 'Neutral',
      sentimentConfidence: 86.4,
      issues: ['Delayed food', 'Slow check-in'],
    ),
    ManagerReview(
      id: 'rev-7',
      location: 'FamousGate Hotel, Kericho',
      reviewText:
          'Cold water in the shower, and room had a strong paint smell. Wi-Fi was also completely down in my wing.',
      rating: 1,
      date: 'May 20, 2025',
      reviewer: 'Peter Mwangi',
      responded: false,
      sentiment: 'Negative',
      sentimentConfidence: 94.2,
      issues: ['Cold shower', 'Delayed food', 'Slow service'],
    ),
  ];

  // Filters State
  String _selectedAccount = 'All';
  String _selectedListing = 'All';
  String _selectedResponded = 'All';
  String _selectedRating = 'All';
  String _searchQuery = '';

  // Controllers
  final _searchController = TextEditingController();

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

      // Listing filter (Location-based)
      if (_selectedListing == 'Kericho Only' &&
          !rev.location.contains('Kericho')) {
        return false;
      }
      if (_selectedListing == 'Bomet Only' && !rev.location.contains('Bomet')) {
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
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title Header mimicking the uploaded UI
            const Text(
              'Review Management',
              style: TextStyle(
                fontSize: 32,
                fontFamily: 'SF Pro Display',
                fontWeight: FontWeight.w300,
                color: Color(0xFF2C3E50),
              ),
            ),
            const SizedBox(height: 24),

            // Google UI-style filters row
            _buildFiltersCard(),
            const SizedBox(height: 16),

            // Copy/CSV/Print toolbar & Search box
            _buildToolbarAndSearch(),
            const SizedBox(height: 16),

            // Review list / Datatable container
            _buildReviewsTableCard(displayed),
          ],
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
              items: ['All', 'Kericho Only', 'Bomet Only'],
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
                    : () {
                        setDialogState(() => isSubmitting = true);
                        final responseText = responseController.text.trim();
                        Future.delayed(const Duration(milliseconds: 600), () {
                          if (!mounted) return;
                          setState(() {
                            review.responded = responseText.isNotEmpty;
                            review.responseText =
                                responseText.isEmpty ? null : responseText;
                          });
                          if (!mounted || !dialogContext.mounted) return;
                          Navigator.pop(dialogContext);
                        });
                        Future.delayed(const Duration(milliseconds: 700), () {
                          if (!mounted || !screenContext.mounted) return;
                          ScaffoldMessenger.of(screenContext).showSnackBar(
                            const SnackBar(
                                content:
                                    Text('Response published successfully!')),
                          );
                        });
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
