/**
 * ProlibuLogo — componente puro React Native (sin react-native-svg)
 * Reproduce fielmente el Brand Book v7:
 *   ○  círculo azul  |  || barras amarillas  |  ›› flecha roja  |  PROLIBU
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BLUE   = '#4285F4';
const YELLOW = '#FDBD00';
const RED    = '#D4145A';
const DARK   = '#111111';

// ─── Símbolo de marca ─────────────────────────────────────────────────────────
function BrandMark({ scale = 1 }) {
  const s = scale;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(5 * s) }}>

      {/* Círculo azul — ring sin relleno */}
      <View style={{
        width:        Math.round(34 * s),
        height:       Math.round(34 * s),
        borderRadius: Math.round(17 * s),
        borderWidth:  Math.round(3.5 * s),
        borderColor:  BLUE,
      }} />

      {/* Dos barras amarillas verticales */}
      <View style={{ flexDirection: 'row', gap: Math.round(4 * s), alignItems: 'center' }}>
        <View style={{
          width:        Math.round(5 * s),
          height:       Math.round(26 * s),
          borderRadius: Math.round(2.5 * s),
          backgroundColor: YELLOW,
        }} />
        <View style={{
          width:        Math.round(5 * s),
          height:       Math.round(26 * s),
          borderRadius: Math.round(2.5 * s),
          backgroundColor: YELLOW,
        }} />
      </View>

      {/* Flecha roja — doble chevron » */}
      <Text style={{
        color:      RED,
        fontSize:   Math.round(26 * s),
        fontWeight: '900',
        lineHeight: Math.round(32 * s),
        marginLeft: Math.round(-2 * s),
      }}>›</Text>

    </View>
  );
}

// ─── Logo vertical — Login ────────────────────────────────────────────────────
export function ProlibuLogoVertical({ scale = 1 }) {
  const s = scale;
  return (
    <View style={styles.vertical}>
      <BrandMark scale={s * 1.5} />
      <Text style={[styles.wordmark, { fontSize: Math.round(26 * s), marginTop: Math.round(16 * s), letterSpacing: Math.round(7 * s) }]}>
        PROLIBU
      </Text>
      <Text style={[styles.tagline, { fontSize: Math.round(11 * s), marginTop: Math.round(6 * s) }]}>
        Portal de Propuestas
      </Text>
    </View>
  );
}

// ─── Logo horizontal — Header ─────────────────────────────────────────────────
export function ProlibuLogoHorizontal({ scale = 1 }) {
  const s = scale;
  return (
    <View style={styles.horizontal}>
      <BrandMark scale={s * 0.85} />
      <Text style={[styles.wordmark, { fontSize: Math.round(17 * s), letterSpacing: Math.round(5 * s), marginLeft: Math.round(8 * s) }]}>
        PROLIBU
      </Text>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  vertical:   { alignItems: 'center' },
  horizontal: { flexDirection: 'row', alignItems: 'center' },
  wordmark: {
    color:      DARK,
    fontWeight: '900',
  },
  tagline: {
    color:         '#888888',
    letterSpacing: 0.8,
  },
});
