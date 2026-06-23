import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { getProposals, getReports, runReport, downloadReport, getActiveUsers } from '../api';
import BottomTabBar from '../components/BottomTabBar';
import { ProlibuLogoHorizontal } from '../components/ProlibuLogo';
import { ProlibuLoader, ProlibuSpinner } from '../components/ProlibuLoader';
import { CaretDown, Check, X } from 'phosphor-react-native';
import { useTranslation } from '../i18n';

// ─── Config ───────────────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { key: '3m',     tKey: 'range3m',     months: 3    },
  { key: '6m',     tKey: 'range6m',     months: 6    },
  { key: 'year',   tKey: 'rangeYear',   months: null },
  { key: 'prev',   tKey: 'rangePrev',   months: null },
  { key: 'custom', tKey: 'rangeCustom' },
];

const PERIOD_OPTIONS = [
  { key: 'daily',     tKey: 'periodDaily'     },
  { key: 'weekly',    tKey: 'periodWeekly'    },
  { key: 'monthly',   tKey: 'periodMonthly'   },
  { key: 'quarterly', tKey: 'periodQuarterly' },
  { key: 'annual',    tKey: 'periodAnnual'    },
];

const PERIOD_LABELS_SERVER = {
  Daily: 'Diario', Weekly: 'Semanal', Biweekly: 'Quincenal',
  Monthly: 'Mensual', Bimestrial: 'Bimestral', Quarterly: 'Trimestral',
  FourMonthPeriod: 'Cuatrimestral', Semestral: 'Semestral', Annual: 'Anual',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseInputDate(str) {
  if (!str) return null;
  if (str.includes('/')) {
    const [d, m, y] = str.split('/').map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateShort(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function fmtAmount(n) {
  if (!n || n === 0) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function isAdminUser(user) {
  if (!user) return false;
  // Nuevo: campo isAdmin guardado desde acl.roles en login
  if (user.isAdmin === true) return true;
  // Fallback: campo role como string
  const role = typeof user.role === 'string' ? user.role : (user.role?.name || user.role?.slug || '');
  return ['admin', 'superadmin', 'super'].some(r => role.toLowerCase().includes(r));
}

// ─── Calcular rango de fechas ─────────────────────────────────────────────────
function resolveRange(rangeKey, customStart, customEnd) {
  const now = new Date();
  if (rangeKey === 'custom') return { start: customStart || new Date(now.getFullYear(), 0, 1), end: customEnd || now };
  if (rangeKey === 'year')   return { start: new Date(now.getFullYear(), 0, 1), end: now };
  if (rangeKey === 'prev')   return {
    start: new Date(now.getFullYear() - 1, 0, 1),
    end:   new Date(now.getFullYear() - 1, 11, 31),
  };
  const opt = RANGE_OPTIONS.find(r => r.key === rangeKey);
  const months = opt?.months || 3;
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return { start, end: now };
}

// ─── Motor de generación de períodos ─────────────────────────────────────────
function periodLabel(date, periodKey) {
  const d = new Date(date);
  if (periodKey === 'daily')     return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  if (periodKey === 'weekly')    return `Sem. ${fmtDateShort(d)} ${d.getFullYear()}`;
  if (periodKey === 'monthly')   return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  if (periodKey === 'quarterly') {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `Q${q} ${d.getFullYear()}`;
  }
  return String(d.getFullYear());
}

function nextPeriodStart(date, periodKey) {
  const d = new Date(date);
  if (periodKey === 'daily')     { d.setDate(d.getDate() + 1); return d; }
  if (periodKey === 'weekly')    { d.setDate(d.getDate() + 7); return d; }
  if (periodKey === 'monthly')   { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  if (periodKey === 'quarterly') { return new Date(d.getFullYear(), d.getMonth() + 3, 1); }
  return new Date(d.getFullYear() + 1, 0, 1);
}

function periodEnd(start, periodKey, rangeEnd) {
  const d = nextPeriodStart(start, periodKey);
  d.setMilliseconds(-1); // último ms del período
  return d > rangeEnd ? rangeEnd : d;
}

function generateReport(proposals, rangeKey, periodKey, customStart, customEnd) {
  const { start, end } = resolveRange(rangeKey, customStart, customEnd);
  const periods = [];
  let cur = new Date(start);
  cur.setHours(0, 0, 0, 0);

  const MAX_PERIODS = 366; // máximo 366 períodos (1 año diario / 3 años semanales)
  let iterations = 0;

  while (cur <= end && iterations < MAX_PERIODS) {
    iterations++;
    const pEnd = periodEnd(cur, periodKey, end);
    const label = periodLabel(cur, periodKey);

    const inPeriod = proposals.filter(p => {
      // Parseo robusto: strings solo-fecha (YYYY-MM-DD) se tratan como hora local,
      // no UTC, para evitar desfase de zona horaria.
      const raw = p.updatedAt || p.createdAt;
      if (!raw) return false;
      let t;
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        t = new Date(y, m - 1, d); // medianoche local
      } else {
        t = new Date(raw);
      }
      return t >= cur && t <= pEnd;
    });

    const created  = inPeriod.length;
    const approved = inPeriod.filter(p => p.status === 'Approved').length;
    const denied   = inPeriod.filter(p => p.status === 'Denied').length;
    const ready    = inPeriod.filter(p => p.status === 'Ready').length;
    const draft    = inPeriod.filter(p => p.status === 'Draft').length;
    const closed   = approved + denied;
    const conversion = closed > 0 ? Math.round((approved / closed) * 100) : null;

    let approvedAmt = 0;
    inPeriod.forEach(p => {
      if (p.status === 'Approved') approvedAmt += parseFloat(p.total || p.amount || 0) || 0;
    });

    periods.push({ label, start: new Date(cur), end: new Date(pEnd), created, approved, denied, ready, draft, closed, conversion, approvedAmt });
    cur = nextPeriodStart(cur, periodKey);
  }

  // Totales
  const totCreated  = periods.reduce((a, p) => a + p.created, 0);
  const totApproved = periods.reduce((a, p) => a + p.approved, 0);
  const totDenied   = periods.reduce((a, p) => a + p.denied, 0);
  const totClosed   = totApproved + totDenied;
  const totConversion = totClosed > 0 ? Math.round((totApproved / totClosed) * 100) : null;
  const totAmt = periods.reduce((a, p) => a + p.approvedAmt, 0);
  const maxCreated = Math.max(...periods.map(p => p.created), 1);

  return { periods, totals: { created: totCreated, approved: totApproved, denied: totDenied, conversion: totConversion, approvedAmt: totAmt }, maxCreated };
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ReportsScreen({ navigation }) {
  const { colors: COLORS, isDark } = useTheme();
  const { t } = useTranslation();
  const [auth, setAuth]           = useState(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(true);
  // Vista admin
  const [viewMode, setViewMode]         = useState('mine'); // 'mine' | 'all' | 'agent'
  const [agentsList, setAgentsList]     = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentPickerVisible, setAgentPickerVisible] = useState(false);
  const authRef   = React.useRef(null);
  const userIdRef = React.useRef(null);

  // Configuración del reporte
  const [rangeKey, setRangeKey]       = useState('6m');
  const [periodKey, setPeriodKey]     = useState('monthly');
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd]     = useState(null);
  const [inputFrom, setInputFrom]     = useState('');
  const [inputTo, setInputTo]         = useState('');
  const [dateModal, setDateModal]     = useState(false);

  // Reporte generado
  const [report, setReport]       = useState(null);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Reportes servidor (solo admin)
  const [serverReports, setServerReports]   = useState([]);
  const [serverLoading, setServerLoading]   = useState(false);
  const [running, setRunning]               = useState(null);
  const [downloading, setDownloading]       = useState(null);
  const [resultModal, setResultModal]       = useState({ visible: false, report: null, data: null });

  useEffect(() => {
    AsyncStorage.getItem('auth').then(val => {
      if (!val) { navigation.replace('Login'); return; }
      const authData = JSON.parse(val);
      const user = authData.user || {};
      const id   = authData.userId || user._id || user.id || '';
      const admin = isAdminUser(user);
      authRef.current = authData;
      userIdRef.current = id;
      setAuth(authData);
      setIsAdmin(admin);
      loadProposals(id, authData.token, 200); // siempre arranca con "Mis datos"
      if (admin) {
        loadServerReports(authData.token);
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

  async function loadProposals(agentId, token, limit = 200) {
    setLoadingProposals(true);
    setGenerated(false);
    setReport(null);
    try {
      const res = await getProposals(agentId, token, 1, limit);
      const raw = res.docs || res.data || (Array.isArray(res) ? res : []);
      setProposals((Array.isArray(raw) ? raw : []).filter(p =>
        ['Draft', 'Ready', 'Approved', 'Denied'].includes(p.status)
      ));
    } catch { /* sin propuestas */ } finally {
      setLoadingProposals(false);
    }
  }

  function applyViewMode(mode, agent = null) {
    setViewMode(mode);
    setSelectedAgent(agent);
    setAgentPickerVisible(false);
    if (!authRef.current) return;
    const token = authRef.current.token;
    if (mode === 'mine')  loadProposals(userIdRef.current, token, 200);
    if (mode === 'all')   loadProposals(null, token, 500);
    if (mode === 'agent' && agent) loadProposals(agent.id, token, 200);
  }

  async function loadServerReports(token) {
    try {
      const res = await getReports(token);
      const raw = res.docs || res.data || (Array.isArray(res) ? res : []);
      setServerReports(Array.isArray(raw) ? raw : []);
    } catch { } finally { setServerLoading(false); }
  }

  function handleGenerate() {
    if (proposals.length === 0) {
      Alert.alert('Sin datos', 'No hay propuestas disponibles para generar el reporte.');
      return;
    }
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => {
      const result = generateReport(proposals, rangeKey, periodKey, customStart, customEnd);
      setReport(result);
      setGenerated(true);
      setGenerating(false);
    }, 700);
  }

  function applyCustomDates() {
    const s = parseInputDate(inputFrom);
    const e = parseInputDate(inputTo);
    if (!s || !e) {
      Alert.alert('Fecha inválida', 'Usa el formato DD/MM/AAAA.');
      return;
    }
    if (s > e) {
      Alert.alert('Rango inválido', 'La fecha inicio debe ser anterior al fin.');
      return;
    }
    setCustomStart(s);
    setCustomEnd(e);
    setRangeKey('custom');
    setGenerated(false);
    setReport(null);
    setDateModal(false);
  }

  async function handleRunServer(item) {
    if (!auth) return;
    const id = item.id || item._id;
    setRunning(id);
    try {
      const data = await runReport(id, auth.token);
      setResultModal({ visible: true, report: item, data });
    } catch (e) {
      Alert.alert('Error', 'No se pudo ejecutar el reporte: ' + e.message);
    } finally { setRunning(null); }
  }

  async function handleDownloadServer(item) {
    if (!auth) return;
    const id = item.id || item._id;
    setDownloading(id);
    try {
      await downloadReport(id, auth.token);
      Alert.alert('Listo', 'El reporte Excel fue enviado a tu correo electrónico.');
    } catch (e) {
      Alert.alert('Error', 'No se pudo exportar el reporte: ' + e.message);
    } finally { setDownloading(null); }
  }

  // ── Etiqueta del rango activo ──
  function activRangeLabel() {
    if (rangeKey === 'custom' && customStart && customEnd) {
      return `${fmtDate(customStart)} — ${fmtDate(customEnd)}`;
    }
    return RANGE_OPTIONS.find(r => r.key === rangeKey)?.label || '';
  }

  // ── Renderizar período ──
  function renderPeriod(p, maxCreated) {
    const barW = maxCreated > 0 ? p.created / maxCreated : 0;
    const hasAmt = p.approvedAmt > 0;
    return (
      <View key={p.label + p.start.toISOString()} style={styles.periodCard}>
        {/* Etiqueta y fechas */}
        <View style={styles.periodCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.periodCardLabel}>{p.label}</Text>
            <Text style={styles.periodCardDates}>{fmtDateShort(p.start)} — {fmtDateShort(p.end)}</Text>
          </View>
        </View>

        {/* Barra de actividad */}
        <View style={styles.activityBarTrack}>
          <View style={[styles.activityBarFill, { flex: Math.max(barW, 0.001) }]} />
          <View style={{ flex: Math.max(1 - barW, 0.001) }} />
        </View>

        {/* Stats */}
        <View style={styles.periodCardStats}>
          <View style={styles.pStat}>
            <Text style={styles.pStatVal}>{p.created}</Text>
            <Text style={styles.pStatLbl}>{t('createdLabel')}</Text>
          </View>
          <View style={styles.pStatDivider} />
          <View style={styles.pStat}>
            <Text style={[styles.pStatVal, { color: COLORS.success }]}>{p.approved}</Text>
            <Text style={styles.pStatLbl}>{t('approvedLabel')}</Text>
          </View>
          <View style={styles.pStatDivider} />
          <View style={styles.pStat}>
            <Text style={[styles.pStatVal, { color: COLORS.error }]}>{p.denied}</Text>
            <Text style={styles.pStatLbl}>{t('deniedLabel')}</Text>
          </View>
          <View style={styles.pStatDivider} />
          <View style={styles.pStat}>
            <Text style={[styles.pStatVal, { color: '#10B981' }]}>{p.ready}</Text>
            <Text style={styles.pStatLbl}>{t('readyLabel')}</Text>
          </View>
          <View style={styles.pStatDivider} />
          <View style={styles.pStat}>
            <Text style={[styles.pStatVal, { color: '#F59E0B' }]}>{p.draft}</Text>
            <Text style={styles.pStatLbl}>{t('draftLabel')}</Text>
          </View>
          {hasAmt && (
            <>
              <View style={styles.pStatDivider} />
              <View style={styles.pStat}>
                <Text style={[styles.pStatVal, { color: COLORS.success, fontSize: 13 }]}>{fmtAmount(p.approvedAmt)}</Text>
                <Text style={styles.pStatLbl}>{t('approvedAmtLabel')}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Renderizar resultados del servidor ──
  function renderServerResult(data) {
    if (!data) return <Text style={styles.emptyHint}>{t('noDataHint')}</Text>;
    const periods = data.periods || data.docs || (Array.isArray(data) ? data : null);
    if (Array.isArray(periods) && periods.length > 0) {
      return periods.map((p, i) => (
        <View key={p.uuid || String(i)} style={styles.periodCard}>
          <Text style={styles.periodCardLabel}>{p.title || `Período ${i + 1}`}</Text>
          {(p.startDate || p.endDate) && (
            <Text style={styles.periodCardDates}>{fmtDate(p.startDate)} — {fmtDate(p.endDate)}</Text>
          )}
          <View style={styles.periodCardStats}>
            {[
              { val: p.created || 0, lbl: t('createdLabel'), color: COLORS.text },
              { val: p.approved || 0, lbl: t('approvedLabel'), color: COLORS.success },
              { val: p.denied || 0, lbl: t('deniedLabel'), color: COLORS.error },
            ].map(s => (
              <View key={s.lbl} style={styles.pStat}>
                <Text style={[styles.pStatVal, { color: s.color }]}>{s.val}</Text>
                <Text style={styles.pStatLbl}>{s.lbl}</Text>
              </View>
            ))}
          </View>
        </View>
      ));
    }
    return <Text style={styles.emptyHint}>{t('noDataHint2')}</Text>;
  }

  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <ProlibuLogoHorizontal scale={1} />
        <View style={{ flex: 1 }} />
        {generated && report && (
          <Text style={styles.headerSub}>{activRangeLabel()} · {PERIOD_OPTIONS.find(p => p.key === periodKey)?.label}</Text>
        )}
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
              {viewMode === 'agent' ? selectedAgent?.name : t('agent')}
            </Text>
            <CaretDown size={13} color={viewMode === 'agent' ? '#fff' : COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Configuración ── */}
        <View style={styles.configBlock}>
          <Text style={styles.configLabel}>{t('rangeLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {RANGE_OPTIONS.map(r => {
              const active = rangeKey === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    if (r.key === 'custom') { setDateModal(true); return; }
                    setRangeKey(r.key);
                    setGenerated(false);
                    setReport(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {r.key === 'custom' && customStart ? `${fmtDate(customStart)} — ${fmtDate(customEnd)}` : t(r.tKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.configLabel, { marginTop: 14 }]}>{t('periodLabel')}</Text>
          <View style={styles.periodRow}>
            {PERIOD_OPTIONS.map(p => {
              const active = periodKey === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodChip, active && styles.periodChipActive]}
                  onPress={() => { setPeriodKey(p.key); setGenerated(false); setReport(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>{t(p.tKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loadingProposals ? (
            <ProlibuSpinner style={{ marginTop: 20, alignSelf: 'center' }} />
          ) : (
            <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating} activeOpacity={0.85}>
              {generating ? <ProlibuSpinner /> : <Text style={styles.generateBtnText}>{t('generateBtn')}</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Resultado generado ── */}
        {generated && report && (
          <View style={styles.resultBlock}>
            {/* Totales */}
            {(() => {
              const totReady = report.periods.reduce((a, p) => a + p.ready, 0);
              const totDraft = report.periods.reduce((a, p) => a + p.draft, 0);
              return (
                <View style={styles.totalsRow}>
                  <View style={styles.totalCard}>
                    <Text style={styles.totalVal}>{report.totals.created}</Text>
          <Text style={styles.totalLbl}>{t('createdLabel')}</Text>
                  </View>
                  <View style={[styles.totalCard, { borderColor: COLORS.success + '60' }]}>
                    <Text style={[styles.totalVal, { color: COLORS.success }]}>{report.totals.approved}</Text>
                    <Text style={styles.totalLbl}>{t('approvedLabel')}</Text>
                  </View>
                  <View style={[styles.totalCard, { borderColor: COLORS.error + '60' }]}>
                    <Text style={[styles.totalVal, { color: COLORS.error }]}>{report.totals.denied}</Text>
                    <Text style={styles.totalLbl}>{t('deniedLabel')}</Text>
                  </View>
                  <View style={[styles.totalCard, { borderColor: '#10B98160' }]}>
                    <Text style={[styles.totalVal, { color: '#10B981' }]}>{totReady}</Text>
                    <Text style={styles.totalLbl}>{t('readyLabel')}</Text>
                  </View>
                  <View style={[styles.totalCard, { borderColor: '#F59E0B60' }]}>
                    <Text style={[styles.totalVal, { color: '#F59E0B' }]}>{totDraft}</Text>
                    <Text style={styles.totalLbl}>{t('draftLabel')}</Text>
                  </View>
                  <View style={[styles.totalCard, { borderColor: COLORS.accent + '60' }]}>
                    <Text style={[styles.totalVal, { color: COLORS.accent }]}>
                      {report.totals.conversion !== null ? `${report.totals.conversion}%` : '—'}
                    </Text>
                    <Text style={styles.totalLbl}>{t('conversionLabel')}</Text>
                  </View>
                </View>
              );
            })()}

            {report.totals.approvedAmt > 0 && (
              <View style={styles.amtTotalCard}>
                <Text style={styles.amtTotalLbl}>Total aprobado en el período</Text>
                <Text style={styles.amtTotalVal}>{fmtAmount(report.totals.approvedAmt)}</Text>
              </View>
            )}

            {/* Períodos */}
            <Text style={styles.periodsTitle}>
              {report.periods.length} período{report.periods.length !== 1 ? 's' : ''} · {PERIOD_OPTIONS.find(p => p.key === periodKey)?.label}
            </Text>
            {report.periods.length === 0 ? (
              <Text style={styles.emptyHint}>{t('noProposalsRange')}</Text>
            ) : (
              report.periods.map(p => renderPeriod(p, report.maxCreated)).reverse()
            )}
          </View>
        )}

        {/* ── Reportes servidor (solo admin) ── */}
        {isAdmin && (
          <View style={styles.serverBlock}>
            <Text style={styles.serverTitle}>REPORTES CONFIGURADOS (admin)</Text>
            {serverLoading ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 16 }} />
            ) : serverReports.length === 0 ? (
              <Text style={styles.emptyHint}>No hay reportes configurados en la cuenta.</Text>
            ) : (
              serverReports.map(item => {
                const id = item.id || item._id;
                const isRunning     = running === id;
                const isDownloading = downloading === id;
                const busy = isRunning || isDownloading;
                const currencyCode = typeof item.currency === 'object'
                  ? (item.currency?.code || '') : (item.currency || '');
                return (
                  <View key={id} style={styles.serverCard}>
                    <Text style={styles.serverCardTitle}>{item.title || 'Sin título'}</Text>
                    <View style={styles.chipRowSmall}>
                      {item.periodRange && (
                        <View style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{PERIOD_LABELS_SERVER[item.periodRange] || item.periodRange}</Text>
                        </View>
                      )}
                      {currencyCode ? <View style={styles.tagChip}><Text style={styles.tagChipText}>{currencyCode}</Text></View> : null}
                      {item.country ? <View style={styles.tagChip}><Text style={styles.tagChipText}>{item.country}</Text></View> : null}
                    </View>
                    {(item.startDate || item.endDate) && (
                      <Text style={styles.serverCardDates}>{fmtDate(item.startDate)} — {fmtDate(item.endDate)}</Text>
                    )}
                    <View style={styles.serverCardBtns}>
                      <TouchableOpacity
                        style={[styles.runBtn, busy && styles.btnDisabled]}
                        onPress={() => handleRunServer(item)}
                        activeOpacity={0.7}
                        disabled={busy}
                      >
                        {isRunning
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={styles.runBtnText}>▶  Ejecutar</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dlBtn, busy && styles.btnDisabled]}
                        onPress={() => handleDownloadServer(item)}
                        activeOpacity={0.7}
                        disabled={busy}
                      >
                        {isDownloading
                          ? <ActivityIndicator size="small" color={COLORS.accent} />
                          : <Text style={styles.dlBtnText}>⬇  Excel</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── Modal rango personalizado ── */}
      <Modal visible={dateModal} animationType="slide" transparent onRequestClose={() => setDateModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setDateModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('customRange')}</Text>
            <Text style={styles.dateInputLabel}>Desde (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.dateInput}
              value={inputFrom}
              onChangeText={setInputFrom}
              placeholder="01/01/2025"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />
            <Text style={styles.dateInputLabel}>Hasta (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.dateInput}
              value={inputTo}
              onChangeText={setInputTo}
              placeholder="31/12/2025"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              onSubmitEditing={applyCustomDates}
            />
            <TouchableOpacity style={styles.applyBtn} onPress={applyCustomDates} activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDateModal(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal resultado servidor ── */}
      <Modal
        visible={resultModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setResultModal({ visible: false, report: null, data: null })}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setResultModal({ visible: false, report: null, data: null })}
          />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{resultModal.report?.title || 'Resultados'}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {renderServerResult(resultModal.data)}
              <View style={{ height: 20 }} />
            </ScrollView>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setResultModal({ visible: false, report: null, data: null })}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomTabBar active="Reports" navigation={navigation} />
      <ProlibuLoader visible={generating} background={isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.8)'} />

      {/* Modal picker de agentes */}
      <Modal visible={agentPickerVisible} animationType="slide" transparent onRequestClose={() => setAgentPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAgentPickerVisible(false)} />
          <View style={[styles.modalSheet, { maxHeight: '65%' }]}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '800' }}>{t('filterByAgentDash')}</Text>
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
                    <Text style={[styles.pickerItemText, active && { color: COLORS.accent, fontWeight: '700' }]}>{agent.name}</Text>
                    {active && <Check size={16} color={COLORS.accent} weight="bold" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
function makeStyles(C) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
    },
    backBtn: { paddingRight: 4 },
    backText: { color: C.accent, fontWeight: '600', fontSize: 14 },
    headerTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
    headerSub: { color: C.textMuted, fontSize: 11, marginTop: 1 },
    scroll: { paddingBottom: 20 },

    // Config
    configBlock: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    configLabel: {
      color: C.textMuted, fontSize: 10, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10,
    },
    chipScroll: { gap: 8 },
    chip: {
      paddingHorizontal: 16, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    chipActive: { backgroundColor: C.accent, borderColor: C.accent },
    chipText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: '#fff' },

    periodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    periodChip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    periodChipActive: { backgroundColor: C.accent, borderColor: C.accent },
    periodChipText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
    periodChipTextActive: { color: '#fff' },

    generateBtn: {
      backgroundColor: C.accent, borderRadius: 14,
      padding: 16, alignItems: 'center', marginTop: 20,
    },
    generateBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    // Resultado
    resultBlock: { padding: 20 },
    totalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    totalCard: {
      width: '30.5%',
      backgroundColor: C.card,
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      padding: 12, alignItems: 'center',
    },
    totalVal: { color: C.text, fontSize: 22, fontWeight: '800' },
    totalLbl: { color: C.textMuted, fontSize: 11, marginTop: 3, fontWeight: '600', textAlign: 'center' },

    amtTotalCard: {
      backgroundColor: C.success + '12',
      borderRadius: 12, borderWidth: 1, borderColor: C.success + '40',
      padding: 14, marginBottom: 16, flexDirection: 'row',
      justifyContent: 'space-between', alignItems: 'center',
    },
    amtTotalLbl: { color: C.textMuted, fontSize: 12 },
    amtTotalVal: { color: C.success, fontSize: 20, fontWeight: '800' },

    periodsTitle: {
      color: C.textMuted, fontSize: 11, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
    },

    // Tarjeta de período
    periodCard: {
      backgroundColor: C.card,
      borderRadius: 14, borderWidth: 1, borderColor: C.border,
      padding: 16, marginBottom: 12,
    },
    periodCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    periodCardLabel: { color: C.text, fontWeight: '800', fontSize: 16 },
    periodCardDates: { color: C.textMuted, fontSize: 12, marginTop: 3 },
    activityBarTrack: {
      flexDirection: 'row', height: 6,
      backgroundColor: C.border, borderRadius: 3,
      overflow: 'hidden', marginBottom: 14,
    },
    activityBarFill: { backgroundColor: C.accent, borderRadius: 3 },
    periodCardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
    pStat: { flex: 1, alignItems: 'center', minWidth: 56, paddingVertical: 4 },
    pStatVal: { color: C.text, fontWeight: '800', fontSize: 20 },
    pStatLbl: { color: C.textMuted, fontSize: 11, marginTop: 3, fontWeight: '600', textAlign: 'center' },
    pStatDivider: { width: 1, backgroundColor: C.border, alignSelf: 'stretch' },

    emptyHint: { color: C.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 16 },

    // Servidor admin
    serverBlock: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    serverTitle: {
      color: C.textMuted, fontSize: 10, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
    },
    serverCard: {
      backgroundColor: C.card, borderRadius: 14,
      borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12,
    },
    serverCardTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
    chipRowSmall: { flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
    tagChip: {
      backgroundColor: C.accent + '18', borderRadius: 20,
      paddingHorizontal: 8, paddingVertical: 2,
      borderWidth: 1, borderColor: C.accent + '40',
    },
    tagChipText: { color: C.accent, fontSize: 10, fontWeight: '700' },
    serverCardDates: { color: C.textMuted, fontSize: 11, marginBottom: 10 },
    serverCardBtns: { flexDirection: 'row', gap: 10 },
    runBtn: {
      flex: 1, backgroundColor: C.accent, borderRadius: 10,
      paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
    },
    runBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    dlBtn: {
      flex: 1, borderRadius: 10, borderWidth: 1, borderColor: C.accent,
      paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.accent + '15',
    },
    dlBtnText: { color: C.accent, fontWeight: '700', fontSize: 13 },
    btnDisabled: { opacity: 0.45 },

    // Modales
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40, maxHeight: '85%',
      borderWidth: 1, borderColor: C.border,
    },
    sheetHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border, alignSelf: 'center', marginBottom: 20,
    },
    sheetTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
    dateInputLabel: { color: C.textMuted, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
    dateInput: {
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 10, padding: 12, fontSize: 16, color: C.text,
    },
    applyBtn: {
      backgroundColor: C.accent, borderRadius: 12,
      padding: 15, alignItems: 'center', marginTop: 18,
    },
    applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    cancelBtn: {
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      padding: 15, alignItems: 'center', marginTop: 10,
    },
    cancelBtnText: { color: C.textMuted, fontWeight: '600', fontSize: 15 },

    // Selector de vista admin
    viewSelector: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    viewChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    viewChipAgent: { flex: 1 },
    viewChipActive: { backgroundColor: C.accent, borderColor: C.accent },
    viewChipText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
    viewChipTextActive: { color: '#fff' },
    pickerItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, paddingHorizontal: 4,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    pickerItemActive: { backgroundColor: C.accent + '10' },
    pickerItemText: { color: C.text, fontSize: 15 },
  });
}
