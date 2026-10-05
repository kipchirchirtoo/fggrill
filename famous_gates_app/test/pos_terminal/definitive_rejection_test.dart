import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:famous_gates_app/features/pos_terminal/data/pos_terminal_service.dart';

DioException _err(int? status, [Object? body]) {
  final req = RequestOptions(path: '/pos-terminals/device/challenge');
  return DioException(
    requestOptions: req,
    response: status == null
        ? null
        : Response(requestOptions: req, statusCode: status, data: body),
  );
}

void main() {
  group('PosTerminalService.isDefinitiveRejection', () {
    test('server says terminal is gone / revoked / key replaced -> wipe', () {
      expect(
          PosTerminalService.isDefinitiveRejection(
              _err(404, {'message': 'Terminal is not registered'})),
          isTrue);
      expect(
          PosTerminalService.isDefinitiveRejection(
              _err(403, {'message': 'Terminal is revoked'})),
          isTrue);
      expect(
          PosTerminalService.isDefinitiveRejection(
              _err(401, {'message': 'Device signature verification failed'})),
          isTrue);
    });

    test('ambiguous failures must keep the terminal enrolled', () {
      // proxy / deploy-in-progress 404, Cloudflare 403 page, expired challenge,
      // 5xx, offline, non-Dio errors
      expect(PosTerminalService.isDefinitiveRejection(_err(404, {'message': 'Route not found'})), isFalse);
      expect(PosTerminalService.isDefinitiveRejection(_err(404, '<html>Not Found</html>')), isFalse);
      expect(PosTerminalService.isDefinitiveRejection(_err(403, '<html>Attention Required</html>')), isFalse);
      expect(
          PosTerminalService.isDefinitiveRejection(
              _err(401, {'message': 'Challenge is invalid or expired — request a new one'})),
          isFalse);
      expect(PosTerminalService.isDefinitiveRejection(_err(502)), isFalse);
      expect(PosTerminalService.isDefinitiveRejection(_err(500, {'message': 'boom'})), isFalse);
      expect(PosTerminalService.isDefinitiveRejection(_err(null)), isFalse);
      expect(PosTerminalService.isDefinitiveRejection(Exception('disk')), isFalse);
    });
  });
}
