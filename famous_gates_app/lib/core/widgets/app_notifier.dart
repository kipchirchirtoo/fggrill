import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

class AppNotifier {
  static const MethodChannel _audioProbeChannel =
      MethodChannel('xyz.luan/audioplayers.global');
  static AudioPlayer? _player;
  static bool? _audioPluginAvailable;

  static Future<void> showSnackBar(
    BuildContext context,
    SnackBar snackBar, {
    bool? isError,
  }) async {
    if (!context.mounted) return;
    final message = _textFromSnackBar(snackBar);
    final error = isError ?? _isErrorSnackBar(snackBar, message);
    await _play(
      error ? 'sounds/error.mp3' : 'sounds/notification.mp3',
      isError: error,
    );

    if (!context.mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: snackBar.behavior ?? SnackBarBehavior.floating,
          showCloseIcon: snackBar.showCloseIcon ?? true,
          backgroundColor: snackBar.backgroundColor ??
              (error ? AppColors.kError : AppColors.kPrimary),
          duration: snackBar.duration,
          action: snackBar.action,
          content: _decoratedContent(
            message,
            snackBar.content,
            error: error,
          ),
        ),
      );
  }

  static Future<void> show(
    BuildContext context,
    String message, {
    bool? isError,
  }) async {
    if (!context.mounted) return;
    final cleanedMessage = _cleanMessage(message);
    final error = isError ?? _looksLikeError(cleanedMessage);
    await _play(
      error ? 'sounds/error.mp3' : 'sounds/notification.mp3',
      isError: error,
    );

    if (!context.mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          showCloseIcon: true,
          backgroundColor: error ? AppColors.kError : AppColors.kPrimary,
          content: Row(
            children: [
              Icon(
                error ? Icons.error_outline : Icons.notifications_active,
                color: Colors.white,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(cleanedMessage)),
            ],
          ),
        ),
      );
  }

  static Future<void> _play(String assetPath, {required bool isError}) async {
    try {
      if (!await _hasAudioPlugin()) {
        await _playSystemSound(isError: isError);
        return;
      }
      final player = _player ??= AudioPlayer(playerId: 'app-notifier');
      await player.stop();
      await player.play(AssetSource(assetPath));
    } catch (_) {
      await _playSystemSound(isError: isError);
    }
  }

  static Future<bool> _hasAudioPlugin() async {
    final cached = _audioPluginAvailable;
    if (cached != null) return cached;
    try {
      await _audioProbeChannel.invokeMethod<void>('init');
      _audioPluginAvailable = true;
    } on MissingPluginException {
      _audioPluginAvailable = false;
    } on PlatformException {
      _audioPluginAvailable = false;
    } catch (_) {
      _audioPluginAvailable = false;
    }
    return _audioPluginAvailable ?? false;
  }

  static Future<void> _playSystemSound({required bool isError}) async {
    try {
      await SystemSound.play(
        isError ? SystemSoundType.alert : SystemSoundType.click,
      );
    } catch (_) {
      // Notification sound must never block the UI message.
    }
  }

  static bool _looksLikeError(String message) {
    final text = message.toLowerCase();
    return text.contains('failed') ||
        text.contains('error') ||
        text.contains('not found') ||
        text.contains('invalid') ||
        text.contains('cannot') ||
        text.contains('required') ||
        text.contains('expired') ||
        text.contains('denied') ||
        text.contains('exceed');
  }

  static bool _isErrorSnackBar(SnackBar snackBar, String? message) {
    if (snackBar.backgroundColor == AppColors.kError ||
        snackBar.backgroundColor == Colors.red ||
        snackBar.backgroundColor == Colors.redAccent) {
      return true;
    }
    return _looksLikeError(message ?? '');
  }

  static Widget _decoratedContent(
    String? message,
    Widget fallback, {
    required bool error,
  }) {
    final cleanedMessage = _cleanMessage(message ?? '');
    if (cleanedMessage.isEmpty) return fallback;
    return Row(
      children: [
        Icon(
          error ? Icons.error_outline : Icons.notifications_active,
          color: Colors.white,
          size: 18,
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(cleanedMessage)),
      ],
    );
  }

  static String? _textFromSnackBar(SnackBar snackBar) {
    final content = snackBar.content;
    if (content is Text) {
      final data = content.data;
      if (data != null && data.trim().isNotEmpty) return data;
      final span = content.textSpan;
      final text = span?.toPlainText();
      if (text != null && text.trim().isNotEmpty) return text;
    }
    return null;
  }

  static String _cleanMessage(String message) {
    var text = message.trim();
    if (text.isEmpty) return text;
    text = text.replaceFirst(RegExp(r'^Exception:\s*'), '');
    text = text.replaceFirst(RegExp(r'^Error:\s*Exception:\s*'), 'Error: ');
    text = text.replaceFirst(RegExp(r'^Failed:\s*Exception:\s*'), 'Failed: ');
    if (text.contains('DioException')) {
      final match = RegExp(r'"message"\s*:\s*"([^"]+)"').firstMatch(text);
      if (match != null) return match.group(1) ?? 'Request failed';
      return 'Request failed. Check the details and try again.';
    }
    return text;
  }
}
