import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';

interface OTPInputProps {
  onComplete: (code: string) => void;
  length?: number;
  error?: string;
}

const OTPInput: React.FC<OTPInputProps> = ({ onComplete, length = 6, error }) => {
  const [code, setCode] = useState<string[]>(Array(length).fill(''));
  const [shakeAnimation] = useState(new Animated.Value(0));

  const handleNumberPress = (num: string) => {
    const firstEmptyIndex = code.findIndex((digit) => digit === '');
    if (firstEmptyIndex !== -1) {
      const newCode = [...code];
      newCode[firstEmptyIndex] = num;
      setCode(newCode);

      if (firstEmptyIndex === length - 1) {
        onComplete(newCode.join(''));
      }
    }
  };

  const handleBackspace = () => {
    const lastFilledIndex = code.findLastIndex((digit) => digit !== '');
    if (lastFilledIndex !== -1) {
      const newCode = [...code];
      newCode[lastFilledIndex] = '';
      setCode(newCode);
    }
  };

  const handleClear = () => {
    setCode(Array(length).fill(''));
  };

  React.useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
      handleClear();
    }
  }, [error]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.codeDisplay, { transform: [{ translateX: shakeAnimation }] }]}
      >
        {code.map((digit, index) => (
          <View key={index} style={[styles.digitBox, digit && styles.digitBoxFilled]}>
            <Text style={styles.digitText}>{digit || '•'}</Text>
          </View>
        ))}
      </Animated.View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.numpad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <TouchableOpacity
            key={num}
            style={styles.numButton}
            onPress={() => handleNumberPress(num.toString())}
          >
            <Text style={styles.numButtonText}>{num}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.numButton} onPress={handleClear}>
          <MaterialCommunityIcons name="close" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumberPress('0')}>
          <Text style={styles.numButtonText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={handleBackspace}>
          <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  codeDisplay: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
  },
  digitBox: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
    backgroundColor: colors.card,
  },
  digitBoxFilled: {
    borderColor: colors.primary.DEFAULT,
    backgroundColor: colors.primary.DEFAULT + '10',
  },
  digitText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  errorText: {
    color: colors.danger.DEFAULT,
    marginBottom: spacing.lg,
    fontSize: 14,
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 300,
    justifyContent: 'space-between',
  },
  numButton: {
    width: 90,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  numButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

export default OTPInput;
