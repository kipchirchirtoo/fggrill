import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class SimpleModuleScreen extends StatelessWidget {
  const SimpleModuleScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: const Center(
        child: Text('Module route is wired and awaiting its real screen.'),
      ),
    );
  }
}
