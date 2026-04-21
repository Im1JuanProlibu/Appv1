import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { setApiDomain } from '../api';
import { ProlibuLogoVertical } from '../components/ProlibuLogo';
import { useTranslation } from '../i18n';

const SUFFIXES = ['.prolibu.com', '.nodriza.io'];

export default function DomainScreen({ navigation }) {
  const { colors: COLORS, isDark } = useTheme();
  const { t } = useTranslation();
  const [subdomain, setSubdomain] = useState('');
  const [suffix, setSuffix] = useState('.prolibu.com');

  function handleContinue() {
    const clean = subdomain.trim().toLowerCase();
    if (!clean) {
      Alert.alert('Campo requerido', 'Ingresa el subdominio de tu cuenta.');
      return;
    }

    // If the user typed a full domain (contains a dot), use it as-is
    const domain = clean.includes('.') ? clean : `${clean}${suffix}`;
    setApiDomain(domain);
    AsyncStorage.setItem('domain', domain).then(() => {
      navigation.replace('Login');
    });
  }

  const styles = makeStyles(COLORS);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.bg} />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          {/* Logo area */}
          <View style={styles.logoArea}>
            <ProlibuLogoVertical scale={0.85} tagline="Gestión de propuestas" />
          </View>

          <Text style={styles.title}>{t('domainSetup')}</Text>
          <Text style={styles.desc}>{t('domainSetupDesc')}</Text>

          {/* Subdomain input */}
          <Text style={styles.label}>Subdominio</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="mi-empresa"
              placeholderTextColor={COLORS.textMuted}
              value={subdomain}
              onChangeText={setSubdomain}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>

          {/* Suffix selector */}
          <Text style={styles.label}>Plataforma</Text>
          <View style={styles.suffixRow}>
            {SUFFIXES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.suffixBtn, suffix === s && styles.suffixBtnActive]}
                onPress={() => setSuffix(s)}
                activeOpacity={0.8}
              >
                <Text style={[styles.suffixText, suffix === s && styles.suffixTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview */}
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>{t('domainUrlPreview')}</Text>
            <Text style={styles.previewUrl} numberOfLines={1}>
              {'https://'}
              {subdomain.trim() || 'mi-empresa'}
              {subdomain.trim().includes('.') ? '' : suffix}
              {'/v1'}
            </Text>
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.btnText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    kav: { flex: 1 },
    inner: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent: 'center',
    },
    logoArea: { alignItems: 'center', marginBottom: 36 },
    logoText: {
      fontSize: 20,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 8,
    },
    logoSub: { fontSize: 12, color: C.textMuted, marginTop: 4, letterSpacing: 1 },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: C.text,
      marginBottom: 6,
    },
    desc: {
      fontSize: 14,
      color: C.textMuted,
      marginBottom: 28,
      lineHeight: 20,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: C.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputRow: { marginBottom: 20 },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 15,
      color: C.text,
      backgroundColor: C.card,
    },
    suffixRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    suffixBtn: {
      flex: 1,
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.card,
    },
    suffixBtnActive: {
      borderColor: C.accent,
      backgroundColor: C.accent,
    },
    suffixText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
    suffixTextActive: { color: C.accentFg, fontWeight: '700' },
    previewBox: {
      backgroundColor: C.card,
      borderRadius: 10,
      padding: 12,
      marginBottom: 28,
      borderWidth: 1,
      borderColor: C.border,
    },
    previewLabel: { fontSize: 11, color: C.textMuted, marginBottom: 4 },
    previewUrl: { fontSize: 13, color: C.accent, fontWeight: '600' },
    btn: {
      height: 50,
      backgroundColor: C.accent,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: C.accentFg, fontSize: 16, fontWeight: '700' },
  });
}
