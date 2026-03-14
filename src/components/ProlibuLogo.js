import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const logoVertical   = require('../../assets/safe-white-logo-vertical.png');
const logoHorizontal = require('../../assets/safe-white-logo-horizontal.png');

// ─── Logo vertical — Login y Domain ──────────────────────────────────────────
export function ProlibuLogoVertical({ scale = 1, tagline }) {
  const width  = Math.round(180 * scale);
  const height = Math.round(120 * scale);
  return (
    <View style={styles.vertical}>
      <Image source={logoVertical} style={{ width, height }} resizeMode="contain" />
      {tagline ? (
        <Text style={[styles.tagline, { fontSize: Math.round(11 * scale), marginTop: Math.round(8 * scale) }]}>
          {tagline}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Logo horizontal — Header de Propuestas ───────────────────────────────────
export function ProlibuLogoHorizontal({ scale = 1 }) {
  const width  = Math.round(130 * scale);
  const height = Math.round(36 * scale);
  return (
    <Image source={logoHorizontal} style={{ width, height }} resizeMode="contain" />
  );
}

const styles = StyleSheet.create({
  vertical: { alignItems: 'center' },
  tagline: {
    color:         '#888888',
    letterSpacing: 1,
  },
});
