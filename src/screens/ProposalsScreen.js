import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  SectionList,
  RefreshControl,
  ScrollView,
  Linking,
  Share,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { getProposals, getApiBase, generateShortUrl, getActiveUsers } from '../api';
import { useNotifications } from '../useNotifications';
import BottomTabBar from '../components/BottomTabBar';
import { ProlibuLogoHorizontal } from '../components/ProlibuLogo';
import { ProlibuLoader } from '../components/ProlibuLoader';
import { useTranslation } from '../i18n';
import {
  Bell, BellRinging, Eye, Fire, Thermometer, Snowflake, Phone, Envelope,
  WhatsappLogo, Export, ArrowRight, X, SlidersHorizontal, Check, CaretDown,
} from 'phosphor-react-native';

const STATUS_COLOR = {
  Draft: '#FDBD00',
  Ready: '#4285F4',
  Approved: '#39B54A',
  Denied: '#D4145A',
};
const STATUS_COLOR_MAP = { Draft: '#FDBD00', Ready: '#4285F4', Approved: '#39B54A', Denied: '#D4145A' };

const TEMP_COLOR = {
  Hot:  '#FF5722',
  Warm: '#F59E0B',
  Cold: '#60A5FA',
};

const STATUS_CACHE_KEY = 'proposal_status_cache';

async function checkStatusChanges(proposals, addNotif) {
  try {
    const cacheRaw = await AsyncStorage.getItem(STATUS_CACHE_KEY);
    const cache = cacheRaw ? JSON.parse(cacheRaw) : null;
    if (cache) {
      for (const p of proposals) {
        const id = p.id || p._id;
        const current = p.status;
        const cached = cache[id];
        if (id && cached && cached !== current) {
          addNotif(p.title || p.name || 'Propuesta', id, cached, current);
        }
      }
    }
    const newCache = {};
    for (const p of proposals) {
      const id = p.id || p._id;
      if (id) newCache[id] = p.status;
    }
    await AsyncStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(newCache));
  } catch {}
}

function makeFilters(accent, t) {
  const label = t || ((k) => k);
  return [
    { key: 'all',      label: label('statusAll'),      color: accent,     fg: '#ffffff' },
    { key: 'Draft',    label: label('statusDraft'),    color: '#FDBD00',  fg: '#000000' },
    { key: 'Ready',    label: label('statusReady'),    color: '#4285F4',  fg: '#ffffff' },
    { key: 'Approved', label: label('statusApproved'), color: '#39B54A',  fg: '#ffffff' },
    { key: 'Denied',   label: label('statusDenied'),   color: '#D4145A',  fg: '#ffffff' },
  ];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? `hace ${days} día` : `hace ${days} días`;
}

export default function ProposalsScreen({ navigation, route }) {
  const { colors: COLORS, isDark } = useTheme();
  const { t } = useTranslation();
  const FILTERS = makeFilters(COLORS.accent, t);

  const STATUS_LABEL = {
    Draft: t('statusDraft'), Ready: t('statusReady'),
    Approved: t('statusApproved'), Denied: t('statusDenied'),
  };
  const TEMP_CONFIG = {
    Hot:  { label: t('tempHot'),  color: TEMP_COLOR.Hot  },
    Warm: { label: t('tempWarm'), color: TEMP_COLOR.Warm },
    Cold: { label: t('tempCold'), color: TEMP_COLOR.Cold },
  };
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agentsList, setAgentsList] = useState([]); // lista de agentes activos (solo admin)
  const authRef = React.useRef(null);
  const userIdRef = React.useRef(null);
  const isAdminRef = React.useRef(false);
  const lastLoadRef = React.useRef(0);
  const loadedAgentRef = React.useRef(null);
  const quickFilterRef = React.useRef('mine'); // 'mine' | 'all'
  const [quickFilter, setQuickFilter] = useState('mine'); // admin only
  const [userName, setUserName] = useState('');
  const [allProposals, setAllProposals] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);   // total de propuestas en el servidor
  const [hasMore, setHasMore] = useState(false);    // hay m├ís p├íginas por cargar
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sections, setSections] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('updatedAt_desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leadFilter, setLeadFilter] = useState(null);
  const [agentFilter, setAgentFilter] = useState(null);
  const [activityFilter, setActivityFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');   // all | Hot | Warm | Cold
  const [viewsFilter, setViewsFilter] = useState('all');     // all | has_views | no_views | many_views
  const [dateFilter, setDateFilter] = useState('all');       // all | today | week | month | 3months | custom
  const [dateFrom, setDateFrom] = useState('');              // YYYY-MM-DD
  const [dateTo, setDateTo] = useState('');                  // YYYY-MM-DD
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [leadPickerVisible, setLeadPickerVisible] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [sendModal, setSendModal] = useState({
    visible: false, proposal: null, urlType: 'client',
    channel: 'whatsapp',
    waMsg: '', emailSubject: '', emailMsg: '',
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [seguimientoModal, setSeguimientoModal] = useState({ visible: false, proposal: null, type: 'urgente' });
  const [msgTemplates, setMsgTemplates] = useState(null); // null = usar defaults

  const { notifications, unread, connected, liveViewing, lastViewed, markAllRead, clearAll, notifPermission, addStatusChangeNotification } = useNotifications(
    auth?.token ?? null,
    auth ?? null
  );

  // Cargar plantillas de mensajes personalizadas (recarga al volver a esta pantalla)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      AsyncStorage.getItem('message_templates').then(val => {
        setMsgTemplates(val ? JSON.parse(val) : null);
      });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    AsyncStorage.getItem('auth').then((val) => {
      if (!val) { navigation.replace('Login'); return; }
      const authData = JSON.parse(val);
      const user = authData.user || {};
      const id = authData.userId || user._id || user.id || user.userId || user.agentId || '';
      const name = user.firstName || user.name || user.email || 'Mi cuenta';

      if (!id) {
        Alert.alert('Sin ID de usuario', 'No se pudo obtener tu ID.');
        setLoading(false);
        return;
      }

      authRef.current = authData;
      userIdRef.current = id;
      setAuth(authData);
      setUserId(id);
      setUserName(name);

      const adminFlag = user.isAdmin === true;
      setIsAdmin(adminFlag);
      isAdminRef.current = adminFlag;
      // Default: siempre carga las propuestas del usuario (quickFilter='mine')
      load(id, authData.token, true);
      // Admin: cargar lista de agentes activos para el filtro
      if (adminFlag) {
        getActiveUsers(authData.token).then((res) => {
          const all = res.docs || res.data || (Array.isArray(res) ? res : []);
          // Agentes: home="/app/dashboard"; admins: home="/app"
          const agents = all.filter((u) => u.home === '/app/dashboard' && u.status === 'active');
          setAgentsList(agents.map((u) => ({
            id: u.id || u._id,
            name: u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u.email || u.id),
            email: u.email || '',
          })));
        }).catch(() => {});
      }
    });
  }, []);

  // Recargar al volver desde el Editor
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (authRef.current && userIdRef.current) {
        setRefreshing(true);
        const id = isAdminRef.current
          ? (quickFilterRef.current === 'mine' ? userIdRef.current : null)
          : userIdRef.current;
        load(id, authRef.current.token);
      }
    });
    return unsubscribe;
  }, [navigation]);

  async function load(id, token, force = false, page = 1, append = false) {
    const now = Date.now();
    // Throttle solo en recarga silenciosa (no forzada, no paginaci├│n)
    if (!force && page === 1 && now - lastLoadRef.current < 20000) {
      setRefreshing(false);
      return;
    }
    if (page === 1) lastLoadRef.current = now;
    try {
      const res = await getProposals(id, token, page, 100);
      const raw = res.docs || res.data || (Array.isArray(res) ? res : []);
      const list = Array.isArray(raw) ? raw : [];
      const valid = list.filter((p) => ['Ready', 'Draft', 'Approved', 'Denied'].includes(p.status));

      // Total de docs en el servidor
      const total = res.totalDocs ?? res.total ?? res.count ?? 0;
      setTotalDocs(total);
      setCurrentPage(page);
      loadedAgentRef.current = id ?? null;

      const merged = append
        ? [...allProposals, ...valid.filter((p) => {
            const pid = p.id || p._id;
            return !allProposals.some((e) => (e.id || e._id) === pid);
          })]
        : valid;

      // hasMore: si el servidor informa el total, lo usamos; si no, asumimos que hay m├ís
      // cuando la ├║ltima p├ígina trajo exactamente 100 resultados
      const newHasMore = total > 0 ? merged.length < total : valid.length >= 100;
      setHasMore(newHasMore);
      setAllProposals(merged);
      buildSections(merged, activeFilter, activeSort, leadFilter, activityFilter, ratingFilter, viewsFilter, dateFilter, dateFrom, dateTo, null);
      // Detectar cambios de estado respecto al cach├® anterior
      checkStatusChanges(valid, addStatusChangeNotification);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar las propuestas: ' + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  async function loadMore() {
    if (loadingMore || loading) return;
    const nextPage = currentPage + 1;
    const id = loadedAgentRef.current;
    if (!authRef.current) return;
    setLoadingMore(true);
    await load(id, authRef.current.token, true, nextPage, true);
  }

  function getUniqueLeads(proposals) {
    const map = new Map();
    proposals.forEach((p) => {
      const lead = p.relatedLead;
      if (typeof lead === 'object' && lead) {
        const id = lead._id || lead.id;
        if (id && !map.has(id)) {
          const name = lead.firstName
            ? `${lead.firstName} ${lead.lastName || ''}`.trim()
            : (lead.name || lead.email || id);
          map.set(id, { id, name, email: lead.email || '' });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function getUniqueAgents(proposals) {
    const map = new Map();
    proposals.forEach((p) => {
      const agent = p.inCharge;
      if (typeof agent === 'object' && agent) {
        const id = agent._id || agent.id;
        if (id && !map.has(id)) {
          const name = agent.firstName
            ? `${agent.firstName} ${agent.lastName || ''}`.trim()
            : (agent.name || agent.email || id);
          map.set(id, { id, name, email: agent.email || '' });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function sortProposals(list, sort) {
    const s = [...list];
    if (sort === 'updatedAt_asc') s.sort((a, b) => new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
    else if (sort === 'createdAt_desc') s.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sort === 'title_asc') s.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else s.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return s;
  }

  function applyAllFilters(list, { af, rf, vf, lf, df, dfrom, dto, agf }) {
    const now = Date.now();
    const DAY  = 24 * 60 * 60 * 1000;
    const WEEK = 7 * DAY;
    return list.filter((p) => {
      // Lead filter
      if (lf) {
        const lead = p.relatedLead;
        if (typeof lead !== 'object' || !lead) return false;
        if ((lead._id || lead.id) !== lf) return false;
      }
      // Agent filter (admin only)
      if (agf) {
        const agent = p.inCharge;
        if (typeof agent !== 'object' || !agent) return false;
        if ((agent._id || agent.id) !== agf) return false;
      }
      // Activity filter
      const raw = p.lastView || p.lastSeen || p.lastViewed;
      const ts  = raw ? new Date(raw).getTime() : null;
      if (af === 'viewed_today'    && !(ts != null && (now - ts) < DAY))  return false;
      if (af === 'viewed_week'     && !(ts != null && (now - ts) < WEEK)) return false;
      if (af === 'not_viewed'      && ts != null)                         return false;
      if (af === 'approved_viewed' && !(p.status === 'Approved' && ts != null)) return false;
      if (af === 'ready_viewed'    && !(p.status === 'Ready'    && ts != null)) return false;
      // Rating filter
      if (rf !== 'all' && p.rating !== rf) return false;
      // Views filter
      const views = p.views ?? p.visits ?? p.opens ?? p.timesOpened ?? p.opened ?? null;
      if (vf === 'has_views'  && !(views != null && views > 0))  return false;
      if (vf === 'no_views'   && !(views == null || views === 0)) return false;
      if (vf === 'many_views' && !(views != null && views >= 5)) return false;
      // Date range filter (aplica sobre ├║ltima vista, o si no hay, sobre updatedAt)
      if (df !== 'all') {
        const refRaw = p.lastView || p.lastSeen || p.lastViewed || p.updatedAt;
        const refTs  = refRaw ? new Date(refRaw).getTime() : null;
        if (!refTs) return false;
        if (df === 'today')   { if ((now - refTs) > DAY)       return false; }
        if (df === 'week')    { if ((now - refTs) > WEEK)      return false; }
        if (df === 'month')   { if ((now - refTs) > 30 * DAY)  return false; }
        if (df === '3months') { if ((now - refTs) > 90 * DAY)  return false; }
        if (df === 'custom') {
          if (dfrom) { const from = new Date(dfrom).getTime(); if (refTs < from) return false; }
          if (dto)   { const to   = new Date(dto + 'T23:59:59').getTime(); if (refTs > to) return false; }
        }
      }
      return true;
    });
  }

  function buildSections(
    proposals, filter,
    sort = activeSort, lf = leadFilter,
    af = activityFilter, rf = ratingFilter, vf = viewsFilter,
    df = dateFilter, dfrom = dateFrom, dto = dateTo,
    agf = agentFilter,
  ) {
    let base = applyAllFilters(proposals, { af, rf, vf, lf, df, dfrom, dto, agf });
    const sorted = sortProposals(base, sort);
    if (filter === 'all') {
      setSections(sorted.length > 0 ? [{ title: null, data: sorted }] : []);
      return;
    }
    const filtered = sorted.filter((p) => p.status === filter);
    setSections(filtered.length > 0 ? [{ title: filter, data: filtered }] : []);
  }

  function handleFilter(key) {
    setActiveFilter(key);
    buildSections(allProposals, key, activeSort, leadFilter, activityFilter, ratingFilter, viewsFilter, dateFilter, dateFrom, dateTo, agentFilter);
  }

  function handleSort(key) {
    setActiveSort(key);
    buildSections(allProposals, activeFilter, key, leadFilter, activityFilter, ratingFilter, viewsFilter, dateFilter, dateFrom, dateTo, agentFilter);
  }

  function handleLeadFilter(leadId) {
    setLeadFilter(leadId);
    setLeadPickerVisible(false);
    setLeadSearch('');
    buildSections(allProposals, activeFilter, activeSort, leadId, activityFilter, ratingFilter, viewsFilter, dateFilter, dateFrom, dateTo, agentFilter);
  }

  function applyPanel({ sort, lf, af, rf, vf, df, dfrom, dto, agf }) {
    setActiveSort(sort);
    setLeadFilter(lf);
    setActivityFilter(af);
    setRatingFilter(rf);
    setViewsFilter(vf);
    setDateFilter(df);
    setDateFrom(dfrom);
    setDateTo(dto);
    setAgentFilter(agf ?? null);
    setFilterPanelVisible(false);

    // Si es admin y cambi├│ el agente ÔåÆ reload server-side con ese agentId
    if (isAdminRef.current && (agf ?? null) !== loadedAgentRef.current) {
      setLoading(true);
      setAllProposals([]);
      // Si limpia el filtro de asesor, respeta el quickFilter activo
      const reloadId = agf ?? (quickFilterRef.current === 'mine' ? userIdRef.current : null);
      load(reloadId, authRef.current.token, true, 1, false);
    } else {
      buildSections(allProposals, activeFilter, sort, lf, af, rf, vf, df, dfrom, dto, agf ?? null);
    }
  }

  const activeFilterCount = [
    activityFilter !== 'all',
    ratingFilter   !== 'all',
    viewsFilter    !== 'all',
    dateFilter     !== 'all',
    leadFilter     != null,
    agentFilter    != null,
    activeSort     !== 'updatedAt_desc',
  ].filter(Boolean).length;

  function onRefresh() {
    if (!auth) return;
    setRefreshing(true);
    const id = isAdminRef.current
      ? (quickFilterRef.current === 'mine' ? userIdRef.current : null)
      : userIdRef.current;
    load(id, auth.token, true);
  }

  function handleQuickFilter(mode) {
    if (mode === quickFilterRef.current) return;
    setQuickFilter(mode);
    quickFilterRef.current = mode;
    setAgentFilter(null);
    setLoading(true);
    setAllProposals([]);
    const id = mode === 'mine' ? userIdRef.current : null;
    load(id, authRef.current.token, true, 1, false);
  }

  async function handleLogout() {
    await AsyncStorage.removeItem('auth');
    navigation.replace('Login');
  }

  function buildProposalUrl(proposal, urlType) {
    const id = proposal.id || proposal._id;
    const base = `${getApiBase()}/document/proposal/${id}/full`;
    if (urlType === 'anonymous') {
      const rand = Math.floor(Math.random() * 9999999);
      return `${base}?source=none&rand=${rand}`;
    }
    // URL cliente larga (con source=email para tracking)
    const lead = proposal.relatedLead;
    const email = (typeof lead === 'object' ? lead?.email : null) || '';
    return email ? `${base}?source=${encodeURIComponent(email)}` : `${base}?source=none`;
  }

  // Genera la URL corta /r/{uuid} v├¡a POST /v1/urlShort/generate
  async function buildClientShortUrl(proposal) {
    const longUrl = buildProposalUrl(proposal, 'client');
    try {
      const res = await generateShortUrl(longUrl, userId, auth.token);
      return res.url || longUrl;
    } catch {
      return longUrl;
    }
  }

  async function openSendModal(proposal, channel = 'whatsapp') {
    const lead = proposal.relatedLead;
    const name = typeof lead === 'object' ? (lead?.firstName || lead?.name || '') : '';
    const title = proposal.title || proposal.name || '';
    const urlType = proposal.status === 'Ready' ? 'client' : 'anonymous';
    const previewUrl = urlType === 'client'
      ? await buildClientShortUrl(proposal)
      : buildProposalUrl(proposal, 'anonymous');
    const applyT = (tpl) =>
      tpl.replace('{nombre}', name).replace('{propuesta}', title).replace('{url}', previewUrl);
    const emailSubject = msgTemplates?.emailAsunto
      ? applyT(msgTemplates.emailAsunto)
      : `Propuesta comercial${title ? `: ${title}` : ''}`;
    const emailMsg = msgTemplates?.emailCuerpo
      ? applyT(msgTemplates.emailCuerpo)
      : `Hola${name ? ` ${name}` : ''},\n\nEspero que te encuentres muy bien. Te compartimos nuestra propuesta comercial${title ? ` "${title}"` : ''} para tu revisi├│n.\n\nPuedes acceder a ella en el siguiente enlace:\n${previewUrl}\n\nQuedo atento a tus comentarios y a cualquier duda que puedas tener.\n\nSaludos cordiales,`;
    const waMsg = msgTemplates?.envio
      ? applyT(msgTemplates.envio)
      : `${name ? `Hola ${name},` : 'Hola,'} te comparto nuestra propuesta comercial${title ? ` *"${title}"*` : ''}.\n\nPuedes revisarla en el siguiente enlace:\n${previewUrl}`;
    setSendModal({ visible: true, proposal, urlType, channel, waMsg, emailSubject, emailMsg });
  }

  function getLeadPhone(proposal) {
    const lead = proposal.relatedLead;
    if (typeof lead !== 'object' || !lead) return '';
    return lead.phone || lead.mobile || lead.mobilePhone || lead.cellPhone || '';
  }

  function getLeadEmail(proposal) {
    const lead = proposal.relatedLead;
    if (typeof lead !== 'object' || !lead) return '';
    return lead.email || '';
  }

  function handleWhatsApp(proposal, urlType, template, skipUrlAppend = false) {
    const url = buildProposalUrl(proposal, urlType);
    const fullText = skipUrlAppend ? (template || url) : (template ? `${template}\n${url}` : url);
    const msg = encodeURIComponent(fullText);
    const rawPhone = getLeadPhone(proposal);
    // Limpiar n├║mero: solo d├¡gitos, sin +, espacios ni guiones
    const phone = rawPhone.replace(/\D/g, '');
    const waUrl = phone
      ? `whatsapp://send?phone=${phone}&text=${msg}`
      : `whatsapp://send?text=${msg}`;
    Linking.openURL(waUrl).catch(() => {
      const waWeb = phone
        ? `https://wa.me/${phone}?text=${msg}`
        : `https://wa.me/?text=${msg}`;
      Linking.openURL(waWeb);
    });
  }

  async function handleEmail(proposal, urlType, subjectTpl, bodyTpl) {
    const to = getLeadEmail(proposal);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to)) {
      Alert.alert('Correo inv├ílido', 'El lead no tiene un correo registrado o v├ílido.');
      return;
    }

    const url = urlType === 'client'
      ? await buildClientShortUrl(proposal)
      : buildProposalUrl(proposal, 'anonymous');

    const fullBody = bodyTpl ? `${bodyTpl}\n${url}` : url;
    const encodedTo = encodeURIComponent(to);
    const encodedSubject = encodeURIComponent(subjectTpl || proposal.title || proposal.name || 'Propuesta');
    const encodedBody = encodeURIComponent(fullBody);
    const mailtoUrl = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;

    // Detectar app instalada en el dispositivo (no el dominio del destinatario)
    const gmailUrl = `googlegmail://co?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;
    const outlookUrl = `ms-outlook://compose?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;

    const hasGmail = await Linking.canOpenURL(gmailUrl).catch(() => false);
    if (hasGmail) {
      Linking.openURL(gmailUrl).catch(() => Linking.openURL(mailtoUrl));
      return;
    }
    const hasOutlook = await Linking.canOpenURL(outlookUrl).catch(() => false);
    if (hasOutlook) {
      Linking.openURL(outlookUrl).catch(() => Linking.openURL(mailtoUrl));
      return;
    }
    Linking.openURL(mailtoUrl).catch(() =>
      Alert.alert('Error', 'No se pudo abrir la aplicaci├│n de correo.')
    );
  }

  async function handleShareUrl(proposal, urlType) {
    const url = buildProposalUrl(proposal, urlType);
    try {
      await Share.share({
        message: url,      // Android usa message
        url,               // iOS usa url
        title: proposal.title || proposal.name || 'Propuesta',
      });
    } catch {
      Linking.openURL(url).catch(() => {});
    }
  }

  function renderItem({ item }) {
    const title = item.title || item.name || 'Sin t├¡tulo';
    const color = STATUS_COLOR[item.status] || COLORS.textMuted;
    const propId = item.id || item._id || '';
    const isLive = !!(propId && liveViewing[propId]);
    // ├Ültima vista: primero del socket (sesi├│n actual), luego del API (persistido)
    const socketView = propId ? lastViewed[propId] : null;
    const apiLastView = item.lastView || item.lastSeen || item.lastViewed || null;
    const lastViewTs = socketView?.timestamp || apiLastView || null;

    const nowMs = Date.now();
    const isRecentlyViewed = !!(lastViewTs && (nowMs - new Date(lastViewTs).getTime()) < 3600000);
    const isNeverViewedOld = !lastViewTs && !!(item.createdAt && (nowMs - new Date(item.createdAt).getTime()) > 7 * 24 * 60 * 60 * 1000);
    const leadPhone = getLeadPhone(item);

    return (
      <TouchableOpacity
        style={[styles.card, isLive && styles.cardLive]}
        onPress={() => navigation.navigate('Editor', { proposal: item, auth })}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
            {(() => {
              const lead = item.relatedLead;
              const leadName = typeof lead === 'object' ? (lead?.firstName ? `${lead.firstName}${lead.lastName ? ' ' + lead.lastName : ''}` : lead?.name || '') : '';
              const leadEmail = typeof lead === 'object' ? (lead?.email || '') : '';
              const display = leadName || leadEmail;
              return display ? <Text style={styles.cardLead} numberOfLines={1}>{display}</Text> : null;
            })()}
            {isAdmin && (() => {
              const agent = item.inCharge;
              if (typeof agent !== 'object' || !agent) return null;
              const agentName = agent.firstName
                ? `${agent.firstName}${agent.lastName ? ' ' + agent.lastName : ''}`.trim()
                : (agent.name || agent.email || '');
              return agentName ? (
                <View style={styles.agentBadge}>
                  <Text style={styles.agentBadgeText}>{agentName}</Text>
                </View>
              ) : null;
            })()}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '60' }]}>
              <View style={[styles.badgeDot, { backgroundColor: color }]} />
              <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[item.status] || item.status}</Text>
            </View>
            {isLive && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>En vivo</Text>
              </View>
            )}
          </View>
        </View>
        {/* Fila 1: fecha y moneda */}
        <View style={styles.cardMetaRow}>
          {item.updatedAt ? (
            <Text style={styles.metaItem}>{formatDate(item.updatedAt)}</Text>
          ) : null}
          {item.currency ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                {typeof item.currency === 'object' ? item.currency.code : item.currency}
              </Text>
            </View>
          ) : null}
          {item.number ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>#{item.number}</Text>
            </View>
          ) : null}
        </View>
        {/* Fila 2: temperatura y vistas */}
        {(TEMP_CONFIG[item.rating] || (item.views ?? item.visits ?? item.opens ?? item.timesOpened ?? item.opened) != null || (!isLive && lastViewTs)) && (
          <View style={styles.cardMetaBadges}>
            {TEMP_CONFIG[item.rating] && (() => {
              const tc = TEMP_CONFIG[item.rating];
              const TempIcon = item.rating === 'Hot' ? Fire : item.rating === 'Warm' ? Thermometer : Snowflake;
              return (
                <View style={[styles.tempBadge, { backgroundColor: tc.color + '18', borderColor: tc.color + '55' }]}>
                  <TempIcon size={12} color={tc.color} weight="fill" />
                  <Text style={[styles.tempText, { color: tc.color }]}>{tc.label}</Text>
                </View>
              );
            })()}
            {(() => {
              const v = item.views ?? item.visits ?? item.opens ?? item.timesOpened ?? item.opened ?? null;
              if (v == null) return null;
              return (
                <View style={styles.viewsBadge}>
                  <Eye size={12} color={COLORS.textMuted} weight="fill" />
                  <Text style={styles.viewsText}>{v} {v === 1 ? 'vista' : 'vistas'}</Text>
                </View>
              );
            })()}
            {!isLive && lastViewTs && (
              <View style={styles.lastViewBadge}>
                <Eye size={11} color="#60A5FA" weight="fill" />
                <Text style={styles.lastViewBadgeText}> {timeAgo(lastViewTs)}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.cardFooter}>
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>{t('tapToEdit')}</Text>
          </View>
          <View style={styles.cardFooterRight}>
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => openSendModal(item, 'whatsapp')}
              activeOpacity={0.7}
            >
              <Text style={styles.sendBtnText}>{t('sendBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {(isRecentlyViewed || isNeverViewedOld) && (
          <View style={styles.cardDivider} />
        )}
        {isRecentlyViewed && leadPhone && (
          <TouchableOpacity
            style={styles.urgentBtn}
            onPress={() => setSeguimientoModal({ visible: true, proposal: item, type: 'urgente' })}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Fire size={15} color="#FF5722" weight="fill" />
              <Text style={styles.urgentBtnText}>{t('urgentFollowup')}</Text>
            </View>
            <ArrowRight size={16} color="#AAAAAA" />
          </TouchableOpacity>
        )}
        {isRecentlyViewed && !leadPhone && (
          <TouchableOpacity
            style={styles.emailFollowupBtn}
            onPress={() => openSendModal(item, 'email')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Envelope size={15} color="#16A34A" weight="fill" />
              <Text style={styles.emailFollowupBtnText}>{t('followupByEmail')}</Text>
            </View>
            <ArrowRight size={16} color="#AAAAAA" />
          </TouchableOpacity>
        )}
        {isNeverViewedOld && leadPhone && (
          <TouchableOpacity
            style={styles.noVistaBtn}
            onPress={() => setSeguimientoModal({ visible: true, proposal: item, type: 'novista' })}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Phone size={15} color="#3B82F6" weight="fill" />
              <Text style={styles.noVistaBtnText}>{t('noViewsCallNow')}</Text>
            </View>
            <ArrowRight size={16} color="#AAAAAA" />
          </TouchableOpacity>
        )}
        {isNeverViewedOld && !leadPhone && (
          <TouchableOpacity
            style={styles.emailFollowupBtn}
            onPress={() => openSendModal(item, 'email')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Envelope size={15} color="#16A34A" weight="fill" />
              <Text style={styles.emailFollowupBtnText}>{t('noViewsSendEmail')}</Text>
            </View>
            <ArrowRight size={16} color="#AAAAAA" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  function renderSectionHeader({ section }) {
    if (!section.title) return null;
    const color = STATUS_COLOR[section.title];
    return (
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={[styles.sectionTitle, { color }]}>{STATUS_LABEL[section.title] || section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>
    );
  }

  const totalCount = allProposals.length;
  const visibleCount = sections.reduce((acc, s) => acc + s.data.length, 0);

  const styles = makeStyles(COLORS);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ProlibuLogoHorizontal scale={1} />
          <Text style={styles.headerSub} numberOfLines={1}>{userName}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => { setShowNotifications(true); markAllRead(); }}
            activeOpacity={0.7}
          >
            <Bell size={24} color={COLORS.text} />
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
          {auth && (
            <TouchableOpacity
              style={styles.newBtn}
              onPress={() => navigation.navigate('CreateProposal', { auth })}
              activeOpacity={0.8}
            >
              <Text style={styles.newBtnText}>{t('newProposal')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Barra de filtros fija */}
      {isAdmin && (
        <View style={styles.quickFilterBar}>
          {[
            { key: 'mine', label: t('myProposals') },
            { key: 'all',  label: t('platform') },
          ].map((qf) => {
            const active = quickFilter === qf.key;
            return (
              <TouchableOpacity
                key={qf.key}
                style={[styles.quickFilterChip, active && styles.quickFilterChipActive]}
                onPress={() => handleQuickFilter(qf.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickFilterChipText, active && styles.quickFilterChipTextActive]}>
                  {qf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {/* Barra de filtros de estado */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            const count = f.key === 'all'
              ? totalCount
              : allProposals.filter((p) => p.status === f.key).length;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: f.color, borderColor: f.color },
                ]}
                onPress={() => handleFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && { color: f.fg }]}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, active && { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                    <Text style={[styles.filterBadgeText, active && { color: f.fg }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Bot├│n de filtros avanzados */}
      <TouchableOpacity
        style={[styles.filterBarBtn, activeFilterCount > 0 && styles.filterBarBtnActive]}
        onPress={() => setFilterPanelVisible(true)}
        activeOpacity={0.85}
      >
        <SlidersHorizontal size={15} color={activeFilterCount > 0 ? COLORS.accentFg : COLORS.textMuted} />
        <Text style={[styles.filterBarBtnText, activeFilterCount > 0 && { color: COLORS.accentFg }]}>
          {activeFilterCount > 0 ? `${t('activeFilters')} (${activeFilterCount})` : t('advancedFilters')}
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => applyPanel({ sort: activeSort, lf: null, af: 'all', rf: 'all', vf: 'all', df: 'all', dfrom: '', dto: '', agf: null })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 }}>
              <X size={13} color={COLORS.accentFg} weight="bold" />
              <Text style={{ color: COLORS.accentFg, fontSize: 13, fontWeight: '700' }}>{t('clearFilters')}</Text>
            </View>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id || item._id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) loadMore();
          }}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor="transparent"
              colors={['transparent']}
            />
          }
          ListHeaderComponent={
            totalDocs > 0 ? (
              <View style={styles.paginationInfo}>
                <Text style={styles.paginationInfoText}>
                  {allProposals.length} / {totalDocs} {t('proposalsTitle').toLowerCase()}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={COLORS.accent} style={{ marginVertical: 20 }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>—</Text>
              <Text style={styles.emptyText}>{t('noProposals')}</Text>
              <Text style={styles.emptyHint}>
                {activeFilter === 'all' ? 'Desliza hacia abajo para recargar' : `No hay propuestas con estado "${FILTERS.find(f => f.key === activeFilter)?.label}"`}
              </Text>
            </View>
          }
        />
        {(loading || refreshing) && (
          <ProlibuLoader visible={true} background={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)'} />
        )}
      </View>

      {/* Panel de filtros avanzados */}
      <FilterPanel
        visible={filterPanelVisible}
        onClose={() => setFilterPanelVisible(false)}
        initialValues={{ sort: activeSort, lf: leadFilter, af: activityFilter, rf: ratingFilter, vf: viewsFilter, df: dateFilter, dfrom: dateFrom, dto: dateTo, agf: agentFilter }}
        leads={getUniqueLeads(allProposals)}
        agents={agentsList}
        isAdmin={isAdmin}
        onApply={applyPanel}
      />

      {/* Modal filtro por lead */}
      <Modal
        visible={leadPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setLeadPickerVisible(false); setLeadSearch(''); }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => { setLeadPickerVisible(false); setLeadSearch(''); }}
          />
          <View style={[styles.sendSheet, { maxHeight: '75%' }]}>
            <View style={styles.sendSheetHandle} />
            <Text style={styles.sendSheetTitle}>Filtrar por lead</Text>
            <TextInput
              style={[styles.emailSubjectInput, { marginTop: 12, marginBottom: 10 }]}
              value={leadSearch}
              onChangeText={setLeadSearch}
              placeholder="Buscar lead..."
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="search"
              autoCapitalize="none"
            />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Opci├│n "Todos" */}
              <TouchableOpacity
                style={[styles.leadPickerItem, !leadFilter && styles.leadPickerItemActive]}
                onPress={() => handleLeadFilter(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.leadPickerName, !leadFilter && { color: COLORS.accent }]}>
                  Todos los leads
                </Text>
              </TouchableOpacity>
              {getUniqueLeads(allProposals)
                .filter((l) => {
                  if (!leadSearch.trim()) return true;
                  const q = leadSearch.toLowerCase();
                  return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
                })
                .map((lead) => {
                  const active = leadFilter === lead.id;
                  const count = allProposals.filter((p) => {
                    const l = p.relatedLead;
                    return typeof l === 'object' && l && (l._id || l.id) === lead.id;
                  }).length;
                  return (
                    <TouchableOpacity
                      key={lead.id}
                      style={[styles.leadPickerItem, active && styles.leadPickerItemActive]}
                      onPress={() => handleLeadFilter(lead.id)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.leadPickerName, active && { color: COLORS.accent }]}>
                          {lead.name}
                        </Text>
                        {lead.email ? (
                          <Text style={styles.leadPickerEmail}>{lead.email}</Text>
                        ) : null}
                      </View>
                      <View style={styles.leadPickerCount}>
                        <Text style={styles.leadPickerCountText}>{count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal enviar propuesta */}
      <Modal
        visible={sendModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setSendModal({ ...sendModal, visible: false })}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSendModal({ ...sendModal, visible: false })}
          />
          <View style={styles.sendSheet}>
            <View style={styles.sendSheetHandle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.sendSheetTitle}>Enviar propuesta</Text>
              {sendModal.proposal && (
                <Text style={styles.sendSheetSub} numberOfLines={1}>
                  {sendModal.proposal.title || sendModal.proposal.name}
                </Text>
              )}

              {/* ÔöÇÔöÇ Selector de canal ÔöÇÔöÇ */}
              <Text style={styles.sendSheetLabel}>Canal</Text>
              <View style={styles.channelRow}>
                {[
                  { key: 'whatsapp', Icon: WhatsappLogo, label: 'WhatsApp',  color: '#25D366' },
                  { key: 'email',    Icon: Envelope,     label: 'Correo',    color: '#4A90E2' },
                  { key: 'share',    Icon: Export,       label: 'Compartir', color: COLORS.accent },
                ].map((ch) => {
                  const active = sendModal.channel === ch.key;
                  return (
                    <TouchableOpacity
                      key={ch.key}
                      style={[styles.channelBtn, active && { borderColor: ch.color, backgroundColor: ch.color + '18' }]}
                      onPress={() => setSendModal({ ...sendModal, channel: ch.key })}
                      activeOpacity={0.7}
                    >
                      <ch.Icon size={20} color={active ? ch.color : COLORS.textMuted} weight={active ? 'fill' : 'regular'} />
                      <Text style={[styles.channelBtnLabel, active && { color: ch.color, fontWeight: '700' }]}>
                        {ch.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ÔöÇÔöÇ Tipo de URL ÔöÇÔöÇ */}
              <Text style={styles.sendSheetLabel}>Tipo de URL</Text>
              <View style={styles.urlTypeRow}>
                {(() => {
                  const canClient = sendModal.proposal?.status === 'Ready';
                  return (
                    <TouchableOpacity
                      style={[styles.urlTypeBtn, sendModal.urlType === 'client' && styles.urlTypeBtnActive, !canClient && { opacity: 0.38 }]}
                      onPress={async () => {
                        if (!canClient) return;
                        const newUrl = await buildClientShortUrl(sendModal.proposal);
                        const lines = sendModal.waMsg.split('\n');
                        const last = lines[lines.length - 1];
                        const newWaMsg = (last.startsWith('http') || last.startsWith('/'))
                          ? [...lines.slice(0, -1), newUrl].join('\n')
                          : `${sendModal.waMsg}\n${newUrl}`;
                        setSendModal({ ...sendModal, urlType: 'client', waMsg: newWaMsg });
                      }}
                      activeOpacity={canClient ? 0.7 : 1}
                    >
                      <Text style={[styles.urlTypeBtnTitle, sendModal.urlType === 'client' && canClient && { color: COLORS.accent }]}>URL Cliente</Text>
                      <Text style={styles.urlTypeBtnDesc}>{canClient ? 'URL corta ┬À Con seguimiento' : 'Solo propuestas Lista'}</Text>
                    </TouchableOpacity>
                  );
                })()}
                <TouchableOpacity
                  style={[styles.urlTypeBtn, sendModal.urlType === 'anonymous' && styles.urlTypeBtnActive]}
                  onPress={() => {
                    const newUrl = buildProposalUrl(sendModal.proposal, 'anonymous');
                    const lines = sendModal.waMsg.split('\n');
                    const last = lines[lines.length - 1];
                    const newWaMsg = (last.startsWith('http') || last.startsWith('/'))
                      ? [...lines.slice(0, -1), newUrl].join('\n')
                      : `${sendModal.waMsg}\n${newUrl}`;
                    setSendModal({ ...sendModal, urlType: 'anonymous', waMsg: newWaMsg });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.urlTypeBtnTitle, sendModal.urlType === 'anonymous' && { color: COLORS.accent }]}>URL An├│nima</Text>
                  <Text style={styles.urlTypeBtnDesc}>URL larga ┬À Sin seguimiento</Text>
                </TouchableOpacity>
              </View>

              {/* ÔöÇÔöÇ Template seg├║n canal ÔöÇÔöÇ */}
              {sendModal.channel === 'whatsapp' && (
                <>
                  <Text style={styles.sendSheetLabel}>Mensaje</Text>
                  <TextInput
                    style={styles.waMsgInput}
                    value={sendModal.waMsg}
                    onChangeText={(v) => setSendModal({ ...sendModal, waMsg: v })}
                    multiline
                    placeholderTextColor={COLORS.textMuted}
                    placeholder="Escribe el mensaje..."
                    returnKeyType="done"
                    blurOnSubmit
                  />
                  <Text style={styles.waMsgHint}>{t('sendEditHint')}</Text>
                </>
              )}

              {sendModal.channel === 'email' && (
                <>
                  <Text style={styles.sendSheetLabel}>Asunto</Text>
                  <TextInput
                    style={styles.emailSubjectInput}
                    value={sendModal.emailSubject}
                    onChangeText={(v) => setSendModal({ ...sendModal, emailSubject: v })}
                    placeholderTextColor={COLORS.textMuted}
                    placeholder="Asunto del correo..."
                    returnKeyType="done"
                    blurOnSubmit
                  />
                  <Text style={[styles.sendSheetLabel, { marginTop: 10 }]}>Cuerpo</Text>
                  <TextInput
                    style={styles.waMsgInput}
                    value={sendModal.emailMsg}
                    onChangeText={(v) => setSendModal({ ...sendModal, emailMsg: v })}
                    multiline
                    placeholderTextColor={COLORS.textMuted}
                    placeholder="Escribe el mensaje..."
                    returnKeyType="done"
                    blurOnSubmit
                  />
                  <Text style={styles.waMsgHint}>La URL se adjunta autom├íticamente al final</Text>
                </>
              )}

              {sendModal.channel === 'share' && (
                <View style={styles.shareInfo}>
                  <Export size={18} color={COLORS.accent} />
                  <Text style={styles.shareInfoText}>
                    Se compartir├í el mensaje con el template y el enlace de la propuesta
                  </Text>
                </View>
              )}

              {/* ÔöÇÔöÇ Bot├│n enviar ÔöÇÔöÇ */}
              <TouchableOpacity
                style={[
                  styles.sendConfirmBtn,
                  sendModal.channel === 'whatsapp' && { backgroundColor: '#25D366' },
                  sendModal.channel === 'email'    && { backgroundColor: '#4A90E2' },
                  sendModal.channel === 'share'    && { backgroundColor: COLORS.accent },
                ]}
                activeOpacity={0.8}
                onPress={async () => {
                  if (sendModal.channel === 'whatsapp') {
                    handleWhatsApp(sendModal.proposal, sendModal.urlType, sendModal.waMsg, true);
                    setSendModal({ ...sendModal, visible: false });
                  } else if (sendModal.channel === 'email') {
                    handleEmail(sendModal.proposal, sendModal.urlType, sendModal.emailSubject, sendModal.emailMsg);
                    setSendModal({ ...sendModal, visible: false });
                  } else {
                    // Share: usar waMsg (template + URL) ÔÇö solo message para evitar duplicado en Android
                    const url = sendModal.urlType === 'client'
                      ? await buildClientShortUrl(sendModal.proposal)
                      : buildProposalUrl(sendModal.proposal, sendModal.urlType);
                    const shareMsg = sendModal.waMsg || url;
                    try {
                      await Share.share({
                        message: shareMsg,
                        title: sendModal.proposal?.title || sendModal.proposal?.name || 'Propuesta',
                      });
                    } catch {}
                    setSendModal({ ...sendModal, visible: false });
                  }
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {sendModal.channel === 'whatsapp' ? <WhatsappLogo size={18} color="#fff" /> :
                   sendModal.channel === 'email'    ? <Envelope size={18} color="#fff" /> :
                                                      <Export size={18} color="#fff" />}
                  <Text style={styles.sendConfirmText}>
                    {sendModal.channel === 'whatsapp' ? t('sendViaWhatsApp') :
                     sendModal.channel === 'email'    ? t('sendViaEmail')    :
                                                        t('sendViaShare')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sendCancelBtn}
                onPress={() => setSendModal({ ...sendModal, visible: false })}
                activeOpacity={0.7}
              >
                <Text style={styles.sendCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal seguimiento urgente */}
      <Modal
        visible={seguimientoModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setSeguimientoModal({ ...seguimientoModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSeguimientoModal({ ...seguimientoModal, visible: false })}
          />
          <View style={styles.sendSheet}>
            <View style={styles.sendSheetHandle} />
            {seguimientoModal.type === 'urgente' ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Fire size={20} color="#FF5722" weight="fill" />
                  <Text style={styles.sendSheetTitle}>Llamarlo ahora</Text>
                </View>
                <Text style={styles.sendSheetSub}>
                  El cliente vio la propuesta hace menos de 1 hora. ┬íEs el momento de contactar!
                </Text>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Phone size={20} color="#3B82F6" weight="fill" />
                  <Text style={styles.sendSheetTitle}>{t('noViewsCallNow')}</Text>
                </View>
                <Text style={styles.sendSheetSub}>
                  Esta propuesta lleva m├ís de una semana sin ser vista. Recu├®rdale al lead.
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[styles.seguimientoBtn, { backgroundColor: '#25D366' }]}
              onPress={async () => {
                const p = seguimientoModal.proposal;
                if (!p) return;
                const lead = p.relatedLead;
                const name = typeof lead === 'object' ? (lead?.firstName || lead?.name || '') : '';
                const t = p.title || p.name || '';
                const urlType = p.status === 'Ready' ? 'client' : 'anonymous';
                const url = urlType === 'client'
                  ? await buildClientShortUrl(p)
                  : buildProposalUrl(p, 'anonymous');
                const applyTpl = (tpl) =>
                  tpl.replace('{nombre}', name).replace('{propuesta}', t).replace('{url}', url);
                const defaults = {
                  urgente: `Hola${name ? ` ${name}` : ''}, ┬┐qu├® te pareci├│${t ? ` "${t}"` : ' nuestra propuesta'}? Quedo atento a tus comentarios ­ƒÿè\n${url}`,
                  novista: `Hola${name ? ` ${name}` : ''}, quer├¡a recordarte que tienes una propuesta disponible${t ? `: "${t}"` : ''}. ┬┐Tienes alguna duda? Con gusto te ayudo.\n${url}`,
                };
                const tplKey = seguimientoModal.type === 'urgente' ? 'urgente' : 'novista';
                const tplRaw = msgTemplates?.[tplKey];
                const msg = tplRaw ? applyTpl(tplRaw) : defaults[tplKey];
                handleWhatsApp(p, urlType, msg, true);
                setSeguimientoModal({ ...seguimientoModal, visible: false });
              }}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <WhatsappLogo size={18} color="#fff" />
              <Text style={[styles.seguimientoBtnText, { color: '#fff' }]}>{t('send')} WhatsApp</Text>
              </View>
            </TouchableOpacity>

            {seguimientoModal.proposal && getLeadPhone(seguimientoModal.proposal) ? (
              <TouchableOpacity
                style={[styles.seguimientoBtn, { backgroundColor: '#3B82F6', marginTop: 10 }]}
                onPress={() => {
                  Linking.openURL(`tel:${getLeadPhone(seguimientoModal.proposal)}`);
                  setSeguimientoModal({ ...seguimientoModal, visible: false });
                }}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Phone size={18} color="#fff" />
                  <Text style={[styles.seguimientoBtnText, { color: '#fff' }]}>{t('send')} WhatsApp</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.sendCancelBtn, { marginTop: 10 }]}
              onPress={() => setSeguimientoModal({ ...seguimientoModal, visible: false })}
              activeOpacity={0.7}
            >
              <Text style={styles.sendCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de notificaciones */}}
      <Modal
        visible={showNotifications}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifications(false)}
      >
        <SafeAreaView style={styles.notifSafe} edges={['top', 'bottom']}>
          <View style={styles.notifHeader}>
            <View>
              <Text style={styles.notifTitle}>{t('notificationsTitle')}</Text>
              {connected
                ? <Text style={styles.notifConnected}>&#x2714; {t('liveConnected') || 'Conectado en tiempo real'}</Text>
                : <Text style={styles.notifDisconnected}>&#x25CB; {t('liveDisconnected') || 'Sin conexi\u00f3n en tiempo real'}</Text>}
            </View>
            <View style={styles.notifHeaderRight}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAll} style={styles.notifClearBtn}>
                  <Text style={styles.notifClearText}>{t('clearAll')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.notifCloseBtn}>
                <X size={20} color={COLORS.text} weight="bold" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Banner: permiso de notificaciones denegado */}
          {notifPermission === 'denied' && (
            <TouchableOpacity
              style={styles.notifPermBanner}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.8}
            >
              <Text style={styles.notifPermBannerText}>
                ÔÜá´©Å Los banners est├ín desactivados. Toca aqu├¡ para activar notificaciones en Ajustes.
              </Text>
            </TouchableOpacity>
          )}

          {notifications.length === 0 ? (
            <View style={styles.notifEmpty}>
              <BellRinging size={48} color={COLORS.textMuted} />
              <Text style={styles.notifEmptyText}>{t('noNotifications')}</Text>
              <Text style={styles.notifEmptyHint}>Cuando un cliente abra una propuesta aparecer├í aqu├¡</Text>
            </View>
          ) : (
            <ScrollView style={styles.notifList} contentContainerStyle={{ paddingBottom: 32 }}>
              {notifications.map((n) => {
                const isStatusChange = n.type === 'status_change';
                const STATUS_LABEL_MAP = { Draft: 'Borrador', Ready: 'Lista', Approved: 'Aprobada', Denied: 'Negada' };
                const STATUS_COLOR_MAP = { Draft: '#FDBD00', Ready: '#4285F4', Approved: '#39B54A', Denied: '#D4145A' };
                return (
                  <View key={n.id} style={[styles.notifItem, !n.read && styles.notifItemUnread]}>
                    <View style={[styles.notifItemIcon, isStatusChange && { backgroundColor: (STATUS_COLOR_MAP[n.toStatus] || COLORS.accent) + '15' }]}>
                      {isStatusChange
                        ? <Text style={{ fontSize: 18 }}>­ƒôï</Text>
                        : <Eye size={20} color={COLORS.accent} weight="fill" />
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      {isStatusChange ? (
                        <>
                          <Text style={styles.notifItemTitle} numberOfLines={1}>
                            Propuesta {STATUS_LABEL_MAP[n.toStatus] || n.toStatus}
                          </Text>
                          <Text style={styles.notifItemSub} numberOfLines={1}>
                            {n.proposalTitle}
                          </Text>
                          <Text style={[styles.notifItemEmail, { color: STATUS_COLOR_MAP[n.toStatus] || COLORS.textMuted }]}>
                            {STATUS_LABEL_MAP[n.fromStatus] || n.fromStatus} ÔåÆ {STATUS_LABEL_MAP[n.toStatus] || n.toStatus}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.notifItemTitle} numberOfLines={1}>
                            {n.leadName || 'Cliente'} vio tu propuesta
                          </Text>
                          <Text style={styles.notifItemSub} numberOfLines={1}>
                            {n.proposalTitle}{n.proposalNumber ? ` ┬À #${n.proposalNumber}` : ''}
                          </Text>
                          {n.leadEmail ? (
                            <Text style={styles.notifItemEmail} numberOfLines={1}>{n.leadEmail}</Text>
                          ) : null}
                        </>
                      )}
                      <Text style={styles.notifItemTime}>
                        {new Date(n.timestamp).toLocaleString('es-CO', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <BottomTabBar active="Proposals" navigation={navigation} />
    </SafeAreaView>
  );
}

// ÔöÇÔöÇÔöÇ Panel de filtros avanzados ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function FilterPanel({ visible, onClose, initialValues, leads, agents, isAdmin, onApply }) {
  const { colors: COLORS } = useTheme();
  const { t } = useTranslation();
  const [sort,  setSort]  = useState(initialValues.sort);
  const [af,    setAf]    = useState(initialValues.af);
  const [rf,    setRf]    = useState(initialValues.rf);
  const [vf,    setVf]    = useState(initialValues.vf);
  const [lf,    setLf]    = useState(initialValues.lf);
  const [df,    setDf]    = useState(initialValues.df);
  const [dfrom, setDfrom] = useState(initialValues.dfrom);
  const [dto,   setDto]   = useState(initialValues.dto);
  const [agf,   setAgf]   = useState(initialValues.agf ?? null);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadDropOpen, setLeadDropOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentDropOpen, setAgentDropOpen] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setSort(initialValues.sort);
      setAf(initialValues.af);
      setRf(initialValues.rf);
      setVf(initialValues.vf);
      setLf(initialValues.lf);
      setDf(initialValues.df);
      setDfrom(initialValues.dfrom);
      setDto(initialValues.dto);
      setAgf(initialValues.agf ?? null);
      setLeadSearch('');
      setLeadDropOpen(false);
      setAgentSearch('');
      setAgentDropOpen(false);
    }
  }, [visible]);

  function clearAll() {
    setSort('updatedAt_desc'); setAf('all'); setRf('all');
    setVf('all'); setLf(null); setDf('all'); setDfrom(''); setDto('');
    setAgf(null);
    setLeadSearch(''); setLeadDropOpen(false);
    setAgentSearch(''); setAgentDropOpen(false);
  }

  // Chip toggle: si ya est├í activo, vuelve a 'all'
  function toggle(current, key, setter, reset = 'all') {
    setter(current === key ? reset : key);
  }

  const SORT_OPTS = [
    { key: 'updatedAt_desc', label: t('sortRecent')    },
    { key: 'updatedAt_asc',  label: t('sortOldest')    },
    { key: 'createdAt_desc', label: t('sortCreation')  },
    { key: 'title_asc',      label: t('sortAZ')        },
  ];
  const ACTIVITY_OPTS = [
    { key: 'all',             label: t('activityAll')            },
    { key: 'viewed_today',    label: t('activityViewedToday')    },
    { key: 'viewed_week',     label: t('activityViewedWeek')     },
    { key: 'not_viewed',      label: t('activityNotViewed')      },
    { key: 'approved_viewed', label: t('activityApprovedViewed') },
    { key: 'ready_viewed',    label: t('activityReadyViewed')    },
  ];
  const RATING_OPTS = [
    { key: 'all',  label: t('viewsAll')  },
    { key: 'Hot',  label: t('tempHot')   },
    { key: 'Warm', label: t('tempWarm')  },
    { key: 'Cold', label: t('tempCold')  },
  ];
  const VIEWS_OPTS = [
    { key: 'all',        label: t('viewsAll')       },
    { key: 'has_views',  label: t('viewsHasViews')  },
    { key: 'no_views',   label: t('viewsNoViews')   },
    { key: 'many_views', label: t('viewsManyViews') },
  ];
  const DATE_OPTS = [
    { key: 'all',     label: t('dateAll')     },
    { key: 'today',   label: t('dateToday')   },
    { key: 'week',    label: t('dateWeek')    },
    { key: 'month',   label: t('dateMonth')   },
    { key: '3months', label: t('date3Months') },
    { key: 'custom',  label: t('dateCustom')  },
  ];

  const filteredLeads = leads.filter((l) => {
    if (!leadSearch.trim()) return true;
    const q = leadSearch.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
  });

  const filteredAgents = (agents || []).filter((a) => {
    if (!agentSearch.trim()) return true;
    const q = agentSearch.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  });

  function PanelSection({ title, children }) {
    return (
      <View style={styles.panelSection}>
        <Text style={styles.panelSectionTitle}>{title}</Text>
        {children}
      </View>
    );
  }

  function ChipRow({ opts, value, onSelect }) {
    return (
      <View style={styles.panelChipRow}>
        {opts.map((o) => {
          const active = value === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.panelChip, active && styles.panelChipActive]}
              onPress={() => onSelect(active && o.key !== 'all' ? 'all' : o.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.panelChipText, active && styles.panelChipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  const styles = makeStyles(COLORS);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sendSheet, { maxHeight: '94%' }]}>
          <View style={styles.sendSheetHandle} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <View>
              <Text style={styles.sendSheetTitle}>{t('advancedFilters')}</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>{t('tapFilterToDisable') || 'Toca un filtro activo para desactivarlo'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.notifCloseBtn}>
              <X size={20} color={COLORS.text} weight="bold" />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <PanelSection title={t('sortBy')}>
              <ChipRow opts={SORT_OPTS} value={sort} onSelect={setSort} />
            </PanelSection>

            <PanelSection title={t('filterByActivity')}>
              <ChipRow opts={ACTIVITY_OPTS} value={af} onSelect={setAf} />
            </PanelSection>

            <PanelSection title={t('filterByRating')}>
              <ChipRow opts={RATING_OPTS} value={rf} onSelect={setRf} />
            </PanelSection>

            <PanelSection title={t('filterByViews')}>
              <ChipRow opts={VIEWS_OPTS} value={vf} onSelect={setVf} />
            </PanelSection>

            <PanelSection title={t('filterByDate')}>
              <ChipRow opts={DATE_OPTS} value={df} onSelect={setDf} />
              {df === 'custom' && (
                <View style={styles.dateRangeRow}>
                  <View style={styles.dateInputWrap}>
                    <Text style={styles.dateInputLabel}>{t('dateFrom')}</Text>
                    <TextInput
                      style={styles.dateInput}
                      value={dfrom}
                      onChangeText={setDfrom}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                  <ArrowRight size={16} color={COLORS.textMuted} style={{ alignSelf: 'flex-end', marginBottom: 12, marginHorizontal: 4 }} />
                  <View style={styles.dateInputWrap}>
                    <Text style={styles.dateInputLabel}>{t('dateTo')}</Text>
                    <TextInput
                      style={styles.dateInput}
                      value={dto}
                      onChangeText={setDto}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                </View>
              )}
            </PanelSection>

            <PanelSection title={t('filterByAgent') || 'Lead'}>
              {/* Bot├│n selector colapsable */}
              <TouchableOpacity
                style={styles.leadDropBtn}
                onPress={() => setLeadDropOpen((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={[styles.leadDropBtnText, lf && { color: COLORS.accent }]} numberOfLines={1}>
                  {lf ? (leads.find((l) => l.id === lf)?.name || 'Lead seleccionado') : 'Todos los leads'}
                </Text>
                <CaretDown
                  size={16}
                  color={COLORS.textMuted}
                  style={{ transform: [{ rotate: leadDropOpen ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {/* Lista desplegable */}
              {leadDropOpen && (
                <View style={styles.leadDropList}>
                  <TextInput
                    style={[styles.emailSubjectInput, { marginBottom: 8, marginTop: 4 }]}
                    value={leadSearch}
                    onChangeText={setLeadSearch}
                    placeholder="Buscar lead..."
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                  />
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {[{ id: null, name: 'Todos los leads', email: '' }, ...filteredLeads].map((lead) => {
                      const active = lf === lead.id;
                      return (
                        <TouchableOpacity
                          key={lead.id ?? '__all__'}
                          style={[styles.panelLeadBtn, { marginBottom: 6 }, active && styles.panelLeadBtnActive]}
                          onPress={() => { setLf(active && lead.id !== null ? null : lead.id); setLeadDropOpen(false); setLeadSearch(''); }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.panelLeadBtnText, active && styles.panelLeadBtnTextActive]}>{lead.name}</Text>
                            {lead.email ? <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>{lead.email}</Text> : null}
                          </View>
                          {active && <Check size={16} color={COLORS.accent} weight="bold" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </PanelSection>

            {isAdmin && (
              <PanelSection title={t('agent') || 'Asesor'}>
                <TouchableOpacity
                  style={styles.leadDropBtn}
                  onPress={() => setAgentDropOpen((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.leadDropBtnText, agf && { color: COLORS.accent }]} numberOfLines={1}>
                    {agf ? ((agents || []).find((a) => a.id === agf)?.name || 'Asesor seleccionado') : 'Todos los asesores'}
                  </Text>
                  <CaretDown
                    size={16}
                    color={COLORS.textMuted}
                    style={{ transform: [{ rotate: agentDropOpen ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {agentDropOpen && (
                  <View style={styles.leadDropList}>
                    <TextInput
                      style={[styles.emailSubjectInput, { marginBottom: 8, marginTop: 4 }]}
                      value={agentSearch}
                      onChangeText={setAgentSearch}
                      placeholder="Buscar asesor..."
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="none"
                    />
                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} nestedScrollEnabled>
                      {[{ id: null, name: 'Todos los asesores', email: '' }, ...filteredAgents].map((agent) => {
                        const active = agf === agent.id;
                        return (
                          <TouchableOpacity
                            key={agent.id ?? '__all_agents__'}
                            style={[styles.panelLeadBtn, { marginBottom: 6 }, active && styles.panelLeadBtnActive]}
                            onPress={() => { setAgf(active && agent.id !== null ? null : agent.id); setAgentDropOpen(false); setAgentSearch(''); }}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.panelLeadBtnText, active && styles.panelLeadBtnTextActive]}>{agent.name}</Text>
                              {agent.email ? <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>{agent.email}</Text> : null}
                            </View>
                            {active && <Check size={16} color={COLORS.accent} weight="bold" />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </PanelSection>
            )}

            <TouchableOpacity
              style={styles.panelApplyBtn}
              onPress={() => onApply({ sort, lf, af, rf, vf, df, dfrom, dto, agf })}
              activeOpacity={0.8}
            >
              <Text style={styles.panelApplyText}>{t('applyFilters')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.panelClearBtn} onPress={clearAll} activeOpacity={0.7}>
              <Text style={styles.panelClearText}>{t('clearFilters')}</Text>
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  headerSub: { color: C.textMuted, fontSize: 11, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countBadge: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { color: C.accentFg, fontWeight: '700', fontSize: 13 },
  newBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  logoutText: { color: C.textMuted, fontWeight: '600', fontSize: 13 },

  // Barra de acceso rapido
  quickNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  quickNavBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickNavText: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  quickNavSep: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: C.border,
  },

  // Barra de filtros
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  filterChipText: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterBadgeText: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  loader: { marginTop: 60 },
  list: { padding: 16, paddingBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontWeight: '700', fontSize: 14, flex: 1 },
  sectionCount: {
    color: C.textMuted,
    fontSize: 12,
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLive: {
    borderColor: '#39B54A',
    borderWidth: 1.5,
    shadowColor: '#39B54A',
    shadowOpacity: 0.15,
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#22c55e18', borderWidth: 1, borderColor: '#22c55e60',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  livePillText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  lastViewBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
    borderColor: '#60A5FA40', backgroundColor: '#60A5FA0D',
  },
  lastViewBadgeText: { color: '#60A5FA', fontSize: 11, fontWeight: '600' },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: { color: C.text, fontWeight: '700', fontSize: 15 },
  cardLead: { color: C.textMuted, fontSize: 12, marginTop: 3 },
  agentBadge: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 5, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
    borderColor: C.accent + '40', backgroundColor: C.accent + '12',
  },
  agentBadgeText: { color: C.accent, fontSize: 11, fontWeight: '600' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardMetaRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8, flexWrap: 'wrap',
  },
  cardMetaBadges: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 12,
  },
  metaItem: { color: C.textMuted, fontSize: 12 },
  metaChip: {
    backgroundColor: C.card, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: C.border,
  },
  metaChipText: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  cardDivider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  editHint: { flex: 1 },
  editHintText: { color: C.textMuted, fontSize: 11 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  sortBar: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  sortScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  sortChipActive: {
    backgroundColor: C.accent + '20',
    borderColor: C.accent,
  },
  sortChipText: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  sortChipTextActive: { color: C.accent },
  sortSep: { width: 1, backgroundColor: C.border, marginHorizontal: 4, alignSelf: 'stretch' },
  filterPanelBtn: {},  // legacy, unused
  filterPanelBtnActive: {},
  filterPanelBtnText: {},
  filterPanelBtnTextActive: {},
  filterBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  filterBarBtnActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  filterBarBtnIcon: { fontSize: 15, color: C.textMuted },
  filterBarBtnText: { color: C.textMuted, fontSize: 13, fontWeight: '700' },
  dateRangeRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
  },
  dateInputWrap: { flex: 1 },
  dateInputLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  dateInput: {
    backgroundColor: C.card, color: C.text,
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  // Panel styles
  panelSection: { marginBottom: 20 },
  panelSectionTitle: {
    color: C.textMuted, fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  panelChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  panelChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card,
  },
  panelChipActive: { borderColor: C.accent, backgroundColor: C.accent + '15' },
  panelChipText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  panelChipTextActive: { color: C.accent, fontWeight: '700' },
  leadDropBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.card,
  },
  leadDropBtnText: { color: C.textMuted, fontSize: 14, flex: 1, marginRight: 8 },
  leadDropList: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    marginTop: 6, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 6,
    backgroundColor: C.card, maxHeight: 280,
  },
  panelLeadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.bg,
  },
  panelLeadBtnActive: { borderColor: C.accent, backgroundColor: C.accent + '10' },
  panelLeadBtnText: { color: C.textMuted, fontSize: 14 },
  panelLeadBtnTextActive: { color: C.accent, fontWeight: '600' },
  panelApplyBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  panelApplyText: { color: C.accentFg, fontWeight: '800', fontSize: 16 },
  panelClearBtn: {
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  panelClearText: { color: C.textMuted, fontWeight: '600', fontSize: 14 },
  leadPickerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  leadPickerItemActive: { backgroundColor: C.accent + '10' },
  leadPickerName: { color: C.text, fontSize: 14, fontWeight: '600' },
  leadPickerEmail: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  leadPickerCount: {
    backgroundColor: C.border, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8,
  },
  leadPickerCountText: { color: C.textMuted, fontSize: 12, fontWeight: '700' },
  tempBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  tempText: { fontSize: 12, fontWeight: '700' },
  viewsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.card,
  },
  viewsText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  cardFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendBtn: {
    backgroundColor: C.accent, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sendSheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
    borderWidth: 1, borderColor: C.border,
  },
  sendSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: 'center', marginBottom: 20,
  },
  sendSheetTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sendSheetSub: { color: C.textMuted, fontSize: 13, marginBottom: 20 },
  sendSheetLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 16,
  },
  urlTypeRow: { flexDirection: 'row', gap: 10 },
  urlTypeBtn: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, padding: 14,
  },
  urlTypeBtnActive: { borderColor: C.accent, backgroundColor: C.accent + '15' },
  urlTypeBtnTitle: { color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  urlTypeBtnDesc: { color: C.textMuted, fontSize: 11 },
  waMsgInput: {
    backgroundColor: C.card, color: C.text,
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },
  emailSubjectInput: {
    backgroundColor: C.card, color: C.text,
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    padding: 12, fontSize: 14,
  },
  waMsgHint: { color: C.textMuted, fontSize: 11, marginTop: 4, marginBottom: 4 },
  channelRow: { flexDirection: 'row', gap: 8 },
  channelBtn: {
    flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.card, paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  channelBtnIcon: { fontSize: 20, color: C.textMuted },
  channelBtnLabel: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  shareInfo: {
    marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, padding: 16, alignItems: 'center', gap: 8,
  },
  shareInfoIcon: { fontSize: 28, color: C.text },
  shareInfoText: { color: C.textMuted, fontSize: 13, textAlign: 'center' },
  sendConfirmBtn: {
    marginTop: 20, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  sendConfirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sendCancelBtn: {
    marginTop: 20, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  sendCancelText: { color: C.textMuted, fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { color: C.accentFg, fontSize: 30, fontWeight: '300', lineHeight: 34 },

  // Bell
  bellBtn: { position: 'relative', padding: 4 },
  bellIcon: { fontSize: 22 },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#EF4444', borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Notification modal
  notifSafe: { flex: 1, backgroundColor: C.bg },
  notifHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  notifTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  notifConnected: { color: '#22c55e', fontSize: 11, marginTop: 2 },
  notifDisconnected: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  notifPermBanner: {
    backgroundColor: '#FDBD0020',
    borderWidth: 1,
    borderColor: '#FDBD00',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  notifPermBannerText: { color: C.text, fontSize: 13, lineHeight: 18 },
  notifHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifClearBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  notifClearText: { color: C.textMuted, fontSize: 13 },
  notifCloseBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  notifCloseText: { color: C.text, fontSize: 14, fontWeight: '700' },
  notifList: { flex: 1 },
  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  notifItemUnread: { backgroundColor: C.accent + '10' },
  notifItemIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  notifItemTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  notifItemSub: { color: C.textMuted, fontSize: 13, marginTop: 2 },
  notifItemEmail: { color: C.accent, fontSize: 12, marginTop: 2 },
  notifItemTime: { color: C.textMuted, fontSize: 11, marginTop: 4 },
  notifEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  notifEmptyIcon: { fontSize: 48 },
  notifEmptyText: { color: C.text, fontSize: 16, fontWeight: '700' },
  notifEmptyHint: { color: C.textMuted, fontSize: 13, textAlign: 'center' },

  // Seguimiento urgente
  urgentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF3F0',
    borderWidth: 1,
    borderColor: '#FF5722',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  urgentBtnText: { color: '#FF5722', fontSize: 13, fontWeight: '700' },
  noVistaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  noVistaBtnText: { color: '#3B82F6', fontSize: 13, fontWeight: '700' },
  emailFollowupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  emailFollowupBtnText: { color: '#16A34A', fontSize: 13, fontWeight: '700' },
  seguimientoArrow: { color: '#AAAAAA', fontSize: 16, fontWeight: '400' },
  seguimientoBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  seguimientoBtnText: { fontSize: 16, fontWeight: '700' },
  paginationInfo: {
    alignItems: 'center', paddingVertical: 6, marginBottom: 4,
  },
  paginationInfoText: { color: C.textMuted, fontSize: 12 },
  loadMoreBtn: {
    marginHorizontal: 16, marginVertical: 12,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: C.accent,
    alignItems: 'center', backgroundColor: C.accent + '10',
  },
  loadMoreText: { color: C.accent, fontWeight: '700', fontSize: 14 },
  quickFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  quickFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  quickFilterChipActive: {
    borderColor: C.accent,
    backgroundColor: C.accent,
  },
  quickFilterChipText: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  quickFilterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  });
}
