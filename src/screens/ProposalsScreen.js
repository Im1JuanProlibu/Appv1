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
import { getProposals, getApiBase, generateShortUrl } from '../api';
import { useNotifications } from '../useNotifications';
import BottomTabBar from '../components/BottomTabBar';
import { ProlibuLogoHorizontal } from '../components/ProlibuLogo';
import { ProlibuLoader } from '../components/ProlibuLoader';
import {
  Bell, BellRinging, Eye, Fire, Thermometer, Snowflake, Phone, Envelope,
  WhatsappLogo, Export, ArrowRight, X, SlidersHorizontal, Check,
} from 'phosphor-react-native';

const STATUS_COLOR = {
  Ready: '#39B54A',
  Draft: '#FDBD00',
  Approved: '#4285F4',
  Denied: '#D4145A',
};
const STATUS_LABEL = { Draft: 'Borrador', Ready: 'Lista', Approved: 'Aprobada', Denied: 'Negada' };

const TEMP_CONFIG = {
  Hot:  { label: 'Caliente', color: '#FF5722' },
  Warm: { label: 'Tibia',    color: '#F59E0B' },
  Cold: { label: 'Fria',     color: '#60A5FA' },
};

const SORT_OPTIONS = [
  { key: 'updatedAt_desc', label: 'Recientes'  },
  { key: 'updatedAt_asc',  label: 'Antiguas'   },
  { key: 'createdAt_desc', label: 'Creacion'   },
  { key: 'title_asc',      label: 'A-Z'        },
];

const ACTIVITY_FILTERS = [
  { key: 'all',             label: 'Toda actividad' },
  { key: 'viewed_today',    label: '👁 Vista hoy'       },
  { key: 'viewed_week',     label: '👁 Esta semana'     },
  { key: 'not_viewed',      label: '○ Sin vistas'       },
  { key: 'approved_viewed', label: '✓ Aprobada + vista' },
  { key: 'ready_viewed',    label: '● Lista + vista'    },
];

function makeFilters(accent) {
  return [
    { key: 'all',      label: 'Todas',    color: accent,     fg: '#ffffff' },
    { key: 'Draft',    label: 'Borrador', color: '#FDBD00',  fg: '#000000' },
    { key: 'Ready',    label: 'Lista',    color: '#39B54A',  fg: '#ffffff' },
    { key: 'Approved', label: 'Aprobada', color: '#4285F4',  fg: '#ffffff' },
    { key: 'Denied',   label: 'Negada',   color: '#D4145A',  fg: '#ffffff' },
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
  return `hace ${days} día${days > 1 ? 's' : ''}`;
}

export default function ProposalsScreen({ navigation, route }) {
  const { colors: COLORS, isDark } = useTheme();
  const FILTERS = makeFilters(COLORS.accent);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const authRef = React.useRef(null);
  const userIdRef = React.useRef(null);
  const lastLoadRef = React.useRef(0); // throttle: evita peticiones repetidas al backend
  const [userName, setUserName] = useState('');
  const [allProposals, setAllProposals] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('updatedAt_desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leadFilter, setLeadFilter] = useState(null);
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

  const { notifications, unread, connected, liveViewing, lastViewed, markAllRead, clearAll } = useNotifications(
    auth?.token ?? null
  );

  // Cargar plantillas de mensajes personalizadas
  useEffect(() => {
    AsyncStorage.getItem('message_templates').then(val => {
      if (val) setMsgTemplates(JSON.parse(val));
    });
  }, []);

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
      load(id, authData.token, true); // carga inicial: siempre forzar
    });
  }, []);

  // Recargar al volver desde el Editor
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (authRef.current && userIdRef.current) {
        setRefreshing(true);
        load(userIdRef.current, authRef.current.token);
      }
    });
    return unsubscribe;
  }, [navigation]);

  async function load(id, token, force = false) {
    const now = Date.now();
    // Throttle: no más de 1 petición cada 20 segundos salvo que sea forzado
    if (!force && now - lastLoadRef.current < 20000) {
      setRefreshing(false);
      return;
    }
    lastLoadRef.current = now;
    try {
      const res = await getProposals(id, token);
      const raw = res.docs || res.data || (Array.isArray(res) ? res : []);
      const list = Array.isArray(raw) ? raw : [];
      const valid = list.filter((p) => ['Ready', 'Draft', 'Approved', 'Denied'].includes(p.status));
      setAllProposals(valid);
      buildSections(valid, activeFilter, activeSort);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar las propuestas: ' + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  function sortProposals(list, sort) {
    const s = [...list];
    if (sort === 'updatedAt_asc') s.sort((a, b) => new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0));
    else if (sort === 'createdAt_desc') s.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sort === 'title_asc') s.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else s.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return s;
  }

  function applyAllFilters(list, { af, rf, vf, lf, df, dfrom, dto }) {
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
      // Date range filter (aplica sobre última vista, o si no hay, sobre updatedAt)
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
  ) {
    let base = applyAllFilters(proposals, { af, rf, vf, lf, df, dfrom, dto });
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
    buildSections(allProposals, key, activeSort, leadFilter, activityFilter, ratingFilter, viewsFilter, dateFilter, dateFrom, dateTo);
  }

  function handleSort(key) {
    setActiveSort(key);
    buildSections(allProposals, activeFilter, key, leadFilter, activityFilter, ratingFilter, viewsFilter, dateFilter, dateFrom, dateTo);
  }

  function handleLeadFilter(leadId) {
    setLeadFilter(leadId);
    setLeadPickerVisible(false);
    setLeadSearch('');
    buildSections(allProposals, activeFilter, activeSort, leadId, activityFilter, ratingFilter, viewsFilter, dateFilter, dateFrom, dateTo);
  }

  function applyPanel({ sort, lf, af, rf, vf, df, dfrom, dto }) {
    setActiveSort(sort);
    setLeadFilter(lf);
    setActivityFilter(af);
    setRatingFilter(rf);
    setViewsFilter(vf);
    setDateFilter(df);
    setDateFrom(dfrom);
    setDateTo(dto);
    setFilterPanelVisible(false);
    buildSections(allProposals, activeFilter, sort, lf, af, rf, vf, df, dfrom, dto);
  }

  const activeFilterCount = [
    activityFilter !== 'all',
    ratingFilter   !== 'all',
    viewsFilter    !== 'all',
    dateFilter     !== 'all',
    leadFilter     != null,
    activeSort     !== 'updatedAt_desc',
  ].filter(Boolean).length;

  function onRefresh() {
    if (!userId || !auth) return;
    setRefreshing(true);
    load(userId, auth.token, true); // pull-to-refresh: siempre forzar
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

  // Genera la URL corta /r/{uuid} vía POST /v1/urlShort/generate
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
      : `Hola${name ? ` ${name}` : ''},\n\nEspero que te encuentres muy bien. Te compartimos nuestra propuesta comercial${title ? ` "${title}"` : ''} para tu revisión.\n\nPuedes acceder a ella en el siguiente enlace:\n${previewUrl}\n\nQuedo atento a tus comentarios y a cualquier duda que puedas tener.\n\nSaludos cordiales,`;
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
    // Limpiar número: solo dígitos, sin +, espacios ni guiones
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
      Alert.alert('Correo inválido', 'El lead no tiene un correo registrado o válido.');
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
      Alert.alert('Error', 'No se pudo abrir la aplicación de correo.')
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
    const title = item.title || item.name || 'Sin título';
    const color = STATUS_COLOR[item.status] || COLORS.textMuted;
    const propId = item.id || item._id || '';
    const isLive = !!(propId && liveViewing[propId]);
    // Última vista: primero del socket (sesión actual), luego del API (persistido)
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
        {isLive && (
          <View style={styles.liveBanner}>
            <Eye size={13} color="#fff" weight="fill" />
            <Text style={styles.liveBannerText}> Viendo ahora</Text>
          </View>
        )}
        {!isLive && lastViewTs && (
          <View style={styles.lastViewBanner}>
            <Eye size={12} color="#60A5FA" weight="fill" />
            <Text style={styles.lastViewText}> Última vista {timeAgo(lastViewTs)}</Text>
          </View>
        )}
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
          </View>
          <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '60' }]}>
            <View style={[styles.badgeDot, { backgroundColor: color }]} />
            <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[item.status] || item.status}</Text>
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
        {(TEMP_CONFIG[item.rating] || (item.views ?? item.visits ?? item.opens ?? item.timesOpened ?? item.opened) != null) && (
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
          </View>
        )}
        <View style={styles.cardFooter}>
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>Toca para editar</Text>
          </View>
          <View style={styles.cardFooterRight}>
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => openSendModal(item, 'whatsapp')}
              activeOpacity={0.7}
            >
              <Text style={styles.sendBtnText}>Enviar ↗</Text>
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
              <Text style={styles.urgentBtnText}>Llamarlo ahora</Text>
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
              <Text style={styles.emailFollowupBtnText}>Seguimiento por correo</Text>
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
              <Text style={styles.noVistaBtnText}>Sin vistas — Llamar ahora</Text>
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
              <Text style={styles.emailFollowupBtnText}>Sin vistas — Enviar correo</Text>
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
              <Text style={styles.newBtnText}>+ Nueva</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Barra de filtros fija */}
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

      {/* Botón de filtros avanzados */}
      <TouchableOpacity
        style={[styles.filterBarBtn, activeFilterCount > 0 && styles.filterBarBtnActive]}
        onPress={() => setFilterPanelVisible(true)}
        activeOpacity={0.85}
      >
        <SlidersHorizontal size={15} color={activeFilterCount > 0 ? COLORS.accentFg : COLORS.textMuted} />
        <Text style={[styles.filterBarBtnText, activeFilterCount > 0 && { color: COLORS.accentFg }]}>
          {activeFilterCount > 0 ? `Filtros activos (${activeFilterCount})` : 'Filtros avanzados'}
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => applyPanel({ sort: activeSort, lf: null, af: 'all', rf: 'all', vf: 'all', df: 'all', dfrom: '', dto: '' })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 }}>
              <X size={13} color={COLORS.accentFg} weight="bold" />
              <Text style={{ color: COLORS.accentFg, fontSize: 13, fontWeight: '700' }}>Limpiar</Text>
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
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor="transparent"
              colors={['transparent']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>—</Text>
              <Text style={styles.emptyText}>Sin propuestas</Text>
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
        initialValues={{ sort: activeSort, lf: leadFilter, af: activityFilter, rf: ratingFilter, vf: viewsFilter, df: dateFilter, dfrom: dateFrom, dto: dateTo }}
        leads={getUniqueLeads(allProposals)}
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
              {/* Opción "Todos" */}
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

              {/* ── Selector de canal ── */}
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

              {/* ── Tipo de URL ── */}
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
                      <Text style={styles.urlTypeBtnDesc}>{canClient ? 'URL corta · Con seguimiento' : 'Solo propuestas Lista'}</Text>
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
                  <Text style={[styles.urlTypeBtnTitle, sendModal.urlType === 'anonymous' && { color: COLORS.accent }]}>URL Anónima</Text>
                  <Text style={styles.urlTypeBtnDesc}>URL larga · Sin seguimiento</Text>
                </TouchableOpacity>
              </View>

              {/* ── Template según canal ── */}
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
                  <Text style={styles.waMsgHint}>Puedes editar el mensaje y la URL antes de enviar</Text>
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
                  <Text style={styles.waMsgHint}>La URL se adjunta automáticamente al final</Text>
                </>
              )}

              {sendModal.channel === 'share' && (
                <View style={styles.shareInfo}>
                  <Export size={18} color={COLORS.accent} />
                  <Text style={styles.shareInfoText}>
                    Se compartirá el mensaje con el template y el enlace de la propuesta
                  </Text>
                </View>
              )}

              {/* ── Botón enviar ── */}
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
                    // Share: usar waMsg (template + URL) — solo message para evitar duplicado en Android
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
                    {sendModal.channel === 'whatsapp' ? 'Enviar por WhatsApp' :
                     sendModal.channel === 'email'    ? 'Enviar por Correo'   :
                                                        'Compartir enlace'}
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
                  El cliente vio la propuesta hace menos de 1 hora. ¡Es el momento de contactar!
                </Text>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Phone size={20} color="#3B82F6" weight="fill" />
                  <Text style={styles.sendSheetTitle}>Sin vistas — Llamar ahora</Text>
                </View>
                <Text style={styles.sendSheetSub}>
                  Esta propuesta lleva más de una semana sin ser vista. Recuérdale al lead.
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
                  urgente: `Hola${name ? ` ${name}` : ''}, ¿qué te pareció${t ? ` "${t}"` : ' nuestra propuesta'}? Quedo atento a tus comentarios 😊\n${url}`,
                  novista: `Hola${name ? ` ${name}` : ''}, quería recordarte que tienes una propuesta disponible${t ? `: "${t}"` : ''}. ¿Tienes alguna duda? Con gusto te ayudo.\n${url}`,
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
                <Text style={[styles.seguimientoBtnText, { color: '#fff' }]}>Contactar por WhatsApp</Text>
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
                  <Text style={[styles.seguimientoBtnText, { color: '#fff' }]}>Llamar</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.sendCancelBtn, { marginTop: 10 }]}
              onPress={() => setSeguimientoModal({ ...seguimientoModal, visible: false })}
              activeOpacity={0.7}
            >
              <Text style={styles.sendCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de notificaciones */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifications(false)}
      >
        <SafeAreaView style={styles.notifSafe} edges={['top', 'bottom']}>
          <View style={styles.notifHeader}>
            <View>
              <Text style={styles.notifTitle}>Notificaciones</Text>
              {connected
                ? <Text style={styles.notifConnected}>● Conectado en tiempo real</Text>
                : <Text style={styles.notifDisconnected}>○ Sin conexión en tiempo real</Text>}
            </View>
            <View style={styles.notifHeaderRight}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={clearAll} style={styles.notifClearBtn}>
                  <Text style={styles.notifClearText}>Limpiar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.notifCloseBtn}>
                <X size={20} color={COLORS.text} weight="bold" />
              </TouchableOpacity>
            </View>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.notifEmpty}>
              <BellRinging size={48} color={COLORS.textMuted} />
              <Text style={styles.notifEmptyText}>Sin notificaciones</Text>
              <Text style={styles.notifEmptyHint}>Cuando un cliente abra una propuesta aparecerá aquí</Text>
            </View>
          ) : (
            <ScrollView style={styles.notifList} contentContainerStyle={{ paddingBottom: 32 }}>
              {notifications.map((n) => (
                <View key={n.id} style={[styles.notifItem, !n.read && styles.notifItemUnread]}>
                  <View style={styles.notifItemIcon}>
                    <Eye size={20} color={COLORS.accent} weight="fill" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifItemTitle} numberOfLines={1}>
                      {n.leadName || 'Cliente'} vio tu propuesta
                    </Text>
                    <Text style={styles.notifItemSub} numberOfLines={1}>
                      {n.proposalTitle}{n.proposalNumber ? ` · #${n.proposalNumber}` : ''}
                    </Text>
                    {n.leadEmail ? (
                      <Text style={styles.notifItemEmail} numberOfLines={1}>{n.leadEmail}</Text>
                    ) : null}
                    <Text style={styles.notifItemTime}>
                      {new Date(n.timestamp).toLocaleString('es-CO', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <BottomTabBar active="Proposals" navigation={navigation} />
    </SafeAreaView>
  );
}

// ─── Panel de filtros avanzados ───────────────────────────────────────────────
function FilterPanel({ visible, onClose, initialValues, leads, onApply }) {
  const { colors: COLORS } = useTheme();
  const [sort,  setSort]  = useState(initialValues.sort);
  const [af,    setAf]    = useState(initialValues.af);
  const [rf,    setRf]    = useState(initialValues.rf);
  const [vf,    setVf]    = useState(initialValues.vf);
  const [lf,    setLf]    = useState(initialValues.lf);
  const [df,    setDf]    = useState(initialValues.df);
  const [dfrom, setDfrom] = useState(initialValues.dfrom);
  const [dto,   setDto]   = useState(initialValues.dto);
  const [leadSearch, setLeadSearch] = useState('');

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
      setLeadSearch('');
    }
  }, [visible]);

  function clearAll() {
    setSort('updatedAt_desc'); setAf('all'); setRf('all');
    setVf('all'); setLf(null); setDf('all'); setDfrom(''); setDto('');
    setLeadSearch('');
  }

  // Chip toggle: si ya está activo, vuelve a 'all'
  function toggle(current, key, setter, reset = 'all') {
    setter(current === key ? reset : key);
  }

  const SORT_OPTS = [
    { key: 'updatedAt_desc', label: '↓ Más recientes' },
    { key: 'updatedAt_asc',  label: '↑ Más antiguas'  },
    { key: 'createdAt_desc', label: '+ Por creación'  },
    { key: 'title_asc',      label: 'A–Z Título'      },
  ];
  const ACTIVITY_OPTS = [
    { key: 'all',             label: 'Toda actividad'      },
    { key: 'viewed_today',    label: '👁 Vista hoy'         },
    { key: 'viewed_week',     label: '👁 Esta semana'       },
    { key: 'not_viewed',      label: '○ Sin vistas'         },
    { key: 'approved_viewed', label: '✓ Aprobada + vista'  },
    { key: 'ready_viewed',    label: '● Lista + vista'      },
  ];
  const RATING_OPTS = [
    { key: 'all',  label: 'Cualquiera'   },
    { key: 'Hot',  label: '🔥 Caliente'  },
    { key: 'Warm', label: '🌤 Tibia'     },
    { key: 'Cold', label: '🧊 Fría'      },
  ];
  const VIEWS_OPTS = [
    { key: 'all',        label: 'Cualquiera'   },
    { key: 'has_views',  label: '◎ Con vistas' },
    { key: 'no_views',   label: '○ Sin vistas' },
    { key: 'many_views', label: '◎◎ 5+ vistas' },
  ];
  const DATE_OPTS = [
    { key: 'all',     label: 'Cualquier fecha' },
    { key: 'today',   label: 'Hoy'             },
    { key: 'week',    label: 'Última semana'   },
    { key: 'month',   label: 'Último mes'      },
    { key: '3months', label: 'Últimos 3 meses' },
    { key: 'custom',  label: '✎ Personalizado' },
  ];

  const filteredLeads = leads.filter((l) => {
    if (!leadSearch.trim()) return true;
    const q = leadSearch.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
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
              <Text style={styles.sendSheetTitle}>Filtros avanzados</Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>Toca un filtro activo para desactivarlo</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.notifCloseBtn}>
              <X size={20} color={COLORS.text} weight="bold" />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <PanelSection title="Ordenar por">
              <ChipRow opts={SORT_OPTS} value={sort} onSelect={setSort} />
            </PanelSection>

            <PanelSection title="Actividad de vista">
              <ChipRow opts={ACTIVITY_OPTS} value={af} onSelect={setAf} />
            </PanelSection>

            <PanelSection title="Temperatura del lead">
              <ChipRow opts={RATING_OPTS} value={rf} onSelect={setRf} />
            </PanelSection>

            <PanelSection title="Contador de vistas">
              <ChipRow opts={VIEWS_OPTS} value={vf} onSelect={setVf} />
            </PanelSection>

            <PanelSection title="Rango de fecha (vista o modificación)">
              <ChipRow opts={DATE_OPTS} value={df} onSelect={setDf} />
              {df === 'custom' && (
                <View style={styles.dateRangeRow}>
                  <View style={styles.dateInputWrap}>
                    <Text style={styles.dateInputLabel}>Desde</Text>
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
                    <Text style={styles.dateInputLabel}>Hasta</Text>
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

            <PanelSection title="Lead">
              <TextInput
                style={[styles.emailSubjectInput, { marginBottom: 8 }]}
                value={leadSearch}
                onChangeText={setLeadSearch}
                placeholder="Buscar lead..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
              {[{ id: null, name: 'Todos los leads', email: '' }, ...filteredLeads].map((lead) => {
                const active = lf === lead.id;
                return (
                  <TouchableOpacity
                    key={lead.id ?? '__all__'}
                    style={[styles.panelLeadBtn, { marginBottom: 6 }, active && styles.panelLeadBtnActive]}
                    onPress={() => setLf(active && lead.id !== null ? null : lead.id)}
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
            </PanelSection>

            <TouchableOpacity
              style={styles.panelApplyBtn}
              onPress={() => onApply({ sort, lf, af, rf, vf, df, dfrom, dto })}
              activeOpacity={0.8}
            >
              <Text style={styles.panelApplyText}>Aplicar filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.panelClearBtn} onPress={clearAll} activeOpacity={0.7}>
              <Text style={styles.panelClearText}>Limpiar todo y cerrar</Text>
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
  liveBanner: {
    backgroundColor: '#39B54A18',
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  liveBannerText: {
    color: '#39B54A',
    fontSize: 12,
    fontWeight: '700',
  },
  lastViewBanner: {
    backgroundColor: '#60A5FA12',
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  lastViewText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '600',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: { color: C.text, fontWeight: '700', fontSize: 15 },
  cardLead: { color: C.textMuted, fontSize: 12, marginTop: 3 },
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
  panelLeadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.card,
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
  });
}
