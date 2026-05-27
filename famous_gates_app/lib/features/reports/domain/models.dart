class ReportTemplate {
  final String id;
  final String name;
  final String description;
  final String iconName;
  final String? category;

  String get type => id;

  const ReportTemplate({
    required this.id,
    required this.name,
    required this.description,
    this.iconName = 'fileText',
    this.category,
  });

  factory ReportTemplate.fromJson(Map<String, dynamic> json) {
    return ReportTemplate(
      id: '${json['id']}',
      name: '${json['name'] ?? json['title'] ?? ''}',
      description: '${json['description'] ?? ''}',
      iconName: json['icon'] as String? ?? 'fileText',
      category: json['category'] as String?,
    );
  }
}

class ReportStats {
  final int totalReports;
  final int revenueReports;
  final int inventoryReports;
  final int occupancyReports;

  const ReportStats({
    this.totalReports = 6,
    this.revenueReports = 0,
    this.inventoryReports = 0,
    this.occupancyReports = 0,
  });

  factory ReportStats.fromJson(Map<String, dynamic> json) {
    return ReportStats(
      totalReports: (json['total_reports'] ?? 6).toInt(),
      revenueReports: (json['revenue_reports'] ?? 0).toInt(),
      inventoryReports: (json['inventory_reports'] ?? 0).toInt(),
      occupancyReports: (json['occupancy_reports'] ?? 0).toInt(),
    );
  }
}

class ReportData {
  final String reportType;
  final Map<String, dynamic> data;
  final DateTime? generatedAt;

  const ReportData({
    required this.reportType,
    required this.data,
    this.generatedAt,
  });

  factory ReportData.fromJson(Map<String, dynamic> json) {
    return ReportData(
      reportType: '${json['report_type'] ?? json['type'] ?? ''}',
      data: Map<String, dynamic>.from(json['data'] ?? json['results'] ?? {}),
      generatedAt: DateTime.tryParse(
          '${json['generated_at'] ?? json['timestamp'] ?? ''}'),
    );
  }
}
