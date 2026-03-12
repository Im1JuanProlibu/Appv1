import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BLUE   = '#4285F4';
const YELLOW = '#FDBD00';
const RED    = '#D4145A';

/** Símbolo de marca Prolibu: ○ || › */
function BrandMark({ size = 1 }) {
  const circle   = Math.round(30 * size);
  const border   = Math.round(3.5 * size);
  const barW     = Math.round(4.5 * size);
  const barH     = Math.round(24 * size);
  const barGap   = Math.round(4 * size);
  const arrowSz  = Math.round(28 * size);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(6 * size) }}>
      {/* Círculo azul */}
      <View style={{
        width: circle, height: circle, borderRadius: circle / 2,
        borderWidth: border, borderColor: BLUE,
      }} />
      {/* Dos barras amarillas */}
      <View style={{ flexDirection: 'row', gap: barGap, alignItems: 'center', height: barH }}>
        <View style={{ width: barW, height: barH, backgroundColor: YELLOW, borderRadius: Math.round(barW / 2) }} />
        <View style={{ width: barW, height: barH, backgroundColor: YELLOW, borderRadius: Math.round(barW / 2) }} />
      </View>
      {/* Flecha roja */}
      <Text style={{ color: RED, fontSize: arrowSz, fontWeight: '900', lineHeight: Math.round(arrowSz * 1.15) }}>›</Text>
    </View>
  );
}

/** Logo vertical: símbolo arriba, texto PROLIBU abajo — para Login */
export function ProlibuLogoVertical({ size = 1 }) {
  const nameSz = Math.round(24 * size);
  const subSz  = Math.round(11 * size);
  return (
    <View style={styles.vertical}>
      <BrandMark size={size * 1.4} />
      <Text style={[styles.name, { fontSize: nameSz, marginTop: Math.round(14 * size) }]}>PROLIBU</Text>
      <Text style={[styles.sub, { fontSize: subSz }]}>Portal de Propuestas</Text>
    </View>
  );
}

/** Logo horizontal: símbolo a la izquierda, texto a la derecha — para header */
export function ProlibuLogoHorizontal({ size = 1 }) {
  const nameSz = Math.round(18 * size);
  return (
    <View style={styles.horizontal}>
      <BrandMark size={size} />
      <Text style={[styles.name, { fontSize: nameSz, letterSpacing: 5 }]}>PROLIBU</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  vertical:   { alignItems: 'center' },
  horizontal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: {
    color: '#111111',
    fontWeight: '900',
    letterSpacing: 7,
  },
  sub: {
    color: '#666666',
    marginTop: 6,
    letterSpacing: 1,
  },
});
