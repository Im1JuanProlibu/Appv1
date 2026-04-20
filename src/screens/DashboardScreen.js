import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  RefreshControl,
  Animated,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { getProposals, getActiveUsers } from '../api';
import BottomTabBar from '../components/BottomTabBar';
import { ProlibuLogoHorizontal } from '../components/ProlibuLogo';
import { ProlibuLoader } from '../components/ProlibuLoader';
import { Fire, Thermometer, Snowflake, ArrowClockwise, CaretDown, X, Check } from 'phosphor-react-native';

// ─── Config ───────────────────────────────────────────────────────────────────
// Brand colors are the same in both themes — use hardcoded hex values
const STATUS_CONFIG = [
  { key: 'Draft',    label: 'Borrador', color: '#FDBD00' },
  { key: 'Ready',    label: 'Lista',    color: '#4285F4' },
  { key: 'Approved', label: 'Aprobada', color: '#39B54A' },
  { key: 'Denied',   label: 'Negada',   color: '#D4145A' },
];

const TEMP_CONFIG = [
  { key: 'Hot',  label: 'Caliente', color: '#FF5722', Icon: Fire        },
  { key: 'Warm', label: 'Tibia',    color: '#F59E0B', Icon: Thermometer },
  { key: 'Cold', label: 'Fría',     color: '#60A5FA', Icon: Snowflake   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeStats(proposals) {
  const total = proposals.length;
  const byStatus = {};
  STATUS_CONFIG.forEach(s => {
    byStatus[s.key] = proposals.filter(p => p.status === s.key).length;
  });
  const closed         = byStatus.Approved + byStatus.Denied;
  const conversionRate = closed > 0 ? Math.round((byStatus.Approved / closed) * 100) : null;
  const lossRate       = closed > 0 ? Math.round((byStatus.Denied   / closed) * 100) : null;

  const byRating = {};
  TEMP_CONFIG.forEach(t => { byRating[t.key] = proposals.filter(p => p.rating === t.key).length; });

  let totalAmount = 0, approvedAmount = 0, pipelineAmount = 0;
  proposals.forEach(p => {
    const amt = parseFloat(p.total || p.amount || 0);
    if (!isNaN(amt)) {
      totalAmount += amt;
      if (p.status === 'Approved') approvedAmount += amt;
      if (p.status === 'Draft' || p.status === 'Ready') pipelineAmount += amt;
    }
  });

  const now  = Date.now();
  const ms7  = 7  * 24 * 60 * 60 * 1000;
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  const parseDate = (raw) => {
    if (!raw) return new Date(0);
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(raw);
  };
  const recent7  = proposals.filter(p => (now - parseDate(p.updatedAt || p.createdAt).getTime()) < ms7).length;
  const recent30 = proposals.filter(p => (now - parseDate(p.updatedAt || p.createdAt).getTime()) < ms30).length;

  return { total, byStatus, conversionRate, lossRate, byRating, totalAmount, approvedAmount, pipelineAmount, recent7, recent30 };
}

function formatAmount(n) {
  if (!n || n === 0) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

// ─── Componentes de gráficas (pure View) ─────────────────────────────────────

/** Barra segmentada multicolor */
function SegmentedBar({ segments, total, height = 16 }) {
  const { colors: COLORS } = useTheme();
  if (!total) return null;
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: COLORS.border }}>
      {segments.filter(s => s.value > 0).map(s => (
        <View key={s.key} style={{ flex: s.value / total, backgroundColor: s.color }} />
      ))}
    </View>
  );
}

/** Gráfica de columnas verticales */
function ColumnChart({ bars, chartHeight = 110 }) {
  const { colors: COLORS } = useTheme();
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight + 52, gap: 10 }}>
      {bars.map(b => {
        const barH = Math.max((b.value / maxVal) * chartHeight, b.value > 0 ? 6 : 0);
        return (
          <View key={b.key} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: b.color, fontWeight: '800', fontSize: 14, marginBottom: 4 }}>{b.value}</Text>
            <View style={{ width: '100%', height: chartHeight, justifyContent: 'flex-end', alignItems: 'center' }}>
              <View style={{ width: '70%', height: barH, backgroundColor: b.color, borderRadius: 6 }} />
            </View>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.color, marginTop: 6 }} />
            <Text style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: '700', marginTop: 3, textAlign: 'center' }}>
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Progress bar con etiquetas */
function ProgressRow({ label, value, total, color, sub, styles }) {
  const pct     = total > 0 ? value / total : 0;
  const pctText = total > 0 ? `${Math.round(pct * 100)}%` : '—';
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={styles.progressLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {sub ? <Text style={styles.progressSub}>{sub}</Text> : null}
          <Text style={[styles.progressPct, { color }]}>{pctText}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { flex: pct, backgroundColor: color }]} />
        <View style={{ flex: Math.max(1 - pct, 0.001) }} />
      </View>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { colors: COLORS, isDark } = useTheme();
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats]           = useState(null);
  const [userName, setUserName]     = useState('');
  const [auth, setAuth]             = useState(null);
  const [userId, setUserId]         = useState(null);
  const [isAdmin, setIsAdmin]       = useState(false);
  // viewMode: 'mine' | 'all' | 'agent'
  const [viewMode, setViewMode]     = useState('mine');
  const [agentsList, setAgentsList] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null); // { id, name }
  const [agentPickerVisible, setAgentPickerVisible] = useState(false);
  const authRef  = useRef(null);
  const userIdRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('auth').then(val => {
      if (!val) { navigation.replace('Login'); return; }
      const authData = JSON.parse(val);
      const user = authData.user || {};
      const id   = authData.userId || user._id || user.id || '';
      const name = user.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : (user.name || user.email || 'Mi cuenta');
      const adminFlag = user.isAdmin === true;
      authRef.current = authData;
      userIdRef.current = id;
      setAuth(authData);
      setUserId(id);
      setUserName(name);
      setIsAdmin(adminFlag);
      load(id, authData.token); // siempre arranca con "Mis datos"
      if (adminFlag) {
        getActiveUsers(authData.token).then(res => {
          const all = res.docs || res.data || (Array.isArray(res) ? res : []);
          setAgentsList(all
            .filter(u => u.home === '/app/dashboard' && u.status === 'active')
            .map(u => ({
              id: u.id || u._id,
              name: u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u.email || u.id),
            }))
          );
        }).catch(() => {});
      }
    });
  }, []);

  async function load(agentId, token, limit = 200) {
    fadeAnim.setValue(0);
    const minDelay = new Promise(r => setTimeout(r, 400));
    try {
      const [res] = await Promise.all([getProposals(agentId, token, 1, limit), minDelay]);
      const raw = res.docs || res.data || (Array.isArray(res) ? res : []);
      const proposals = (Array.isArray(raw) ? raw : []).filter(p =>
        ['Draft', 'Ready', 'Approved', 'Denied'].includes(p.status)
      );
      setStats(computeStats(proposals));
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function applyViewMode(mode, agent = null) {
    setViewMode(mode);
    setSelectedAgent(agent);
    setAgentPickerVisible(false);
    setLoading(true);
    setStats(null);
    if (!authRef.current) return;
    const token = authRef.current.token;
    if (mode === 'mine')  load(userIdRef.current, token, 200);
    if (mode === 'all')   load(null, token, 500);
    if (mode === 'agent' && agent) load(agent.id, token, 200);
  }

  function onRefresh() {
    if (!authRef.current) return;
    setRefreshing(true);
    const token = authRef.current.token;
    if (viewMode === 'mine')  load(userIdRef.current, token, 200);
    if (viewMode === 'all')   load(null, token, 500);
    if (viewMode === 'agent' && selectedAgent) load(selectedAgent.id, token, 200);
  }

  const styles = makeStyles(COLORS);

  // Etiqueta del modo actual
  const viewLabel = viewMode === 'mine' ? `Mis datos · ${userName}`
    : viewMode === 'all'  ? 'Toda la plataforma'
    : `Asesor: ${selectedAgent?.name || ''}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <ProlibuLogoHorizontal scale={1} />
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
          <ArrowClockwise size={22} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Selector de vista (solo admin) */}
      {isAdmin && (
        <View style={styles.viewSelector}>
          {[
            { mode: 'mine',  label: 'Mis datos' },
            { mode: 'all',   label: 'Plataforma' },
          ].map(opt => (
            <TouchableOpacity
              key={opt.mode}
              style={[styles.viewChip, viewMode === opt.mode && styles.viewChipActive]}
              onPress={() => applyViewMode(opt.mode)}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewChipText, viewMode === opt.mode && styles.viewChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.viewChip, styles.viewChipAgent, viewMode === 'agent' && styles.viewChipActive]}
            onPress={() => setAgentPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewChipText, viewMode === 'agent' && styles.viewChipTextActive]} numberOfLines={1}>
              {viewMode === 'agent' ? selectedAgent?.name : 'Asesor'}
            </Text>
            <CaretDown size={13} color={viewMode === 'agent' ? COLORS.accentFg : COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Etiqueta de contexto */}
      {!isAdmin && (
        <View style={styles.contextRow}>
          <Text style={styles.contextText}>{userName}</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
      {loading ? (
        <ProlibuLoader visible={true} background="transparent" />
      ) : !stats ? (
        <View style={styles.errorContainer}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📊</Text>
          <Text style={styles.errorText}>No se pudieron cargar las estadísticas</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryBtn} activeOpacity={0.8}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh}
              tintColor="transparent" colors={['transparent']} />
          }
        >
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ══ KPIs principales ══ */}
            <Text style={styles.sectionLabel}>RESUMEN GENERAL</Text>
            <View style={styles.kpiGrid}>
              {/* Card grande — total */}
              <View style={[styles.kpiCard, styles.kpiCardAccent]}>
                <Text style={[styles.kpiValue, { color: COLORS.accent, fontSize: 42 }]}>{stats.total}</Text>
                <Text style={styles.kpiLabel}>Propuestas totales</Text>
                <View style={styles.kpiTagRow}>
                  <View style={[styles.kpiTag, { backgroundColor: COLORS.accent + '20' }]}>
                    <Text style={[styles.kpiTagText, { color: COLORS.accent }]}>7d · {stats.recent7}</Text>
                  </View>
                  <View style={[styles.kpiTag, { backgroundColor: COLORS.accent + '20' }]}>
                    <Text style={[styles.kpiTagText, { color: COLORS.accent }]}>30d · {stats.recent30}</Text>
                  </View>
                </View>
              </View>

              <View style={{ gap: 10, flex: 1 }}>
                {/* Conversión */}
                <View style={[styles.kpiCard, stats.conversionRate !== null && stats.conversionRate >= 50
                  ? styles.kpiCardGreen : styles.kpiCardRed]}>
                  <Text style={[styles.kpiValue, {
                    color: stats.conversionRate !== null
                      ? (stats.conversionRate >= 50 ? COLORS.success : COLORS.error)
                      : COLORS.textMuted,
                    fontSize: 26,
                  }]}>
                    {stats.conversionRate !== null ? `${stats.conversionRate}%` : '—'}
                  </Text>
                  <Text style={styles.kpiLabel}>Tasa de cierre</Text>
                </View>
                {/* Pérdida */}
                <View style={[styles.kpiCard, { borderColor: COLORS.denied + '40' }]}>
                  <Text style={[styles.kpiValue, { color: COLORS.denied, fontSize: 26 }]}>
                    {stats.lossRate !== null ? `${stats.lossRate}%` : '—'}
                  </Text>
                  <Text style={styles.kpiLabel}>Tasa de pérdida</Text>
                </View>
              </View>
            </View>

            {/* Pipeline rápido */}
            <View style={styles.pipeRow}>
              {[
                { label: 'Borrador',    val: stats.byStatus.Draft,    color: '#FDBD00' },
                { label: 'Lista',       val: stats.byStatus.Ready,    color: '#4285F4' },
                { label: 'Aprobada',    val: stats.byStatus.Approved, color: '#39B54A' },
                { label: 'Negada',      val: stats.byStatus.Denied,   color: '#D4145A' },
              ].map(item => (
                <View key={item.label} style={styles.pipeCard}>
                  <View style={[styles.pipeDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.pipeNum, { color: item.color }]}>{item.val}</Text>
                  <Text style={styles.pipeLbl}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* ══ Distribución por estado ══ */}
            <Text style={styles.sectionLabel}>DISTRIBUCIÓN POR ESTADO</Text>
            <View style={styles.card}>
              <SegmentedBar
                segments={STATUS_CONFIG.map(s => ({ key: s.key, value: stats.byStatus[s.key] || 0, color: s.color }))}
                total={stats.total}
                height={18}
              />
              <View style={{ marginTop: 16, gap: 10 }}>
                {STATUS_CONFIG.map(s => {
                  const count = stats.byStatus[s.key] || 0;
                  const pct   = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <View key={s.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={styles.legendLabel}>{s.label}</Text>
                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <View style={styles.legendTrack}>
                          <View style={{ flex: count / (stats.total || 1), backgroundColor: s.color, borderRadius: 3 }} />
                          <View style={{ flex: Math.max(1 - count / (stats.total || 1), 0.001) }} />
                        </View>
                      </View>
                      <Text style={[styles.legendCount, { color: s.color }]}>{count}</Text>
                      <Text style={styles.legendPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ══ Gráfica de columnas ══ */}
            <Text style={styles.sectionLabel}>COMPARATIVA DE ESTADOS</Text>
            <View style={styles.card}>
              <ColumnChart
                bars={STATUS_CONFIG.map(s => ({
                  key: s.key, label: s.label,
                  value: stats.byStatus[s.key] || 0,
                  color: s.color,
                }))}
                chartHeight={110}
              />
            </View>

            {/* ══ Temperatura ══ */}
            <Text style={styles.sectionLabel}>TEMPERATURA</Text>
            <View style={styles.tempRow}>
              {TEMP_CONFIG.map(t => {
                const count = stats.byRating[t.key] || 0;
                const pct   = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <View key={t.key} style={[styles.tempCard, { borderColor: t.color + '55' }]}>
                    <t.Icon size={22} color={t.color} weight="fill" />
                    <Text style={[styles.tempNum, { color: t.color }]}>{count}</Text>
                    <Text style={styles.tempLabel}>{t.label}</Text>
                    <View style={[styles.tempPill, { backgroundColor: t.color + '20' }]}>
                      <Text style={[styles.tempPct, { color: t.color }]}>{pct}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ══ Embudo de cierre ══ */}
            {stats.byStatus.Approved + stats.byStatus.Denied > 0 && (
              <>
                <Text style={styles.sectionLabel}>EMBUDO DE CIERRE</Text>
                <View style={styles.card}>
                  <ProgressRow
                    label="Aprobadas"
                    value={stats.byStatus.Approved}
                    total={stats.byStatus.Approved + stats.byStatus.Denied}
                    color={COLORS.success}
                    sub={String(stats.byStatus.Approved)}
                    styles={styles}
                  />
                  <ProgressRow
                    label="Negadas"
                    value={stats.byStatus.Denied}
                    total={stats.byStatus.Approved + stats.byStatus.Denied}
                    color={COLORS.error}
                    sub={String(stats.byStatus.Denied)}
                    styles={styles}
                  />
                  <Text style={styles.funnelNote}>
                    {stats.byStatus.Approved + stats.byStatus.Denied} propuestas cerradas en total
                  </Text>
                </View>
              </>
            )}

            {/* ══ Cartera de montos ══ */}
            {stats.totalAmount > 0 && (
              <>
                <Text style={styles.sectionLabel}>CARTERA</Text>
                <View style={styles.card}>
                  <View style={styles.carteraTop}>
                    <View>
                      <Text style={styles.carteraLbl}>Valor total acumulado</Text>
                      <Text style={styles.carteraBig}>{formatAmount(stats.totalAmount)}</Text>
                    </View>
                    <View style={[styles.carteraBadge, { backgroundColor: COLORS.success + '15', borderColor: COLORS.success + '40' }]}>
                      <Text style={[styles.carteraBadgeNum, { color: COLORS.success }]}>
                        {stats.totalAmount > 0 ? `${Math.round((stats.approvedAmount / stats.totalAmount) * 100)}%` : '—'}
                      </Text>
                      <Text style={styles.carteraBadgeLbl}>aprobado</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <ProgressRow
                    label="Aprobado"
                    value={stats.approvedAmount}
                    total={stats.totalAmount}
                    color={COLORS.success}
                    sub={formatAmount(stats.approvedAmount)}
                    styles={styles}
                  />
                  <ProgressRow
                    label="En pipeline"
                    value={stats.pipelineAmount}
                    total={stats.totalAmount}
                    color={COLORS.accent}
                    sub={formatAmount(stats.pipelineAmount)}
                    styles={styles}
                  />
                </View>
              </>
            )}

            {/* Botón acceso a Reportes */}
            <TouchableOpacity
              style={styles.reportsBtn}
              onPress={() => navigation.navigate('Reports')}
              activeOpacity={0.85}
            >
              <Text style={styles.reportsBtnText}>≡  Ver reporte detallado por período →</Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      )}
      {refreshing && (
        <ProlibuLoader visible={true} background={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)'} />
      )}
      </View>

      {/* Modal picker de agentes */}
      <Modal visible={agentPickerVisible} animationType="slide" transparent onRequestClose={() => setAgentPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAgentPickerVisible(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.pickerTitle}>Filtrar por asesor</Text>
              <TouchableOpacity onPress={() => setAgentPickerVisible(false)}>
                <X size={20} color={COLORS.text} weight="bold" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {agentsList.map(agent => {
                const active = selectedAgent?.id === agent.id;
                return (
                  <TouchableOpacity
                    key={agent.id}
                    style={[styles.pickerItem, active && styles.pickerItemActive]}
                    onPress={() => applyViewMode('agent', agent)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerItemText, active && styles.pickerItemTextActive]}>{agent.name}</Text>
                    {active && <Check size={16} color={COLORS.accent} weight="bold" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BottomTabBar active="Dashboard" navigation={navigation} />
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
function makeStyles(C) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: C.bg },
    loader: { marginTop: 80 },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
    },
    backBtn:    { paddingRight: 4 },
    backText:   { color: C.accent, fontWeight: '600', fontSize: 14 },
    headerInfo: { flex: 1 },
    headerTitle:{ color: C.text, fontSize: 22, fontWeight: '800' },
    headerSub:  { color: C.textMuted, fontSize: 12, marginTop: 2 },
    refreshBtn: { padding: 4 },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    errorText: { color: C.textMuted, fontSize: 15, textAlign: 'center', marginBottom: 20 },
    retryBtn:  { backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    scroll: { padding: 20, paddingBottom: 48 },
    sectionLabel: {
      color: C.textMuted, fontSize: 10, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 1.5,
      marginBottom: 10, marginTop: 6,
    },
    card: {
      backgroundColor: C.card, borderRadius: 16,
      borderWidth: 1, borderColor: C.border,
      padding: 16, marginBottom: 20,
    },
    divider: { height: 1, backgroundColor: C.border, marginBottom: 14 },

    // KPI grid
    kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    kpiCard: {
      flex: 1.15, backgroundColor: C.card, borderRadius: 16,
      borderWidth: 1, borderColor: C.border, padding: 16,
    },
    kpiCardAccent: { borderColor: C.accent + '40', backgroundColor: C.accent + '06' },
    kpiCardGreen:  { borderColor: C.success + '40' },
    kpiCardRed:    { borderColor: C.error + '30' },
    kpiValue:  { fontWeight: '900', letterSpacing: -0.5 },
    kpiLabel:  { color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4 },
    kpiTagRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
    kpiTag:    { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
    kpiTagText:{ fontSize: 10, fontWeight: '700' },

    // Pipeline rápido
    pipeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    pipeCard: {
      flex: 1, backgroundColor: C.card, borderRadius: 12,
      borderWidth: 1, borderColor: C.border,
      padding: 10, alignItems: 'center', gap: 4,
    },
    pipeDot: { width: 8, height: 8, borderRadius: 4 },
    pipeNum: { fontWeight: '800', fontSize: 20 },
    pipeLbl: { color: C.textMuted, fontSize: 9, fontWeight: '700', textAlign: 'center' },

    // Leyenda de distribución
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot:  { width: 10, height: 10, borderRadius: 5 },
    legendLabel:{ color: C.text, fontWeight: '600', fontSize: 13, width: 68 },
    legendTrack:{ flexDirection: 'row', height: 7, backgroundColor: C.border, borderRadius: 3.5, overflow: 'hidden' },
    legendCount:{ fontWeight: '800', fontSize: 14, minWidth: 24, textAlign: 'right' },
    legendPct:  { color: C.textMuted, fontSize: 11, fontWeight: '600', width: 36, textAlign: 'right' },

    // Temperatura
    tempRow:  { flexDirection: 'row', gap: 10, marginBottom: 20 },
    tempCard: {
      flex: 1, backgroundColor: C.card, borderRadius: 16,
      borderWidth: 1.5, padding: 14, alignItems: 'center', gap: 4,
    },
    tempEmoji:{ marginBottom: 2 },
    tempNum:  { fontWeight: '900', fontSize: 28, letterSpacing: -0.5 },
    tempLabel:{ color: C.textMuted, fontSize: 10, fontWeight: '700' },
    tempPill: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    tempPct:  { fontWeight: '800', fontSize: 12 },

    // Progress
    progressLabel: { color: C.text, fontWeight: '600', fontSize: 13 },
    progressSub:   { color: C.textMuted, fontSize: 12 },
    progressPct:   { fontWeight: '800', fontSize: 13, minWidth: 38, textAlign: 'right' },
    progressTrack: {
      flexDirection: 'row', height: 10,
      backgroundColor: C.border, borderRadius: 5, overflow: 'hidden',
    },
    progressFill: { borderRadius: 5 },

    funnelNote: { color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },

    // Cartera
    carteraTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    carteraLbl:     { color: C.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
    carteraBig:     { color: C.text, fontSize: 34, fontWeight: '900', letterSpacing: -1 },
    carteraBadge:   { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center' },
    carteraBadgeNum:{ fontWeight: '900', fontSize: 20 },
    carteraBadgeLbl:{ color: C.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },

    // Botón reportes
    reportsBtn: {
      borderRadius: 14, borderWidth: 1, borderColor: C.accent + '60',
      backgroundColor: C.accent + '10', padding: 16, alignItems: 'center',
    },
    reportsBtnText: { color: C.accent, fontWeight: '700', fontSize: 14 },

    // Selector de vista (admin)
    viewSelector: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    viewChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.card,
    },
    viewChipAgent: { flex: 1 },
    viewChipActive: { backgroundColor: C.accent, borderColor: C.accent },
    viewChipText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
    viewChipTextActive: { color: '#fff' },
    contextRow: {
      paddingHorizontal: 20, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    contextText: { color: C.textMuted, fontSize: 12 },

    // Agent picker modal
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    pickerSheet: {
      backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 48, maxHeight: '70%',
      borderWidth: 1, borderColor: C.border,
    },
    pickerHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border, alignSelf: 'center', marginBottom: 20,
    },
    pickerTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
    pickerItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: 4,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    pickerItemActive: { backgroundColor: C.accent + '10' },
    pickerItemText: { color: C.text, fontSize: 15 },
    pickerItemTextActive: { color: C.accent, fontWeight: '700' },
  });
}
