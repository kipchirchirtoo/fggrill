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
            ColoredBox(
              color: const Color(0xFFE5E7EB),
              child: Center(
                child: Icon(
                  Icons.image_not_supported_outlined,
                  color: Colors.black.withValues(alpha: 0.35),
                  size: 24,
                ),
              ),
            );
      },
    );
  }
}
