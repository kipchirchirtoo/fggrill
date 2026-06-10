import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_notifier.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../templates/domain/template_models.dart';
import '../../../templates/domain/template_providers.dart';

/// Central template management: list every system document template, edit its
/// sections, see a live preview, insert placeholders, save (publish) or reset
/// to the factory default. SuperAdmin only.
class DocumentTemplatesSection extends ConsumerStatefulWidget {
  const DocumentTemplatesSection({super.key});

  @override
  ConsumerState<DocumentTemplatesSection> createState() =>
      _DocumentTemplatesSectionState();
}

class _DocumentTemplatesSectionState
    extends ConsumerState<DocumentTemplatesSection> {
  String? _selectedKey;
  DocumentTemplate? _editing;
  bool _loading = false;
  bool _dirty = false;
  TextEditingController? _activeContent;

  Future<void> _load(String key) async {
    setState(() {
      _selectedKey = key;
      _loading = true;
      _editing = null;
      _dirty = false;
    });
    try {
      final t = await ref.read(templateRepositoryProvider).getTemplate(key);
      if (mounted) setState(() => _editing = t);
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final t = _editing;
    if (t == null) return;
    setState(() => _loading = true);
    try {
      await ref
          .read(templateRepositoryProvider)
          .saveTemplate(t.key, t.sections, name: t.name);
      ref.read(resolvedTemplateCacheProvider).clear(); // printers re-fetch
      ref.invalidate(templateListProvider);
      setState(() => _dirty = false);
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Template published')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reset() async {
    final t = _editing;
    if (t == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Reset to default?'),
        content: const Text(
            'This discards all customisations and restores the factory template.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Reset')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _loading = true);
    try {
      await ref.read(templateRepositoryProvider).resetTemplate(t.key);
      ref.read(resolvedTemplateCacheProvider).clear();
      ref.invalidate(templateListProvider);
      await _load(t.key);
      if (mounted) {
        AppNotifier.showSnackBar(context,
            const SnackBar(content: Text('Template reset to default')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _markDirty() => setState(() => _dirty = true);

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(templateListProvider(null));
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Document Templates',
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.kTextPrimary)),
        const SizedBox(height: 4),
        const Text(
            'Edit every system bill & receipt template. Changes publish instantly and are picked up by all print outputs.',
            style: TextStyle(fontSize: 13, color: AppColors.kTextSecondary)),
        const SizedBox(height: 16),
        Expanded(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // ── Template list ──
            SizedBox(
              width: 260,
              child: list.when(
                data: (items) => ListView(
                  children: [
                    for (final s in items.cast<TemplateSummary>())
                      _TemplateTile(
                        summary: s,
                        selected: s.key == _selectedKey,
                        onTap: () => _load(s.key),
                      ),
                  ],
                ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text(apiErrorMessage(e))),
              ),
            ),
            const VerticalDivider(width: 24),
            // ── Editor + preview ──
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _editing == null
                      ? const Center(
                          child: Text('Select a template to edit',
                              style:
                                  TextStyle(color: AppColors.kTextSecondary)))
                      : _buildEditor(_editing!),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _buildEditor(DocumentTemplate t) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(
          child: Text(t.name,
              style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 17,
                  color: AppColors.kTextPrimary)),
        ),
        if (_dirty)
          const Padding(
            padding: EdgeInsets.only(right: 8),
            child: Text('Unsaved',
                style: TextStyle(color: AppColors.kWarning, fontSize: 12)),
          ),
        OutlinedButton.icon(
          onPressed: _reset,
          icon: const Icon(Icons.restore, size: 16),
          label: const Text('Reset to default'),
        ),
        const SizedBox(width: 8),
        FilledButton.icon(
          onPressed: _dirty ? _save : null,
          icon: const Icon(Icons.publish, size: 16),
          label: const Text('Publish'),
        ),
      ]),
      const SizedBox(height: 6),
      Text(t.description,
          style:
              const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
      const SizedBox(height: 12),
      // Placeholder palette
      if (t.placeholders.isNotEmpty)
        Wrap(spacing: 6, runSpacing: 6, children: [
          const Text('Insert: ',
              style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
          for (final p in t.placeholders)
            ActionChip(
              label: Text(p.label, style: const TextStyle(fontSize: 11)),
              onPressed: () => _insertPlaceholder(p.token),
            ),
        ]),
      const SizedBox(height: 12),
      Expanded(
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Section editor
          Expanded(
            flex: 3,
            child: _SectionList(
              sections: t.sections,
              onChanged: _markDirty,
              registerActive: (c) => _activeContent = c,
              onReorder: (oldI, newI) {
                setState(() {
                  if (newI > oldI) newI -= 1;
                  final s = t.sections.removeAt(oldI);
                  t.sections.insert(newI, s);
                  _dirty = true;
                });
              },
              onDelete: (i) => setState(() {
                t.sections.removeAt(i);
                _dirty = true;
              }),
              onAdd: _addSection,
            ),
          ),
          const SizedBox(width: 16),
          // Live preview
          Expanded(
            flex: 2,
            child: _ThermalPreview(sections: t.sections),
          ),
        ]),
      ),
    ]);
  }

  void _insertPlaceholder(String token) {
    final c = _activeContent;
    if (c == null) {
      AppNotifier.showSnackBar(context,
          const SnackBar(content: Text('Tap a text field first, then insert')));
      return;
    }
    final sel = c.selection;
    final text = c.text;
    final start = sel.start >= 0 ? sel.start : text.length;
    c.text = text.replaceRange(start, sel.end >= 0 ? sel.end : start, token);
    c.selection = TextSelection.collapsed(offset: start + token.length);
    _markDirty();
  }

  void _addSection(String type) {
    final t = _editing;
    if (t == null) return;
    setState(() {
      t.sections.add(TemplateSection(
        id: UniqueKeySeed.next(),
        type: type,
        content: type == 'divider' ? null : 'New $type',
        align: 'left',
        size: type == 'title' ? 12 : 8,
      ));
      _dirty = true;
    });
  }
}

class _TemplateTile extends StatelessWidget {
  const _TemplateTile(
      {required this.summary, required this.selected, required this.onTap});
  final TemplateSummary summary;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      color:
          selected ? AppColors.kPrimary.withValues(alpha: 0.08) : Colors.white,
      child: ListTile(
        selected: selected,
        title: Text(summary.name,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        subtitle: Text(
          '${summary.documentType.replaceAll('_', ' ')} · ${summary.sectionCount} sections${summary.hasOverride ? ' · edited' : ''}',
          style: const TextStyle(fontSize: 11),
        ),
        trailing: summary.hasOverride
            ? const Icon(Icons.edit, size: 14, color: AppColors.kWarning)
            : null,
        onTap: onTap,
      ),
    );
  }
}

class _SectionList extends StatelessWidget {
  const _SectionList({
    required this.sections,
    required this.onChanged,
    required this.registerActive,
    required this.onReorder,
    required this.onDelete,
    required this.onAdd,
  });
  final List<TemplateSection> sections;
  final VoidCallback onChanged;
  final void Function(TextEditingController) registerActive;
  final void Function(int, int) onReorder;
  final void Function(int) onDelete;
  final void Function(String) onAdd;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Text('Sections',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const Spacer(),
        PopupMenuButton<String>(
          onSelected: onAdd,
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'text', child: Text('+ Text block')),
            PopupMenuItem(value: 'header', child: Text('+ Header')),
            PopupMenuItem(value: 'footer', child: Text('+ Footer')),
            PopupMenuItem(value: 'notice', child: Text('+ Notice box')),
            PopupMenuItem(value: 'divider', child: Text('+ Divider')),
          ],
          child: const Chip(
            avatar: Icon(Icons.add, size: 16),
            label: Text('Add section'),
          ),
        ),
      ]),
      const SizedBox(height: 8),
      Expanded(
        child: ReorderableListView.builder(
          buildDefaultDragHandles: false,
          itemCount: sections.length,
          onReorderItem: onReorder,
          itemBuilder: (context, i) {
            final s = sections[i];
            return _SectionCard(
              key: ValueKey(s.id),
              index: i,
              section: s,
              onChanged: onChanged,
              registerActive: registerActive,
              onDelete: () => onDelete(i),
            );
          },
        ),
      ),
    ]);
  }
}

class _SectionCard extends StatefulWidget {
  const _SectionCard({
    super.key,
    required this.index,
    required this.section,
    required this.onChanged,
    required this.registerActive,
    required this.onDelete,
  });
  final int index;
  final TemplateSection section;
  final VoidCallback onChanged;
  final void Function(TextEditingController) registerActive;
  final VoidCallback onDelete;

  @override
  State<_SectionCard> createState() => _SectionCardState();
}

class _SectionCardState extends State<_SectionCard> {
  late final _content =
      TextEditingController(text: widget.section.content ?? '');
  late final _label = TextEditingController(text: widget.section.label ?? '');

  @override
  void dispose() {
    _content.dispose();
    _label.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.section;
    final textLike =
        const {'text', 'header', 'title', 'footer', 'notice'}.contains(s.type);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            ReorderableDragStartListener(
              index: widget.index,
              child: const Icon(Icons.drag_indicator,
                  size: 18, color: AppColors.kTextSecondary),
            ),
            const SizedBox(width: 6),
            Text(s.typeLabel,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 12.5)),
            const Spacer(),
            Switch(
              value: s.visible,
              onChanged: (v) {
                setState(() => s.visible = v);
                widget.onChanged();
              },
            ),
            IconButton(
              tooltip: 'Delete section',
              onPressed: widget.onDelete,
              icon: const Icon(Icons.delete_outline,
                  size: 18, color: AppColors.kError),
            ),
          ]),
          if (s.label != null || s.type == 'code_box')
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: TextField(
                controller: _label,
                decoration:
                    const InputDecoration(labelText: 'Label', isDense: true),
                onChanged: (v) {
                  s.label = v;
                  widget.onChanged();
                },
              ),
            ),
          if (textLike)
            TextField(
              controller: _content,
              maxLines: s.type == 'notice' ? 3 : 2,
              onTap: () => widget.registerActive(_content),
              decoration: const InputDecoration(
                  labelText: 'Content (supports {{placeholders}})',
                  isDense: true),
              onChanged: (v) {
                s.content = v;
                widget.onChanged();
              },
            ),
          if (textLike) ...[
            const SizedBox(height: 6),
            Row(children: [
              _AlignToggle(
                value: s.align,
                onChanged: (a) {
                  setState(() => s.align = a);
                  widget.onChanged();
                },
              ),
              const SizedBox(width: 12),
              FilterChip(
                label: const Text('Bold'),
                selected: s.bold,
                onSelected: (b) {
                  setState(() => s.bold = b);
                  widget.onChanged();
                },
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 90,
                child: TextField(
                  decoration:
                      const InputDecoration(labelText: 'Size', isDense: true),
                  keyboardType: TextInputType.number,
                  controller: TextEditingController(
                      text: (s.size ?? 8).toStringAsFixed(0)),
                  onChanged: (v) {
                    s.size = double.tryParse(v) ?? s.size;
                    widget.onChanged();
                  },
                ),
              ),
            ]),
          ],
        ]),
      ),
    );
  }
}

class _AlignToggle extends StatelessWidget {
  const _AlignToggle({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    Widget btn(String v, IconData icon) => IconButton(
          isSelected: value == v,
          onPressed: () => onChanged(v),
          icon: Icon(icon, size: 18),
          color: value == v ? AppColors.kPrimary : AppColors.kTextSecondary,
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      btn('left', Icons.format_align_left),
      btn('center', Icons.format_align_center),
      btn('right', Icons.format_align_right),
    ]);
  }
}

/// A live thermal-receipt preview that mirrors the print renderer using sample
/// data, so SuperAdmins see changes before publishing.
class _ThermalPreview extends StatelessWidget {
  const _ThermalPreview({required this.sections});
  final List<TemplateSection> sections;

  static const _sample = {
    'company_name': 'FamousGate Hotels',
    'branch_name': 'BOMET TOWN',
    'company_phone': '+254 706 782 828',
    'company_email': 'info@famousgatehotels.com',
    'till_number': '8118084',
    'receipt_number': 'POS-1780998668619',
    'public_code': 'JZWLY3',
    'date': '10/06/2026, 09:15 AM',
    'customer_name': 'Walk-in',
    'table_number': '4',
    'room_number': '',
    'staff_label': 'Waiter',
    'staff_name': 'ELIUD ROTICH',
    'payment_method': 'CASH',
    'paid': 'KES 350.00',
    'total': 'KES 350.00',
  };

  String _subst(String? t) {
    if (t == null) return '';
    var out = t;
    _sample.forEach((k, v) => out = out.replaceAll('{{$k}}', v));
    return out.replaceAll(RegExp(r'\{\{[a-z_]+\}\}'), '').trim();
  }

  TextAlign _ta(String a) => a == 'center'
      ? TextAlign.center
      : a == 'right'
          ? TextAlign.right
          : TextAlign.left;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF6F6F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.kDivider),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('LIVE PREVIEW',
            style: TextStyle(
                fontSize: 10,
                letterSpacing: 1.2,
                fontWeight: FontWeight.bold,
                color: AppColors.kTextSecondary)),
        const SizedBox(height: 8),
        Expanded(
          child: SingleChildScrollView(
            child: Container(
              width: 280,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(6),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 8),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final s in _thermalOrder(sections))
                    if (s.visible) ..._previewSection(s),
                ],
              ),
            ),
          ),
        ),
      ]),
    );
  }

  List<TemplateSection> _thermalOrder(List<TemplateSection> sections) {
    TemplateSection? till;
    final ordered = <TemplateSection>[];
    for (final section in sections) {
      if (_isTillSection(section)) {
        if (section.visible && till == null) till = section;
        continue;
      }
      ordered.add(section);
    }
    if (till == null) return ordered;

    final result = <TemplateSection>[];
    var inserted = false;
    for (final section in ordered) {
      result.add(section);
      if (!inserted && _isThankYouSection(section)) {
        result.add(TemplateSection(
          id: 'till_compliance',
          type: 'text',
          content: till.content,
          visible: till.visible,
          align: 'center',
          bold: true,
          size: till.size == null || till.size! < 12 ? 13.0 : till.size!,
        ));
        inserted = true;
      }
    }
    if (!inserted) {
      result.add(TemplateSection(
        id: 'till_compliance',
        type: 'text',
        content: till.content,
        visible: till.visible,
        align: 'center',
        bold: true,
        size: till.size == null || till.size! < 12 ? 13.0 : till.size!,
      ));
    }
    return result;
  }

  bool _isTillSection(TemplateSection s) {
    final content = (s.content ?? '').toLowerCase();
    return s.id == 'till' ||
        s.id == 'till_compliance' ||
        content.contains('{{till_number}}');
  }

  bool _isThankYouSection(TemplateSection s) =>
      (s.content ?? '').toLowerCase().contains('thank you');

  List<Widget> _previewSection(TemplateSection s) {
    Widget txt(String t,
            {bool bold = false, double size = 8, String align = 'left'}) =>
        Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: Text(t,
              textAlign: _ta(align),
              style: TextStyle(
                  fontSize: size + 2,
                  fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        );

    switch (s.type) {
      case 'logo':
        return [
          const Center(
              child: Icon(Icons.image, size: 36, color: Colors.black26)),
          const SizedBox(height: 4),
        ];
      case 'header':
      case 'title':
      case 'text':
      case 'footer':
        if (s.id == 'till_compliance') {
          final till = _sample['till_number'] ?? '';
          if (till.isEmpty) return [];
          return [
            Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(vertical: 4),
              padding: const EdgeInsets.symmetric(vertical: 5),
              decoration: const BoxDecoration(
                border: Border.symmetric(
                  horizontal: BorderSide(width: 1),
                ),
              ),
              child: Column(children: [
                const Text('TILL NUMBER',
                    textAlign: TextAlign.center,
                    style:
                        TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                Text(till.toUpperCase(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
              ]),
            ),
          ];
        }
        final t = _subst(s.content);
        return t.isEmpty
            ? []
            : [txt(t, bold: s.bold, size: s.size ?? 8, align: s.align)];
      case 'divider':
        return [const Divider(height: 8)];
      case 'code_box':
        return [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 4),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(border: Border.all()),
            child: Column(children: [
              Text(s.label ?? 'CODE',
                  style: const TextStyle(
                      fontSize: 8, fontWeight: FontWeight.bold)),
              Text(_subst(s.content).isEmpty ? 'JZWLY3' : _subst(s.content),
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold)),
            ]),
          ),
        ];
      case 'kv':
        return [
          txt('Receipt #:   ${_sample['receipt_number']}'),
          txt('Date:   ${_sample['date']}'),
          txt('Customer:   ${_sample['customer_name']}'),
          txt('${_sample['staff_label']}:   ${_sample['staff_name']}'),
        ];
      case 'items':
        return [
          txt('1x Delmonte 1 ltr            KES 350.00'),
        ];
      case 'totals':
        return [
          txt('SUBTOTAL            KES 301.72', size: 9),
          txt('TAX (16% incl.)     KES 48.28', size: 9),
          txt('TOTAL:              KES 350.00', bold: true, size: 11),
        ];
      case 'staff_box':
        return [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 4),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(border: Border.all()),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('STAFF',
                  style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold)),
              Text(_sample['staff_name']!,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.bold)),
            ]),
          ),
        ];
      case 'notice':
        return [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 4),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(border: Border.all()),
            child: Text(_subst(s.content), style: const TextStyle(fontSize: 9)),
          ),
        ];
      case 'barcode':
        return [
          const SizedBox(height: 4),
          Container(
              height: 28,
              color: Colors.black12,
              child: const Center(
                  child:
                      Text('▮▮▮ barcode ▮▮▮', style: TextStyle(fontSize: 9)))),
        ];
      default:
        return [];
    }
  }
}
