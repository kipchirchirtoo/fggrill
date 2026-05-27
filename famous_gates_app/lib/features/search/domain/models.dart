import 'package:flutter/material.dart';

class SearchResult {
  final String type;
  final String id;
  final String title;
  final String subtitle;
  final Map<String, dynamic>? metadata;

  const SearchResult({
    required this.type,
    required this.id,
    required this.title,
    required this.subtitle,
    this.metadata,
  });

  factory SearchResult.fromJson(Map<String, dynamic> json) {
    return SearchResult(
      type: '${json['type'] ?? 'unknown'}',
      id: '${json['id'] ?? ''}',
      title: '${json['title'] ?? ''}',
      subtitle: '${json['subtitle'] ?? ''}',
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  IconData get icon {
    switch (type) {
      case 'staff':
        return Icons.badge;
      case 'guest':
        return Icons.person;
      case 'booking':
        return Icons.calendar_today;
      case 'order':
        return Icons.receipt_long;
      case 'bill':
        return Icons.receipt;
      case 'transaction':
        return Icons.swap_horiz;
      case 'receipt':
        return Icons.receipt;
      case 'payment':
        return Icons.payments;
      default:
        return Icons.search;
    }
  }

  Color get color {
    switch (type) {
      case 'staff':
        return Colors.blue;
      case 'guest':
        return Colors.teal;
      case 'booking':
        return Colors.purple;
      case 'order':
        return Colors.green;
      case 'bill':
        return Colors.orange;
      case 'transaction':
        return Colors.indigo;
      case 'receipt':
        return Colors.amber;
      case 'payment':
        return Colors.cyan;
      default:
        return Colors.grey;
    }
  }
}

class SearchResponse {
  final List<SearchResult> results;
  final int count;
  final String query;

  const SearchResponse({
    required this.results,
    required this.count,
    required this.query,
  });

  factory SearchResponse.fromJson(Map<String, dynamic> json) {
    final rawData = json['data'] as List? ?? [];
    return SearchResponse(
      results: rawData
          .whereType<Map>()
          .map((e) => SearchResult.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      count: (json['count'] as num?)?.toInt() ?? 0,
      query: '${json['query'] ?? ''}',
    );
  }
}
