import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';

// First-party backend hosts. The badCertificateCallback only ever fires when
// the OS chain validation FAILS — so normal TLS verification still runs first.
// On Linux desktops with an incomplete CA store (Dart can't fetch missing
// intermediate certs the way browsers do) this lets our own known hosts
// connect instead of failing with CERTIFICATE_VERIFY_FAILED.
const _trustedHosts = <String>{
  'api.hirall.com',
  'services.hirall.com',
};

void applyCertHandling(Dio dio) {
  dio.httpClientAdapter = IOHttpClientAdapter(
    createHttpClient: () {
      final client = HttpClient();
      client.badCertificateCallback =
          (X509Certificate cert, String host, int port) {
        return _trustedHosts.contains(host);
      };
      return client;
    },
  );
}
