import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';

const logoVerticalLight = require('../../assets/safe-white-logo-vertical.png');
const logoHorizontalLight = require('../../assets/safe-white-logo-horizontal.png');
const logoVerticalDark = require('../../assets/safe-black-logo-vertical.png');
const logoHorizontalDark = require('../../assets/safe-black-logo-horizontal.png');

// ─── Logo vertical — Login y Domain ──────────────────────────────────────────
export function ProlibuLogoVertical({ scale = 1, tagline }) {
  const { isDark } = useTheme();
  const width = Math.round(180 * scale);
  const height = Math.round(120 * scale);
  // light mode (fondo claro) → safe-white; dark mode (fondo oscuro) → safe-black
  const source = isDark ? logoVerticalDark : logoVerticalLight;
  return (
    <View style={styles.vertical}>
      <Image source={source} style={{ width, height }} resizeMode="contain" />
      {tagline ? (
        <Text style={[styles.tagline, { fontSize: Math.round(11 * scale), marginTop: Math.round(8 * scale) }]}>
          {tagline}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Logo horizontal — Headers ────────────────────────────────────────────────
export function ProlibuLogoHorizontal({ scale = 1 }) {
  const { isDark } = useTheme();
  const width = Math.round(130 * scale);
  const height = Math.round(36 * scale);
  // light mode (fondo claro) → safe-white; dark mode (fondo oscuro) → safe-black
  const source = isDark ? logoHorizontalDark : logoHorizontalLight;
  return (
    <Image source={source} style={{ width, height }} resizeMode="contain" />
  );
}

const styles = StyleSheet.create({
  vertical: { alignItems: 'center' },
  tagline: {
    color: '#888888',
    letterSpacing: 1,
  },
});
