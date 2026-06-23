import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIntegrationConfig } from '../api';
import BottomTabBar from '../components/BottomTabBar';
import { ProlibuLogoHorizontal } from '../components/ProlibuLogo';
import { useTheme } from '../ThemeContext';
import { useTranslation } from '../i18n';

// ─── Defaults ────────────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATES = {
  urgente: 'Hola {nombre}, vi que estuviste revisando nuestra propuesta "{propuesta}" y quedé pendiente de tus comentarios. ¿Qué te pareció? Quedo atento.',
  novista: 'Hola {nombre}, ¿tuviste oportunidad de revisar nuestra propuesta "{propuesta}"? Me gustaría saber si tienes alguna pregunta. Quedo atento.',
  envio: 'Hola {nombre}, te comparto nuestra propuesta comercial *"{propuesta}"*.\n\nPuedes revisarla aquí:\n{url}\n\nQuedo atento a tus comentarios.',
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
    desc: "Aparece cuando el cliente vio la propuesta en la última hora. Se usa en el botón '🔥 Seguimiento urgente'.",
    hint: 'Variables: {nombre}, {propuesta}, {url} · WhatsApp · máx ' + MAX_CHAR.urgente + ' caracteres',
    multiline: true,
    lines: 4,
  },
  {
    key: 'novista',
    title: 'Sin vistas — Contactar',
    desc: "Aparece cuando la propuesta lleva +7 días sin vistas. Se usa en el botón '📞 Sin vistas — Contactar'.",
    hint: 'Variables: {nombre}, {propuesta}, {url} · WhatsApp · máx ' + MAX_CHAR.novista + ' caracteres',
    multiline: true,
    lines: 4,
  },
  {
    key: 'envio',
    title: 'Mensaje de envío (WhatsApp)',
    desc: "Mensaje por defecto al presionar 'Enviar ↗' en una propuesta y elegir WhatsApp.",
    hint: 'Variables: {nombre}, {propuesta}, {url} · WhatsApp · máx ' + MAX_CHAR.envio + ' caracteres',
    multiline: true,
    lines: 5,
  },
  {
    key: 'emailAsunto',
    title: 'Asunto del email',
    desc: "Asunto del correo al enviar una propuesta por email desde el botón 'Enviar ↗'.",
    hint: 'Variables: {nombre}, {propuesta} · Email · máx ' + MAX_CHAR.emailAsunto + ' caracteres',
    multiline: false,
    lines: 1,
  },
  {
    key: 'emailCuerpo',
    title: 'Cuerpo del email',
    desc: 'Cuerpo del correo al enviar una propuesta por email. La URL se agrega automáticamente al final.',
    hint: 'Variables: {nombre}, {propuesta}, {url} · Email · máx ' + MAX_CHAR.emailCuerpo + ' caracteres',
    multiline: true,
    lines: 7,
  },
];

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const { isDark, toggleTheme, colors: COLORS } = useTheme();
  const { t, lang, setLang } = useTranslation();
  const [user, setUser] = useState({});
  const [domain, setDomain] = useState('');
  const [templates, setTemplates] = useState({ ...DEFAULT_TEMPLATES });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState(null); // null = cargando, Map tras cargar
  const [intLoading, setIntLoading] = useState(false);
  // HubSpot: lista de pipelines configurados [{label, pipeline, dealstage, deal_currency_code}]
  const [hsPipelines, setHsPipelines] = useState([]);
  const [hsDirty, setHsDirty] = useState(false);
  const [hsSaving, setHsSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['auth', 'domain', 'message_templates', 'account_integrations', 'hubspot_settings']).then(pairs => {
      const auth = pairs[0][1] ? JSON.parse(pairs[0][1]) : null;
      const dom = pairs[1][1] || '';
      const tplRaw = pairs[2][1] ? JSON.parse(pairs[2][1]) : null;
      const intRaw = pairs[3][1] ? JSON.parse(pairs[3][1]) : null;
      const hsRaw = pairs[4][1] ? JSON.parse(pairs[4][1]) : null;
      if (auth?.user) setUser(auth.user);
      setDomain(dom.replace(/^https?:\/\//i, '').replace(/\/v1$/, ''));
      if (tplRaw) setTemplates({ ...DEFAULT_TEMPLATES, ...tplRaw });
      if (hsRaw) {
        // Migrar formato viejo (objeto plano) → array
        if (Array.isArray(hsRaw)) {
          setHsPipelines(hsRaw);
        } else if (hsRaw.pipeline || hsRaw.dealstage) {
          setHsPipelines([{ label: 'Default', ...hsRaw }]);
        }
      }
      // Cargar integraciones desde cache si existen
      if (intRaw) setIntegrations(new Map(Object.entries(intRaw)));
      // Siempre refrescar desde la API si tenemos token
      if (auth?.token) loadIntegrations(auth.token);
    });
  }, []);

  const loadIntegrations = useCallback(async (token) => {
    setIntLoading(true);
    const groups = ['hubspot', 'zoho', 'zapsign', 'smarthome', 'alegra', 'salesforce', 'biopas', 'spiga'];
    const result = {};
    await Promise.allSettled(
      groups.map((group) =>
        getIntegrationConfig(token, group)
          .then((res) => {
            const obj = (res && typeof res === 'object' && !Array.isArray(res)) ? res : null;
            const active = obj?.active;
            result[group] = {
              active: !!(active && active !== 'false' && active !== false),
              config: obj,
            };
          })
          .catch(() => { result[group] = { active: false, config: null }; })
      )
    );
    setIntegrations(new Map(Object.entries(result)));
    await AsyncStorage.setItem('account_integrations', JSON.stringify(result));
    setIntLoading(false);
  }, []);

  function updateTemplate(key, val) {
    setTemplates(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  function updateHsPipeline(index, key, val) {
    setHsPipelines(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
    setHsDirty(true);
  }

  function addHsPipeline() {
    setHsPipelines(prev => [...prev, { label: '', pipeline: '', dealstage: '', deal_currency_code: '' }]);
    setHsDirty(true);
  }

  function removeHsPipeline(index) {
    setHsPipelines(prev => prev.filter((_, i) => i !== index));
    setHsDirty(true);
  }

  async function handleSaveHs() {
    setHsSaving(true);
    try {
      await AsyncStorage.setItem('hubspot_settings', JSON.stringify(hsPipelines));
      setHsDirty(false);
      Alert.alert('Guardado', 'La configuración de HubSpot se guardó correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    } finally {
      setHsSaving(false);
    }
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

  const styles = makeStyles(COLORS);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.bg} />

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
            <Text style={styles.saveBtnText}>{saving ? t('saving') : t('save')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">

        {/* ── Apariencia ── */}
        <Text style={styles.sectionLabel}>{t('appearance')}</Text>
        <View style={styles.card}>
          <View style={styles.themeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeLabel, { color: COLORS.text }]}>{t('darkMode')}</Text>
              <Text style={[styles.themeDesc, { color: COLORS.textMuted }]}>
                {t('darkModeDesc')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.themeToggle, isDark && styles.themeToggleOn]}
              onPress={toggleTheme}
              activeOpacity={0.8}
            >
              <View style={[styles.themeThumb, isDark && styles.themeThumbOn]} />
            </TouchableOpacity>
          </View>
          <View style={styles.cardDivider} />
          {/* Language toggle */}
          <View style={styles.themeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeLabel, { color: COLORS.text }]}>{t('language')}</Text>
              <Text style={[styles.themeDesc, { color: COLORS.textMuted }]}>{t('languageDesc')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['es', 'en'].map((l) => (
                <TouchableOpacity
                  key={l}
                  onPress={() => setLang(l)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: lang === l ? COLORS.accent : COLORS.border,
                    backgroundColor: lang === l ? COLORS.accent : COLORS.card,
                  }}
                >
                  <Text style={{ color: lang === l ? '#fff' : COLORS.text, fontWeight: '700', fontSize: 13 }}>
                    {l.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Cuenta ── */}
        <Text style={styles.sectionLabel}>{t('account')}</Text>
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
              <Text style={[styles.linkBtnText, { color: COLORS.error }]}>{t('logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Integraciones ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 6 }}>
          <Text style={[styles.sectionLabel, { marginBottom: 0, flex: 1 }]}>INTEGRACIONES</Text>
          <TouchableOpacity
            onPress={async () => {
              const raw = await AsyncStorage.getItem('auth');
              const auth = raw ? JSON.parse(raw) : null;
              if (auth?.token) loadIntegrations(auth.token);
            }}
            disabled={intLoading}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: '700' }}>
              {intLoading ? 'Actualizando...' : '↻ Actualizar'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {integrations === null ? (
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
              {intLoading ? 'Detectando integraciones...' : 'Sin datos aún'}
            </Text>
          ) : [...integrations.entries()].map(([group, info], i, arr) => {
            // Eventos que dispara cada integración al crear/actualizar propuestas
            const EVENTS = {
              hubspot: 'proposal_create → deal',
              zoho: 'proposal_create → quote',
              salesforce: 'proposal_create → contact-form',
              zapsign: 'proposal_create → firma',
              smarthome: 'afterValidate → sync',
              alegra: 'proposal_create → factura',
              biopas: 'proposal_changeStatus → SAP',
              spiga: 'proposal_changeStatus → SOAP',
            };
            return (
              <View key={group}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
                  <View style={{
                    width: 9, height: 9, borderRadius: 5, marginRight: 10,
                    backgroundColor: info.active ? '#22c55e' : COLORS.border,
                  }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 13, textTransform: 'uppercase' }}>
                      {group}
                    </Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 1 }}>
                      {EVENTS[group] || 'Integración'}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: info.active ? '#22c55e20' : COLORS.border + '40',
                    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
                  }}>
                    <Text style={{
                      fontSize: 11, fontWeight: '700',
                      color: info.active ? '#22c55e' : COLORS.textMuted,
                    }}>
                      {info.active ? 'ACTIVA' : 'INACTIVA'}
                    </Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={styles.cardDivider} />}
              </View>
            );
          })}
        </View>
        {/* ── Config HubSpot (solo si activa) ── */}
        {integrations?.get('hubspot')?.active && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 6 }}>
              <Text style={[styles.sectionLabel, { marginBottom: 0, flex: 1 }]}>CONFIGURACIÓN HUBSPOT</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={addHsPipeline} activeOpacity={0.7}>
                  <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: '700' }}>＋ Agregar</Text>
                </TouchableOpacity>
                {hsDirty && (
                  <TouchableOpacity onPress={handleSaveHs} disabled={hsSaving} activeOpacity={0.7}>
                    <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: '700' }}>
                      {hsSaving ? 'Guardando...' : '💾 Guardar'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {hsPipelines.length === 0 ? (
              <View style={styles.card}>
                <Text style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>
                  Sin pipelines configurados. Presiona "＋ Agregar" para crear uno.
                </Text>
              </View>
            ) : hsPipelines.map((pipe, idx) => (
              <View key={idx} style={[styles.card, { marginBottom: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14, flex: 1 }}>
                    {pipe.label || `Pipeline ${idx + 1}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Eliminar', `¿Eliminar "${pipe.label || `Pipeline ${idx + 1}`}"?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Eliminar', style: 'destructive', onPress: () => removeHsPipeline(idx) },
                    ])}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, color: COLORS.error, fontWeight: '700' }}>✕ Eliminar</Text>
                  </TouchableOpacity>
                </View>
                {[
                  { key: 'label', label: 'Nombre', placeholder: 'Ej: Voyah, Shacman, Default...' },
                  { key: 'pipeline', label: 'Pipeline ID', placeholder: 'Ej: 1000390393' },
                  { key: 'dealstage', label: 'Deal Stage ID', placeholder: 'Ej: 1531786953' },
                  { key: 'deal_currency_code', label: 'Moneda', placeholder: 'Ej: COP, USD' },
                ].map((field, fi) => (
                  <View key={field.key} style={{ marginBottom: fi < 3 ? 10 : 0 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{field.label}</Text>
                    <TextInput
                      style={{
                        backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
                        borderRadius: 10, padding: 10, fontSize: 13, color: COLORS.text,
                      }}
                      value={pipe[field.key]}
                      onChangeText={val => updateHsPipeline(idx, field.key, field.key === 'label' ? val : val.trim())}
                      placeholder={field.placeholder}
                      placeholderTextColor={COLORS.textMuted + '80'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
        {/* ── Variables disponibles ── */}
        <Text style={styles.sectionLabel}>VARIABLES DISPONIBLES</Text>
        <View style={styles.varsCard}>
          {[
            ['{nombre}', 'Nombre del cliente'],
            ['{propuesta}', 'Título de la propuesta'],
            ['{url}', 'Enlace a la propuesta (solo envío)'],
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
        <Text style={styles.sectionLabel}>{t('templatesSection')}</Text>
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
function makeStyles(C) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    headerTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
    saveBtn: {
      backgroundColor: C.accent, borderRadius: 10,
      paddingHorizontal: 18, paddingVertical: 9,
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    scroll: { padding: 20, paddingBottom: 16 },
    sectionLabel: {
      color: C.textMuted, fontSize: 10, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 1.5,
      marginBottom: 10, marginTop: 6,
    },

    // Cuenta
    card: {
      backgroundColor: C.card, borderRadius: 16,
      borderWidth: 1, borderColor: C.border,
      padding: 16, marginBottom: 20,
    },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarCircle: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    accountName: { color: C.text, fontSize: 16, fontWeight: '700' },
    accountEmail: { color: C.textMuted, fontSize: 12, marginTop: 2 },
    accountDomain: { color: C.textMuted, fontSize: 11, marginTop: 2 },
    cardDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
    accountBtns: { flexDirection: 'row', gap: 10 },
    linkBtn: {
      flex: 1, borderRadius: 10, borderWidth: 1, borderColor: C.border,
      paddingVertical: 10, alignItems: 'center',
    },
    linkBtnText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },

    // Variables
    varsCard: {
      backgroundColor: C.card, borderRadius: 14,
      borderWidth: 1, borderColor: C.border,
      padding: 14, marginBottom: 20, gap: 10,
    },
    varRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    varChip: {
      backgroundColor: C.accent + '15', borderRadius: 8,
      borderWidth: 1, borderColor: C.accent + '40',
      paddingHorizontal: 8, paddingVertical: 4,
    },
    varCode: { color: C.accent, fontWeight: '700', fontSize: 12, fontFamily: 'monospace' },
    varDesc: { color: C.textMuted, fontSize: 12 },

    // Plantillas
    templateBlock: {
      backgroundColor: C.card, borderRadius: 14,
      borderWidth: 1, borderColor: C.border,
      padding: 14, marginBottom: 12,
    },
    templateTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
    templateDesc: { color: C.textMuted, fontSize: 11, marginBottom: 10 },
    templateInput: {
      backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
      borderRadius: 10, padding: 12, fontSize: 13, color: C.text,
      lineHeight: 19,
    },
    templateFooter: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'flex-start', marginTop: 6,
    },
    templateHint: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 4,
      lineHeight: 16,
      flexWrap: 'wrap',
      flex: 1,
      flexShrink: 1,
    },
    templateCounter: { color: C.textMuted, fontSize: 11, fontWeight: '600', marginLeft: 8 },

    resetBtn: {
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      padding: 14, alignItems: 'center', marginTop: 4,
    },
    resetBtnText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },

    themeRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    themeLabel: { fontSize: 15, fontWeight: '600' },
    themeDesc: { fontSize: 12, marginTop: 2 },
    themeToggle: {
      width: 50, height: 28, borderRadius: 14,
      backgroundColor: C.border, justifyContent: 'center',
      paddingHorizontal: 2,
    },
    themeToggleOn: { backgroundColor: C.accent },
    themeThumb: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
    },
    themeThumbOn: { alignSelf: 'flex-end' },
  });
}
