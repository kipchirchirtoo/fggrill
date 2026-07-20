import 'package:flutter/material.dart';

/// A horizontally scrollable content area with a second, always-visible
/// scrollbar track pinned at the bottom of the widget.
class StickyHorizontalScrollbar extends StatefulWidget {
  const StickyHorizontalScrollbar({
    super.key,
    required this.contentWidth,
    required this.child,
    this.bottomSpacing = 12,
    this.scrollbarThickness = 12,
    this.barHeight = 18,
  });

  final double contentWidth;
  final Widget child;
  final double bottomSpacing;
  final double scrollbarThickness;
  final double barHeight;

  @override
  State<StickyHorizontalScrollbar> createState() =>
      _StickyHorizontalScrollbarState();
}

class _StickyHorizontalScrollbarState extends State<StickyHorizontalScrollbar> {
  late final ScrollController _contentController;
  late final ScrollController _barController;
  bool _syncingFromContent = false;
  bool _syncingFromBar = false;

  @override
  void initState() {
    super.initState();
    _contentController = ScrollController()..addListener(_syncBarFromContent);
    _barController = ScrollController()..addListener(_syncContentFromBar);
  }

  @override
  void dispose() {
    _contentController
      ..removeListener(_syncBarFromContent)
      ..dispose();
    _barController
      ..removeListener(_syncContentFromBar)
      ..dispose();
    super.dispose();
  }

  void _syncBarFromContent() {
    if (_syncingFromBar || !_barController.hasClients) return;
    final target = _contentController.offset.clamp(
      _barController.position.minScrollExtent,
      _barController.position.maxScrollExtent,
    );
    _syncingFromContent = true;
    _barController.jumpTo(target);
    _syncingFromContent = false;
  }

  void _syncContentFromBar() {
    if (_syncingFromContent || !_contentController.hasClients) return;
    final target = _barController.offset.clamp(
      _contentController.position.minScrollExtent,
      _contentController.position.maxScrollExtent,
    );
    _syncingFromBar = true;
    _contentController.jumpTo(target);
    _syncingFromBar = false;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RawScrollbar(
          controller: _contentController,
          thumbVisibility: true,
          trackVisibility: true,
          thickness: widget.scrollbarThickness,
          radius: const Radius.circular(8),
          notificationPredicate: (notification) =>
              notification.metrics.axis == Axis.horizontal,
          child: SingleChildScrollView(
            controller: _contentController,
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: widget.contentWidth,
              child: widget.child,
            ),
          ),
        ),
        SizedBox(height: widget.bottomSpacing),
        SizedBox(
          height: widget.barHeight,
          child: RawScrollbar(
            controller: _barController,
            thumbVisibility: true,
            trackVisibility: true,
            thickness: widget.scrollbarThickness,
            radius: const Radius.circular(8),
            child: SingleChildScrollView(
              controller: _barController,
              scrollDirection: Axis.horizontal,
              child: SizedBox(
                width: widget.contentWidth,
                height: 1,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
