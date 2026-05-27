class ServiceHealth {
  final String name;
  final bool isHealthy;
  final String? message;
  final int? responseTimeMs;

  const ServiceHealth({
    required this.name,
    required this.isHealthy,
    this.message,
    this.responseTimeMs,
  });

  factory ServiceHealth.fromJson(String name, Map<String, dynamic> json) {
    final status = '${json['status'] ?? ''}';
    return ServiceHealth(
      name: name,
      isHealthy: status == 'OK' || status == 'healthy' || status == 'ok',
      message: json['message'] as String?,
    );
  }

  factory ServiceHealth.error(String name, String error) {
    return ServiceHealth(name: name, isHealthy: false, message: error);
  }
}

class SystemHealth {
  final String status;
  final String environment;
  final double uptimeSeconds;
  final Map<String, bool> envChecks;
  final int checkedServices;
  final int healthyServices;

  const SystemHealth({
    required this.status,
    required this.environment,
    required this.uptimeSeconds,
    required this.envChecks,
    required this.checkedServices,
    required this.healthyServices,
  });

  factory SystemHealth.fromJson(Map<String, dynamic> json) {
    final envCheck = json['env_check'] as Map<String, dynamic>? ?? {};
    return SystemHealth(
      status: '${json['status'] ?? 'UNKNOWN'}',
      environment: '${json['environment'] ?? 'unknown'}',
      uptimeSeconds: (json['uptime'] as num?)?.toDouble() ?? 0,
      envChecks: envCheck.map((k, v) => MapEntry(k, v == true)),
      checkedServices: envCheck.length,
      healthyServices: envCheck.values.where((v) => v == true).length,
    );
  }

  String get uptimeFormatted {
    final hours = (uptimeSeconds / 3600).floor();
    final minutes = ((uptimeSeconds % 3600) / 60).floor();
    if (hours > 0) return '${hours}h ${minutes}m';
    return '${minutes}m';
  }
}
