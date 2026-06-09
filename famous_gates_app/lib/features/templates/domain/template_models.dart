// Section-based document template model. Mirrors the backend
// document_templates engine: a template is an ordered list of sections that the
// print renderer and the SuperAdmin editor both consume.

class TemplateSection {
  TemplateSection({
    required this.id,
    required this.type,
    this.label,
    this.content,
    this.visible = true,
    this.align = 'left',
    this.bold = false,
    this.size,
  });

  final String id;
  String type;
  String? label;
  String? content;
  bool visible;
  String align; // left | center | right
  bool bold;
  double? size;

  factory TemplateSection.fromJson(Map<String, dynamic> j) => TemplateSection(
        id: '${j['id'] ?? UniqueKeySeed.next()}',
        type: '${j['type'] ?? 'text'}',
        label: j['label']?.toString(),
        content: j['content']?.toString(),
        visible: j['visible'] != false,
        align: '${j['align'] ?? 'left'}',
        bold: j['bold'] == true,
        size: j['size'] == null ? null : (j['size'] as num).toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        if (label != null) 'label': label,
        if (content != null) 'content': content,
        'visible': visible,
        'align': align,
        'bold': bold,
        if (size != null) 'size': size,
      };

  TemplateSection copy() => TemplateSection.fromJson(toJson());

  bool get isStructural => const {
        'logo',
        'code_box',
        'kv',
        'items',
        'totals',
        'divider',
        'barcode',
        'staff_box',
      }.contains(type);

  /// Human label for the editor.
  String get typeLabel {
    switch (type) {
      case 'logo':
        return 'Logo';
      case 'header':
        return 'Header text';
      case 'title':
        return 'Document title';
      case 'code_box':
        return 'Lookup code box';
      case 'kv':
        return 'Details (key/value)';
      case 'items':
        return 'Line items';
      case 'totals':
        return 'Totals';
      case 'text':
        return 'Text block';
      case 'divider':
        return 'Divider';
      case 'barcode':
        return 'Barcode';
      case 'footer':
        return 'Footer text';
      case 'notice':
        return 'Notice box';
      case 'staff_box':
        return 'Staff box';
      default:
        return type;
    }
  }
}

class DocumentTemplate {
  DocumentTemplate({
    required this.key,
    required this.name,
    this.description = '',
    this.documentType = 'thermal_receipt',
    required this.sections,
    this.defaultSections = const [],
    this.isOverride = false,
    this.overrideScope,
    this.placeholders = const [],
  });

  final String key;
  String name;
  final String description;
  final String documentType;
  List<TemplateSection> sections;
  final List<TemplateSection> defaultSections;
  final bool isOverride;
  final String? overrideScope; // global | branch | null
  final List<TemplatePlaceholder> placeholders;

  factory DocumentTemplate.fromJson(Map<String, dynamic> j) {
    List<TemplateSection> parse(dynamic raw) => (raw is List)
        ? raw
            .whereType<Map>()
            .map((e) => TemplateSection.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <TemplateSection>[];
    return DocumentTemplate(
      key: '${j['template_key'] ?? ''}',
      name: '${j['name'] ?? ''}',
      description: '${j['description'] ?? ''}',
      documentType: '${j['document_type'] ?? 'thermal_receipt'}',
      sections: parse(j['sections']),
      defaultSections: parse(j['default_sections']),
      isOverride: j['is_override'] == true,
      overrideScope: j['override_scope']?.toString(),
      placeholders: (j['placeholders'] is List)
          ? (j['placeholders'] as List)
              .whereType<Map>()
              .map((e) =>
                  TemplatePlaceholder.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

class TemplatePlaceholder {
  TemplatePlaceholder(this.token, this.label);
  final String token;
  final String label;
  factory TemplatePlaceholder.fromJson(Map<String, dynamic> j) =>
      TemplatePlaceholder('${j['token'] ?? ''}', '${j['label'] ?? ''}');
}

class TemplateSummary {
  TemplateSummary.fromJson(Map<String, dynamic> j)
      : key = '${j['template_key'] ?? ''}',
        name = '${j['name'] ?? ''}',
        description = '${j['description'] ?? ''}',
        documentType = '${j['document_type'] ?? ''}',
        sectionCount = (j['section_count'] as num?)?.toInt() ?? 0,
        hasOverride =
            j['has_global_override'] == true || j['has_branch_override'] == true,
        updatedAt = j['updated_at']?.toString();
  final String key;
  final String name;
  final String description;
  final String documentType;
  final int sectionCount;
  final bool hasOverride;
  final String? updatedAt;
}

// Lightweight unique id seed for new editor sections.
class UniqueKeySeed {
  static int _n = 0;
  static String next() => 's${DateTime.now().millisecondsSinceEpoch}_${_n++}';
}
