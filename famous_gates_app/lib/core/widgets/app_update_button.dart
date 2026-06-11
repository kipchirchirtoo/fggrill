import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:updat/updat.dart';

import '../services/desktop_update_service.dart';
import '../theme/app_theme.dart';

class AppUpdateButton extends StatelessWidget {
  const AppUpdateButton({
    super.key,
    this.iconColor,
    this.compact = true,
  });

  final Color? iconColor;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: currentDesktopVersionFuture,
      builder: (context, snapshot) {
        final currentVersion = snapshot.data;
        if (currentVersion == null) return const SizedBox.shrink();

        return UpdatWidget(
          appName: 'FamousGate Hotels System',
          currentVersion: currentVersion,
          getLatestVersion: getLatestDesktopVersion,
          getBinaryUrl: getDesktopBinaryUrl,
          getChangelog: getDesktopReleaseNotes,
          openOnDownload: false,
          closeOnInstall: false,
          updateChipBuilder: ({
            required context,
            required latestVersion,
            required appVersion,
            required status,
            required checkForUpdate,
            required openDialog,
            required startUpdate,
            required launchInstaller,
            required dismissUpdate,
          }) {
            return _UpdateButtonBody(
              status: status,
              latestVersion: latestVersion,
              iconColor: iconColor,
              compact: compact,
              onPressed: () {
                if (isDesktopUpdateAvailable(status)) {
                  startUpdate();
                } else if (status == UpdatStatus.readyToInstall) {
                  // Record this release as installed so it stops being flagged.
                  markDesktopUpdateApplied();
                  launchInstaller();
                } else {
                  checkForUpdate();
                }
              },
            );
          },
        );
      },
    );
  }
}

class _UpdateButtonBody extends StatelessWidget {
  const _UpdateButtonBody({
    required this.status,
    required this.onPressed,
    required this.compact,
    this.latestVersion,
    this.iconColor,
  });

  final UpdatStatus status;
  final VoidCallback onPressed;
  final bool compact;
  final String? latestVersion;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final isBusy =
        status == UpdatStatus.checking || status == UpdatStatus.downloading;
    final hasUpdate = isDesktopUpdateAvailable(status);
    final ready = status == UpdatStatus.readyToInstall;
    final color = iconColor ?? AppColors.kTextSecondary;
    final tooltip = switch (status) {
      UpdatStatus.available ||
      UpdatStatus.availableWithChangelog =>
        'Download update ${latestVersion ?? ''}',
      UpdatStatus.downloading => 'Downloading update',
      UpdatStatus.readyToInstall => 'Install downloaded update',
      UpdatStatus.upToDate => 'App is up to date. Check again',
      UpdatStatus.error => 'Update check failed. Try again',
      _ => 'Check for desktop updates',
    };

    if (!compact) {
      return OutlinedButton.icon(
        onPressed: isBusy ? null : onPressed,
        icon: _icon(isBusy, hasUpdate, ready, color),
        label: Text(_label(status)),
      );
    }

    return Tooltip(
      message: tooltip,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          IconButton(
            onPressed: isBusy ? null : onPressed,
            icon: _icon(isBusy, hasUpdate, ready, color),
          ),
          if (hasUpdate || ready)
            Positioned(
              right: 8,
              top: 8,
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: ready ? AppColors.kSuccess : AppColors.kAccent,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _icon(bool busy, bool hasUpdate, bool ready, Color color) {
    if (busy) {
      return const SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    }
    return Icon(
      ready
          ? PhosphorIcons.checkCircle()
          : hasUpdate
              ? PhosphorIcons.downloadSimple()
              : PhosphorIcons.arrowsClockwise(),
      color: ready
          ? AppColors.kSuccess
          : hasUpdate
              ? AppColors.kAccent
              : color,
      size: 20,
    );
  }

  String _label(UpdatStatus status) {
    return switch (status) {
      UpdatStatus.available ||
      UpdatStatus.availableWithChangelog =>
        'Download update',
      UpdatStatus.downloading => 'Downloading',
      UpdatStatus.readyToInstall => 'Install update',
      UpdatStatus.upToDate => 'Up to date',
      UpdatStatus.error => 'Retry update',
      _ => 'Check updates',
    };
  }
}
