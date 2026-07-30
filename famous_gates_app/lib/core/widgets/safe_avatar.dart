import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../theme/app_theme.dart';

class SafeAvatar extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double radius;
  final Color backgroundColor;
  final Color foregroundColor;

  const SafeAvatar({
    super.key,
    required this.imageUrl,
    required this.name,
    this.radius = 14,
    this.backgroundColor = AppColors.kPrimary,
    this.foregroundColor = Colors.white,
  });

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim() ?? '';
    final fallback = CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor,
      child: Text(
        name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : '?',
        style: TextStyle(
          color: foregroundColor,
          fontSize: radius * 0.72,
          fontWeight: FontWeight.bold,
        ),
      ),
    );

    final uri = Uri.tryParse(url);
    if (url.isEmpty ||
        uri == null ||
        !uri.hasScheme ||
        (uri.scheme != 'http' && uri.scheme != 'https')) {
      return fallback;
    }

    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: url,
        width: radius * 2,
        height: radius * 2,
        fit: BoxFit.cover,
        fadeInDuration: Duration.zero,
        fadeOutDuration: Duration.zero,
        placeholder: (_, __) => fallback,
        errorWidget: (_, __, ___) => fallback,
      ),
    );
  }
}
