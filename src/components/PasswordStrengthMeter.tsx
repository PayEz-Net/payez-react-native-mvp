import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PasswordStrengthMeterProps {
  password: string;
}

interface StrengthResult {
  score: number; // 0-4
  label: string;
  color: string;
  feedback: string[];
}

/**
 * Password strength meter component
 * Evaluates password strength and displays visual feedback
 */
export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
}) => {
  const strength = useMemo(() => evaluatePassword(password), [password]);

  return (
    <View style={styles.container}>
      {/* Strength Bar */}
      <View style={styles.barContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.barSegment,
              {
                backgroundColor:
                  index < strength.score ? strength.color : '#e0e0e0',
              },
            ]}
          />
        ))}
      </View>

      {/* Strength Label */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: strength.color }]}>
          {strength.label}
        </Text>
      </View>

      {/* Feedback */}
      {strength.feedback.length > 0 && (
        <View style={styles.feedbackContainer}>
          {strength.feedback.map((item, index) => (
            <Text key={index} style={styles.feedbackItem}>
              {item}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * Evaluate password strength
 */
function evaluatePassword(password: string): StrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return {
      score: 0,
      label: '',
      color: '#e0e0e0',
      feedback: [],
    };
  }

  // Length checks
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Use at least 8 characters');
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Character variety checks
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLower && hasUpper) {
    score += 1;
  } else {
    if (!hasLower) feedback.push('Add lowercase letters');
    if (!hasUpper) feedback.push('Add uppercase letters');
  }

  if (hasNumber) {
    score += 0.5;
  } else {
    feedback.push('Add numbers');
  }

  if (hasSpecial) {
    score += 0.5;
  }

  // Cap score at 4
  score = Math.min(Math.floor(score), 4);

  // Check for common patterns (weak)
  const commonPatterns = [
    /^123/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /(.)\1{2,}/, // Repeated characters
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score = Math.max(0, score - 1);
      feedback.push('Avoid common patterns');
      break;
    }
  }

  // Determine label and color
  let label: string;
  let color: string;

  switch (score) {
    case 0:
      label = 'Very Weak';
      color = '#f44336';
      break;
    case 1:
      label = 'Weak';
      color = '#ff9800';
      break;
    case 2:
      label = 'Fair';
      color = '#ffeb3b';
      break;
    case 3:
      label = 'Good';
      color = '#8bc34a';
      break;
    case 4:
      label = 'Strong';
      color = '#4caf50';
      break;
    default:
      label = 'Very Weak';
      color = '#f44336';
  }

  return {
    score,
    label,
    color,
    feedback: feedback.slice(0, 2), // Show max 2 feedback items
  };
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  barContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  barSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  labelRow: {
    marginTop: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackContainer: {
    marginTop: 4,
  },
  feedbackItem: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
});
