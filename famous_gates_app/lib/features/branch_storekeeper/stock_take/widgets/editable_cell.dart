import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class EditableCell extends StatefulWidget {
  final double? value;
  final bool readOnly;
  final FocusNode? focusNode;
  final VoidCallback? onNext;
  final ValueChanged<double?> onChanged;

  const EditableCell({
    super.key,
    required this.value,
    required this.readOnly,
    required this.onChanged,
    this.focusNode,
    this.onNext,
  });

  @override
  State<EditableCell> createState() => _EditableCellState();
}

class _EditableCellState extends State<EditableCell> {
  final TextEditingController _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller.text = _valueText(widget.value);
    widget.focusNode?.addListener(_handleFocusChange);
  }

  @override
  void didUpdateWidget(covariant EditableCell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusNode != widget.focusNode) {
      oldWidget.focusNode?.removeListener(_handleFocusChange);
      widget.focusNode?.addListener(_handleFocusChange);
    }

    final nextText = _valueText(widget.value);
    if (_controller.text != nextText) {
      _controller.text = nextText;
      _controller.selection = TextSelection.collapsed(offset: nextText.length);
    }
  }

  @override
  void dispose() {
    widget.focusNode?.removeListener(_handleFocusChange);
    _controller.dispose();
    super.dispose();
  }

  /// Display whole numbers without a trailing ".0" for cleanliness.
  String _valueText(double? value) {
    if (value == null) return '';
    if (value == value.truncateToDouble()) return value.toInt().toString();
    return value.toString();
  }

  void _handleFocusChange() {
    if (widget.focusNode?.hasFocus == true) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _controller.selection = TextSelection(
          baseOffset: 0,
          extentOffset: _controller.text.length,
        );
      });
    }
  }

  void _handleChanged(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      widget.onChanged(null);
      return;
    }
    widget.onChanged(double.tryParse(trimmed));
  }

  void _moveNext() {
    widget.onNext?.call();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (widget.readOnly) {
      return Container(
        height: 46,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Text(
          widget.value == null ? '—' : _valueText(widget.value),
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
        ),
      );
    }

    return SizedBox(
      width: 120,
      child: CallbackShortcuts(
        bindings: {
          const SingleActivator(LogicalKeyboardKey.enter): _moveNext,
          const SingleActivator(LogicalKeyboardKey.numpadEnter): _moveNext,
        },
        child: TextField(
          controller: _controller,
          focusNode: widget.focusNode,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textInputAction:
              widget.onNext == null ? TextInputAction.done : TextInputAction.next,
          textAlign: TextAlign.center,
          // Allow digits and a single decimal point.
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
          ],
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
          decoration: InputDecoration(
            hintText: '0',
            hintStyle: TextStyle(
              color: Colors.grey.shade400,
              fontWeight: FontWeight.w600,
            ),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 14,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFD0D7E2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFD0D7E2)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: theme.colorScheme.primary,
                width: 1.6,
              ),
            ),
          ),
          onTap: () {
            _controller.selection = TextSelection(
              baseOffset: 0,
              extentOffset: _controller.text.length,
            );
          },
          onChanged: _handleChanged,
          onEditingComplete: _moveNext,
          onSubmitted: (_) => _moveNext(),
        ),
      ),
    );
  }
}
