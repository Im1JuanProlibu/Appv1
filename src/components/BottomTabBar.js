import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';

const TABS = [
  { key: 'Proposals', label: 'Propuestas', icon: '⊞' },
  { key: 'Dashboard', label: 'Dashboard',  icon: '◉'  },
  { key: 'Reports',   label: 'Reportes',   icon: '▤'  },
  { key: 'Settings',  label: 'Ajustes',    icon: '⚙'  },
];

export default function BottomTabBar({ active, navigation }) {
  const { colors: COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(COLORS);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map(tab => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => {
              if (!isActive) navigation.navigate(tab.key);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            {isActive && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: C.card,
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 12,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
    },
    icon: {
      fontSize: 20,
      color: C.textMuted,
    },
    iconActive: {
      color: C.accent,
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      color: C.textMuted,
    },
    labelActive: {
      color: C.accent,
      fontWeight: '700',
    },
    activeDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.accent,
      marginTop: 1,
    },
  });
}
