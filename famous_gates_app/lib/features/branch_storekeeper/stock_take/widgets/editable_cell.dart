import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// Compact Excel-style number input cell.
class EditableCell extends StatefulWidget {
  final int? value;
  final ValueChanged<int?> onChanged;
  final bool readOnly;
  final FocusNode? focusNode;
  final VoidCallback? onNext;

  const EditableCell({
    super.key,
    required this.value,
    required this.onChanged,
    required this.readOnly,
    this.focusNode,
    this.onNext,
  });

  @override
  State<EditableCell> createState() => _EditableCellState();
}

class _EditableCellState extends State<EditableCell> {
  late final TextEditingController _ctrl;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
        text: widget.value != null ? '${widget.value}' : '');
    widget.focusNode?.addListener(_onFocus);
  }

  void _onFocus() {
    if (mounted) {
      setState(() => _isFocused = widget.focusNode?.hasFocus ?? false);
    }
  }

  @override
  void didUpdateWidget(covariant EditableCell old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value) {
      final s = widget.value != null ? '${widget.value}' : '';
      if (_ctrl.text != s) {
        _ctrl.text = s;
        _ctrl.selection = TextSelection.collapsed(offset: s.length);
      }
    }
    if (old.focusNode != widget.focusNode) {
      old.focusNode?.removeListener(_onFocus);
      widget.focusNode?.addListener(_onFocus);
    }
  }

  @override
  void dispose() {
    widget.focusNode?.removeListener(_onFocus);
    _ctrl.dispose();
    super.dispose();
  }

  void _parse(String text) {
    if (text.isEmpty) { widget.onChanged(null); return; }
    final v = int.tryParse(text);
    widget.onChanged(v != null && v >= 0 ? v : null);
  }

  @override
  Widget build(BuildContext context) {
    final accent = const Color(0xFF217346); // Excel green
    if (widget.readOnly) {
      return Text(
        widget.value != null ? '${widget.value}' : '—',
        textAlign: TextAlign.center,
        style: const TextStyle(
            fontSize: 11, fontWeight: FontWeight.w700),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 62,
          height: 22,
          child: TextField(
            controller: _ctrl,
            focusNode: widget.focusNode,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: _parse,
            onSubmitted: (_) => widget.onNext?.call(),
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              isDense: true,
              hintText: '—',
              hintStyle: TextStyle(fontSize: 10, color: Colors.grey.shade400),
              contentPadding:
                  const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
              filled: true,
              fillColor: _isFocused
                  ? const Color(0xFFE8F5E9)
                  : Colors.grey.shade50,
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(2),
                borderSide: BorderSide(
                  color: _isFocused ? accent : Colors.grey.shade300,
                  width: _isFocused ? 1.5 : 0.8,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(2),
                borderSide: BorderSide(color: accent, width: 1.5),
              ),
            ),
          ),
        ),
        if (widget.onNext != null) ...[
          const SizedBox(width: 2),
          GestureDetector(
            onTap: widget.onNext,
            child: Icon(
              Icons.arrow_downward_rounded,
              size: 12,
              color: _isFocused ? accent : Colors.grey.shade400,
            ),
          ),
        ],
      ],
    );
  }
}
