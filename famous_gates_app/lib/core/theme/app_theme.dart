import 'package:flutter/material.dart';

class AppColors {
  static const kPrimary = Color(0xFF1A3C5E); // Deep navy
  static const kAccent = Color(0xFFD4A843); // Warm gold
  static const kSurface = Color(0xFFFAF9F7); // Warm off-white
  static const kCardBg = Color(0xFFFFFFFF); // Pure white
  static const kTextPrimary = Color(0xFF1A1A1A); // Near-black
  static const kTextSecondary = Color(0xFF6B7280); // Muted labels
  static const kSuccess = Color(0xFF16A34A); // Green
  static const kWarning = Color(0xFFF59E0B); // Amber
  static const kError = Color(0xFFDC2626); // Red
  static const kDivider = Color(0xFFE5E7EB); // Subtle dividers
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.kPrimary,
        primary: AppColors.kPrimary,
        secondary: AppColors.kAccent,
        surface: AppColors.kSurface,
        error: AppColors.kError,
      ),
      scaffoldBackgroundColor: AppColors.kSurface,
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontFamily: 'SF Pro Display',
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: AppColors.kTextPrimary,
        ),
        displayMedium: TextStyle(
          fontFamily: 'SF Pro Display',
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: AppColors.kTextPrimary,
        ),
        displaySmall: TextStyle(
          fontFamily: 'SF Pro Display',
          fontSize: 24,
          fontWeight: FontWeight.bold,
          color: AppColors.kTextPrimary,
        ),
        bodyLarge: TextStyle(
          fontFamily: 'SF Pro Display',
          fontSize: 16,
          color: AppColors.kTextPrimary,
        ),
        bodyMedium: TextStyle(
          fontFamily: 'SF Pro Display',
          fontSize: 14,
          color: AppColors.kTextPrimary,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.kCardBg,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.kPrimary,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.kDivider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.kDivider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.kPrimary),
        ),
      ),
    );
  }
}
