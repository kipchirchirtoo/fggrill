import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class EditableCell extends StatefulWidget {
  final int? value;
  final ValueChanged<int?> onChanged;
  final bool readOnly;

  const EditableCell({
    super.key,
    required this.value,
    required this.onChanged,
    required this.readOnly,
  });

  @override
  State<EditableCell> createState() => _EditableCellState();
}

class _EditableCellState extends State<EditableCell> {
  late final TextEditingController _controller;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.value != null ? widget.value.toString() : '',
    );
  }

  @override
  void didUpdateWidget(covariant EditableCell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      final newVal = widget.value != null ? widget.value.toString() : '';
      if (_controller.text != newVal) {
        _controller.text = newVal;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _validate(String text) {
    if (text.isEmpty) {
      setState(() => _errorText = null);
      widget.onChanged(null);
      return;
    }

    final parsed = int.tryParse(text);
    if (parsed == null || parsed < 0) {
      setState(() => _errorText = 'Invalid count');
      widget.onChanged(null);
    } else {
      setState(() => _errorText = null);
      widget.onChanged(parsed);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      alignment: Alignment.center,
      child: SizedBox(
        width: 100,
        height: 38,
        child: TextFormField(
          controller: _controller,
          keyboardType: TextInputType.number,
          enabled: !widget.readOnly,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly, // Limits input to positive numbers
          ],
          decoration: InputDecoration(
            isDense: true,
            hintText: '—',
            contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            errorText: _errorText,
            errorStyle: const TextStyle(fontSize: 9, height: 0.8),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(4),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(4),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(4),
              borderSide: BorderSide(color: Colors.grey.shade100),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(4),
              borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
            ),
          ),
          onChanged: _validate,
        ),
      ),
    );
  }
}
