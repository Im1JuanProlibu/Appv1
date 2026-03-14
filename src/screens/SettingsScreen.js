import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import { getApiBase } from '../api';
import BottomTabBar from '../components/BottomTabBar';
import { ProlibuLogoHorizontal } from '../components/ProlibuLogo';

// ─── Defaults ────────────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATES = {
  urgente:   'Hola {nombre}, vi que estuviste revisando nuestra propuesta "{propuesta}" y quedé pendiente de tus comentarios. ¿Qué te pareció? Quedo atento.',
  novista:   'Hola {nombre}, ¿tuviste oportunidad de revisar nuestra propuesta "{propuesta}"? Me gustaría saber si tienes alguna pregunta. Quedo atento.',
  envio:     'Hola {nombre}, te comparto nuestra propuesta comercial *"{propuesta}"*.\n\nPuedes revisarla aquí:\n{url}\n\nQuedo atento a tus comentarios.',
  emailAsunto: 'Propuesta comercial: {propuesta}',
  emailCuerpo: 'Hola {nombre},\n\nEspero que te encuentres muy bien. Te compartimos nuestra propuesta comercial "{propuesta}" para tu revisión.\n\nPuedes acceder a ella en el siguiente enlace:\n{url}\n\nQuedo atento a tus comentarios y cualquier duda.\n\nSaludos cordiales,',
};

const MAX_CHAR = {
  urgente: 300,
  novista: 300,
  envio: 400,
  emailAsunto: 120,
  emailCuerpo: 600,
};

const TEMPLATE_FIELDS = [
  {
    key: 'urgente',
    title: 'Seguimiento urgente',
    desc: 'Se muestra cuando el cliente vio la propuesta recientemente.',
    hint: 'WhatsApp · máx ' + MAX_CHAR.urgente + ' caracteres',
    multiline: true,
    lines: 4,
  },
  {
    key: 'novista',
    title: 'Sin vistas — Contactar',
    desc: 'Se muestra cuando la propuesta lleva más de 7 días sin ser vista.',
    hint: 'WhatsApp · máx ' + MAX_CHAR.novista + ' caracteres',
    multiline: true,
    lines: 4,
  },
  {
    key: 'envio',
    title: 'Mensaje de envío (WhatsApp)',
    desc: 'Mensaje por defecto al compartir una propuesta por WhatsApp.',
    hint: 'WhatsApp · máx ' + MAX_CHAR.envio + ' caracteres',
    multiline: true,
    lines: 5,
  },
  {
    key: 'emailAsunto',
    title: 'Asunto del email',
    desc: 'Asunto por defecto al enviar la propuesta por correo.',
    hint: 'Email · máx ' + MAX_CHAR.emailAsunto + ' caracteres',
    multiline: false,
    lines: 1,
  },
  {
    key: 'emailCuerpo',
    title: 'Cuerpo del email',
    desc: 'Cuerpo por defecto al enviar la propuesta por correo.',
    hint: 'Email · máx ' + MAX_CHAR.emailCuerpo + ' caracteres',
    multiline: true,
    lines: 7,
  },
];

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const [user, setUser]           = useState({});
  const [domain, setDomain]       = useState('');
  const [templates, setTemplates] = useState({ ...DEFAULT_TEMPLATES });
  const [dirty, setDirty]         = useState(false);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['auth', 'domain', 'message_templates']).then(pairs => {
      const auth    = pairs[0][1] ? JSON.parse(pairs[0][1]) : null;
      const dom     = pairs[1][1] || '';
      const tplRaw  = pairs[2][1] ? JSON.parse(pairs[2][1]) : null;
      if (auth?.user) setUser(auth.user);
      setDomain(dom.replace(/^https?:\/\//i, '').replace(/\/v1$/, ''));
      if (tplRaw) setTemplates({ ...DEFAULT_TEMPLATES, ...tplRaw });
    });
  }, []);

  function updateTemplate(key, val) {
    setTemplates(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await AsyncStorage.setItem('message_templates', JSON.stringify(templates));
      setDirty(false);
      Alert.alert('Guardado', 'Las plantillas se guardaron correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    Alert.alert(
      'Restaurar predeterminados',
      '¿Quieres restablecer todas las plantillas al texto original?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          style: 'destructive',
          onPress: () => {
            setTemplates({ ...DEFAULT_TEMPLATES });
            setDirty(true);
          },
        },
      ]
    );
  }

  async function handleLogout() {
    Alert.alert(
      'Cerrar sesión',
      '¿Salir de la cuenta actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['auth']);
            navigation.replace('Login');
          },
        },
      ]
    );
  }

  async function handleChangeDomain() {
    Alert.alert(
      'Cambiar servidor',
      'Esto cerrará tu sesión y te pedirá configurar el dominio nuevamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['domain', 'auth']);
            navigation.replace('Domain');
          },
        },
      ]
    );
  }

  const userName = user.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : (user.name || user.email || '');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <ProlibuLogoHorizontal scale={1} />
        <View style={{ flex: 1 }} />
        {dirty && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">

        {/* ── Cuenta ── */}
        <Text style={styles.sectionLabel}>CUENTA</Text>
        <View style={styles.card}>
          <View style={styles.accountRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(user.firstName || user.email || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{userName || '—'}</Text>
              <Text style={styles.accountEmail}>{user.email || '—'}</Text>
              <Text style={styles.accountDomain}>{domain}</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.accountBtns}>
            <TouchableOpacity style={styles.linkBtn} onPress={handleChangeDomain} activeOpacity={0.7}>
              <Text style={styles.linkBtnText}>Cambiar servidor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkBtn, { borderColor: COLORS.error + '50' }]} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={[styles.linkBtnText, { color: COLORS.error }]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Variables disponibles ── */}
        <Text style={styles.sectionLabel}>VARIABLES DISPONIBLES</Text>
        <View style={styles.varsCard}>
          {[
            ['{nombre}',    'Nombre del cliente'],
            ['{propuesta}', 'Título de la propuesta'],
            ['{url}',       'Enlace a la propuesta (solo envío)'],
          ].map(([v, d]) => (
            <View key={v} style={styles.varRow}>
              <View style={styles.varChip}>
                <Text style={styles.varCode}>{v}</Text>
              </View>
              <Text style={styles.varDesc}>{d}</Text>
            </View>
          ))}
        </View>

        {/* ── Plantillas de mensaje ── */}
        <Text style={styles.sectionLabel}>PLANTILLAS DE MENSAJE</Text>
        {TEMPLATE_FIELDS.map(f => {
          const val = templates[f.key] || '';
          const maxLen = MAX_CHAR[f.key];
          const remaining = maxLen - val.length;
          const overLimit = remaining < 0;
          return (
            <View key={f.key} style={styles.templateBlock}>
              <Text style={styles.templateTitle}>{f.title}</Text>
              <Text style={styles.templateDesc}>{f.desc}</Text>
              <TextInput
                style={[
                  styles.templateInput,
                  f.multiline && { height: f.lines * 22 + 24, textAlignVertical: 'top' },
                  overLimit && { borderColor: COLORS.error },
                ]}
                value={val}
                onChangeText={text => updateTemplate(f.key, text.slice(0, maxLen + 20))}
                multiline={f.multiline}
                maxLength={maxLen + 20}
                placeholder={DEFAULT_TEMPLATES[f.key]}
                placeholderTextColor={COLORS.textMuted + '80'}
                autoCorrect={false}
              />
              <View style={styles.templateFooter}>
                <Text style={styles.templateHint}>{f.hint}</Text>
                <Text style={[styles.templateCounter, overLimit && { color: COLORS.error }]}>
                  {val.length}/{maxLen}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Botón restaurar */}
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.resetBtnText}>↺  Restaurar plantillas predeterminadas</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      <BottomTabBar active="Settings" navigation={navigation} />
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  saveBtn: {
    backgroundColor: COLORS.accent, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { padding: 20, paddingBottom: 16 },
  sectionLabel: {
    color: COLORS.textMuted, fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.5,
    marginBottom: 10, marginTop: 6,
  },

  // Cuenta
  card: {
    backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 20,
  },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center',
  },
  avatarText:    { color: '#fff', fontSize: 20, fontWeight: '800' },
  accountName:   { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  accountEmail:  { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  accountDomain: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  cardDivider:   { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  accountBtns:   { flexDirection: 'row', gap: 10 },
  linkBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 10, alignItems: 'center',
  },
  linkBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },

  // Variables
  varsCard: {
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 20, gap: 10,
  },
  varRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  varChip: {
    backgroundColor: COLORS.accent + '15', borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.accent + '40',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  varCode: { color: COLORS.accent, fontWeight: '700', fontSize: 12, fontFamily: 'monospace' },
  varDesc: { color: COLORS.textMuted, fontSize: 12 },

  // Plantillas
  templateBlock: {
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 12,
  },
  templateTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  templateDesc:  { color: COLORS.textMuted, fontSize: 11, marginBottom: 10 },
  templateInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, fontSize: 13, color: COLORS.text,
    lineHeight: 19,
  },
  templateFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 6,
  },
  templateHint:    { color: COLORS.textMuted, fontSize: 10 },
  templateCounter: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },

  resetBtn: {
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, alignItems: 'center', marginTop: 4,
  },
  resetBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
});
