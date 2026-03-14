/**
 * ProlibuLogo — componente puro React Native (sin react-native-svg)
 * Reproduce el Brand Book v7:
 *   ○ círculo azul  |  || barras amarillas  |  ▶ triángulo rojo  |  PROLIBU
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
  const circleSize = Math.round(36 * s);
  const barW       = Math.round(5 * s);
  const barH       = Math.round(30 * s);
  const triH       = Math.round(28 * s);   // altura total del triángulo
  const triW       = Math.round(20 * s);   // base (ancho) del triángulo

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(6 * s) }}>

      {/* Círculo azul — ring sin relleno */}
      <View style={{
        width:        circleSize,
        height:       circleSize,
        borderRadius: circleSize / 2,
        borderWidth:  Math.round(3.5 * s),
        borderColor:  BLUE,
      }} />

      {/* Dos barras amarillas verticales */}
      <View style={{ flexDirection: 'row', gap: Math.round(4 * s), alignItems: 'center' }}>
        <View style={{
          width:           barW,
          height:          barH,
          borderRadius:    Math.round(barW / 2),
          backgroundColor: YELLOW,
        }} />
        <View style={{
          width:           barW,
          height:          barH,
          borderRadius:    Math.round(barW / 2),
          backgroundColor: YELLOW,
        }} />
      </View>

      {/* Triángulo rojo sólido apuntando a la derecha */}
      <View style={{
        width:               0,
        height:              0,
        borderTopWidth:      triH / 2,
        borderBottomWidth:   triH / 2,
        borderLeftWidth:     triW,
        borderTopColor:      'transparent',
        borderBottomColor:   'transparent',
        borderLeftColor:     RED,
      }} />

    </View>
  );
}

// ─── Logo vertical — Login y Domain ──────────────────────────────────────────
export function ProlibuLogoVertical({ scale = 1, tagline = 'Portal de Propuestas' }) {
  const s = scale;
  return (
    <View style={styles.vertical}>
      <BrandMark scale={s * 1.4} />
      <Text style={[styles.wordmark, {
        fontSize:    Math.round(26 * s),
        marginTop:   Math.round(16 * s),
        letterSpacing: Math.round(7 * s),
      }]}>
        PROLIBU
      </Text>
      <Text style={[styles.tagline, {
        fontSize: Math.round(11 * s),
        marginTop: Math.round(6 * s),
      }]}>
        {tagline}
      </Text>
    </View>
  );
}

// ─── Logo horizontal — Header de Propuestas ───────────────────────────────────
export function ProlibuLogoHorizontal({ scale = 1 }) {
  const s = scale;
  return (
    <View style={styles.horizontal}>
      <BrandMark scale={s * 0.8} />
      <Text style={[styles.wordmark, {
        fontSize:      Math.round(16 * s),
        letterSpacing: Math.round(5 * s),
        marginLeft:    Math.round(8 * s),
      }]}>
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
    letterSpacing: 1,
  },
});
