import 'package:flutter/material.dart';

class SafeAssetImage extends StatelessWidget {
  const SafeAssetImage(
    this.assetName, {
    super.key,
    this.width,
    this.height,
    this.fit,
    this.alignment = Alignment.center,
    this.fallback,
  });

  final String assetName;
  final double? width;
  final double? height;
  final BoxFit? fit;
  final AlignmentGeometry alignment;
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      assetName,
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      errorBuilder: (context, error, stackTrace) {
        debugPrint('Asset image unavailable: $assetName ($error)');
        return fallback ??
            Container(
              width: width,
              height: height,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF0F172A),
                    Color(0xFF1E293B),
                    Color(0xFF0A0F1D),
                  ],
                ),
              ),
              child: Center(
                child: Icon(
                  Icons.hotel_outlined,
                  color: Colors.white.withValues(alpha: 0.15),
                  size: 28,
                ),
              ),
            );
      },
    );
  }
}
