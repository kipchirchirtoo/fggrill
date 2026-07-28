import 'package:flutter/material.dart';

/// A horizontally scrollable content area with a second, always-visible
/// scrollbar track pinned at the bottom of the widget.
class StickyHorizontalScrollbar extends StatefulWidget {
  const StickyHorizontalScrollbar({
    super.key,
    required this.contentWidth,
    required this.child,
    this.bottomSpacing = 12,
    this.topSpacing = 8,
    this.scrollbarThickness = 12,
    this.barHeight = 28,
  });

  final double contentWidth;
  final Widget child;
  final double bottomSpacing;
  final double topSpacing;
  final double scrollbarThickness;
  final double barHeight;

  @override
  State<StickyHorizontalScrollbar> createState() =>
      _StickyHorizontalScrollbarState();
}

class _StickyHorizontalScrollbarState extends State<StickyHorizontalScrollbar> {
  late final ScrollController _contentController;
  late final ScrollController _topBarController;
  late final ScrollController _bottomBarController;
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    _contentController = ScrollController()..addListener(_syncFromContent);
    _topBarController = ScrollController()..addListener(_syncFromTopBar);
    _bottomBarController =
        ScrollController()..addListener(_syncFromBottomBar);
  }

  @override
  void dispose() {
    _contentController
      ..removeListener(_syncFromContent)
      ..dispose();
    _topBarController
      ..removeListener(_syncFromTopBar)
      ..dispose();
    _bottomBarController
      ..removeListener(_syncFromBottomBar)
      ..dispose();
    super.dispose();
  }

  void _syncFromContent() {
    _syncControllers(
      source: _contentController,
      targets: [_topBarController, _bottomBarController],
    );
  }

  void _syncFromTopBar() {
    _syncControllers(
      source: _topBarController,
      targets: [_contentController, _bottomBarController],
    );
  }

  void _syncFromBottomBar() {
    _syncControllers(
      source: _bottomBarController,
      targets: [_contentController, _topBarController],
    );
  }

  void _syncControllers({
    required ScrollController source,
    required List<ScrollController> targets,
  }) {
    if (_syncing || !source.hasClients) return;

    _syncing = true;
    final sourceOffset = source.offset;
    for (final target in targets) {
      if (!target.hasClients) continue;
      final clamped = sourceOffset.clamp(
        target.position.minScrollExtent,
        target.position.maxScrollExtent,
      );
      if ((target.offset - clamped).abs() > 0.5) {
        target.jumpTo(clamped);
      }
    }
    _syncing = false;
  }

  Future<void> _nudgeScroll(double delta) async {
    if (!_contentController.hasClients) return;
    final target = (_contentController.offset + delta).clamp(
      _contentController.position.minScrollExtent,
      _contentController.position.maxScrollExtent,
    );
    await _contentController.animateTo(
      target,
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
    );
  }

  Widget _buildScrollRail({
    required ScrollController controller,
    required String semanticsLabel,
  }) {
    const trackColor = Color(0xFFE3E8EF);
    const thumbColor = Color(0xFF1A3C5E);
    final railExtent = widget.scrollbarThickness + 10;

    return Container(
      height: widget.barHeight,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F4EC),
        border: Border.all(color: const Color(0xFFD8DDE6)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Scroll left',
            onPressed: () => _nudgeScroll(-280),
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            icon: const Icon(
              Icons.arrow_back_rounded,
              size: 16,
              color: Color(0xFF1A3C5E),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: RawScrollbar(
              controller: controller,
              interactive: true,
              thumbVisibility: true,
              trackVisibility: true,
              thickness: widget.scrollbarThickness,
              radius: const Radius.circular(999),
              thumbColor: thumbColor,
              trackColor: trackColor,
              trackBorderColor: trackColor,
              minThumbLength: 72,
              child: SingleChildScrollView(
                controller: controller,
                scrollDirection: Axis.horizontal,
                physics: const ClampingScrollPhysics(),
                child: Semantics(
                  label: semanticsLabel,
                  child: SizedBox(
                    width: widget.contentWidth,
                    height: railExtent,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Scroll right',
            onPressed: () => _nudgeScroll(280),
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            icon: const Icon(
              Icons.arrow_forward_rounded,
              size: 16,
              color: Color(0xFF1A3C5E),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // This widget is used in two very different parents:
    //  1) a bounded-height slot (e.g. the dashboard shell's Expanded), where
    //     the content area should FILL the remaining height and scroll; and
    //  2) inside a vertical scrollable (ListView / Column / SingleChildScroll),
    //     which hands down an UNBOUNDED height. Using Expanded there throws
    //     "RenderFlex children have non-zero flex but incoming height
    //     constraints are unbounded" and crashes layout.
    // Adapt to the incoming constraints: fill with Expanded when bounded,
    // shrink-wrap to the child's intrinsic height when unbounded.
    return LayoutBuilder(
      builder: (context, constraints) {
        final bounded = constraints.hasBoundedHeight;
        final content = ClipRect(
          child: SingleChildScrollView(
            controller: _contentController,
            scrollDirection: Axis.horizontal,
            physics: const ClampingScrollPhysics(),
            child: SizedBox(
              width: widget.contentWidth,
              child: widget.child,
            ),
          ),
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: bounded ? MainAxisSize.max : MainAxisSize.min,
          children: [
            _buildScrollRail(
              controller: _topBarController,
              semanticsLabel: 'Top horizontal dashboard scrollbar',
            ),
            SizedBox(height: widget.topSpacing),
            bounded ? Expanded(child: content) : content,
            SizedBox(height: widget.bottomSpacing),
            _buildScrollRail(
              controller: _bottomBarController,
              semanticsLabel: 'Bottom horizontal dashboard scrollbar',
            ),
          ],
        );
      },
    );
  }
}
