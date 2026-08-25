import 'dart:typed_data';

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pdf/pdf.dart';
import 'package:printing/printing.dart';

/// Resolves a real printer and prints directly to it (no OS print dialog).
///
/// Resolution order: a printer explicitly saved via [SilentPrinter.save]
/// (so a branch can pick a different printer for the kitchen vs the
/// cashier on the same machine) -> the OS default printer -> the first
/// printer the OS reports. If no printer can be resolved at all (e.g. none
/// installed), falls back to the normal print dialog so printing never
/// silently does nothing.
class SilentPrinter {
  SilentPrinter._();

  static const _storage = FlutterSecureStorage();
  static const _urlKey = 'printer_default_url';
  static const _nameKey = 'printer_default_name';

  // Memoised resolved printer. Resolving a printer on every print is expensive:
  // it reads secure storage and, with no saved printer, calls
  // Printing.listPrinters() which enumerates the OS (slow with network/offline
  // printers) — adding hundreds of ms to every receipt. We resolve once and
  // reuse it; save/clear reset the cache so a re-pick takes effect immediately.
  static Printer? _cachedPrinter;

  static Future<Printer?> getSavedPrinter() async {
    final url = await _storage.read(key: _urlKey);
    if (url == null || url.isEmpty) return null;
    final name = await _storage.read(key: _nameKey);
    return Printer(url: url, name: name);
  }

  static Future<void> savePrinter(Printer printer) async {
    await _storage.write(key: _urlKey, value: printer.url);
    await _storage.write(key: _nameKey, value: printer.name);
    _cachedPrinter = printer; // use the freshly-picked printer right away
  }

  static Future<void> clearSavedPrinter() async {
    await _storage.delete(key: _urlKey);
    await _storage.delete(key: _nameKey);
    _cachedPrinter = null; // force a fresh resolve on the next print
  }

  static Future<List<Printer>> listAvailable() => Printing.listPrinters();

  static Future<Printer?> _resolvePrinter() async {
    // Fast path: reuse the printer resolved on a previous print this session.
    if (_cachedPrinter != null) return _cachedPrinter;
    final saved = await getSavedPrinter();
    if (saved != null) {
      _cachedPrinter = saved;
      return saved;
    }
    final stopwatch = Stopwatch()..start();
    try {
      final printers = await Printing.listPrinters().timeout(
        const Duration(milliseconds: 1200),
        onTimeout: () => <Printer>[],
      );
      debugPrint(
          'Printing.listPrinters() found ${printers.length} printer(s) in '
          '${stopwatch.elapsedMilliseconds}ms');
      if (printers.isEmpty) return null;
      final resolved = printers.firstWhere(
        (p) => p.isDefault,
        orElse: () => printers.first,
      );
      // Persist to secure storage (not just the in-memory cache) so this
      // enumeration never has to run again on this machine — but only when
      // there's exactly one printer to resolve. With more than one, the OS
      // default can silently drift later (driver reinstalls, spooler
      // resets, a Windows Update) independent of the till operator; keeping
      // it in-memory-only means a changed default is picked up automatically
      // on the next launch instead of requiring someone to notice a wrong
      // printer and use "Clear override" in printer settings.
      if (printers.length == 1) {
        await savePrinter(resolved);
      } else {
        _cachedPrinter = resolved;
      }
      return resolved;
    } catch (_) {
      return null;
    }
  }

  /// Drop-in replacement for `Printing.layoutPdf` that prints straight to a
  /// resolved printer instead of opening the OS print dialog/preview.
  ///
  /// Timed in two layers so a slow print can be attributed to the right
  /// stage: [buildStopwatch] covers only onLayout itself (building the
  /// pw.Document — including rendering the logo/barcode into it — and
  /// calling doc.save()), while the surrounding dispatch timer covers the
  /// full directPrintPdf/layoutPdf call. The difference between the two is
  /// time spent purely in the OS/driver (rasterization + spooling), which
  /// building the PDF faster can never reduce.
  static Future<void> print({
    required LayoutCallback onLayout,
    required PdfPageFormat format,
    String name = 'Document',
  }) async {
    final buildStopwatch = Stopwatch();
    Future<Uint8List> timedLayout(PdfPageFormat f) async {
      buildStopwatch.start();
      final bytes = await onLayout(f);
      buildStopwatch.stop();
      debugPrint(
          'SilentPrinter: PDF build (onLayout, incl. logo/barcode) took '
          '${buildStopwatch.elapsedMilliseconds}ms');
      return bytes;
    }

    final resolveStopwatch = Stopwatch()..start();
    try {
      final printer = await _resolvePrinter();
      debugPrint(
          'SilentPrinter: printer resolution took ${resolveStopwatch.elapsedMilliseconds}ms');
      if (printer != null) {
        final dispatchStopwatch = Stopwatch()..start();
        final ok = await Printing.directPrintPdf(
          printer: printer,
          onLayout: timedLayout,
          format: format,
          name: name,
        );
        debugPrint(
            'SilentPrinter: directPrintPdf total took ${dispatchStopwatch.elapsedMilliseconds}ms '
            '(build was ${buildStopwatch.elapsedMilliseconds}ms), ok=$ok');
        if (ok) return;
      }
    } catch (e) {
      debugPrint('SilentPrinter: directPrintPdf threw: $e');
      // Fall through to the dialog so the document still prints somehow.
    }
    final fallbackStopwatch = Stopwatch()..start();
    await Printing.layoutPdf(onLayout: timedLayout, format: format, name: name);
    debugPrint(
        'SilentPrinter: layoutPdf (dialog fallback) total took '
        '${fallbackStopwatch.elapsedMilliseconds}ms');
  }
}
