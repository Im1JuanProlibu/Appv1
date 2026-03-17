import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

const BALLS = [
  { color: '#4285F4', delay: 0 },
  { color: '#FDBD00', delay: 400 },
  { color: '#D4145A', delay: 800 },
];

function Ball({ color, delay }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const easing = Easing.bezier(0.28, 0.84, 0.42, 1);
    const step = (toX, toScale) =>
      Animated.parallel([
        Animated.timing(translateX, { toValue: toX,     duration: 500, easing, useNativeDriver: true }),
        Animated.timing(scale,      { toValue: toScale, duration: 500, easing, useNativeDriver: true }),
      ]);

    const loop = Animated.loop(
      Animated.sequence([
        step(25, 1.2),
        step(50, 0.8),
        step(25, 1.2),
        step(0,  1.0),
      ])
    );

    let anim;
    if (delay > 0) {
      anim = Animated.sequence([Animated.delay(delay), loop]);
    } else {
      anim = loop;
    }

    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.ball,
        { backgroundColor: color, transform: [{ translateX }, { scale }] },
      ]}
    />
  );
}

// ─── Loader inline (3 pelotas) ────────────────────────────────────────────────
export function ProlibuSpinner() {
  return (
    <View style={styles.track}>
      {BALLS.map((b) => (
        <Ball key={b.color} color={b.color} delay={b.delay} />
      ))}
    </View>
  );
}

// ─── Overlay de pantalla completa ─────────────────────────────────────────────
export function ProlibuLoader({ visible = true, background = 'rgba(0,0,0,0.45)' }) {
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.overlay, { backgroundColor: background }]}>
      <ProlibuSpinner />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 75,
    height: 15,
    position: 'relative',
  },
  ball: {
    width: 15,
    height: 15,
    borderRadius: 8,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlay: {
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
