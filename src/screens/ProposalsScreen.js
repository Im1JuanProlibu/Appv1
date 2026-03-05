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
import { COLORS } from '../theme';
import { getProposals } from '../api';

const STATUS_COLOR = {
  Ready: COLORS.ready,
  Draft: COLORS.draft,
  Approved: COLORS.sent,
  Denied: COLORS.denied,
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

const FILTERS = [
  { key: 'all',      label: 'Todas',    color: COLORS.accent, fg: COLORS.accentFg },
  { key: 'Draft',    label: 'Borrador', color: COLORS.draft,  fg: '#000000' },
  { key: 'Ready',    label: 'Lista',    color: COLORS.ready,  fg: '#ffffff' },
  { key: 'Approved', label: 'Aprobada', color: COLORS.sent,   fg: '#ffffff' },
  { key: 'Denied',   label: 'Negada',   color: COLORS.denied, fg: '#ffffff' },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProposalsScreen({ navigation, route }) {
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const authRef = React.useRef(null);
  const userIdRef = React.useRef(null);
  const [userName, setUserName] = useState('');
  const [allProposals, setAllProposals] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSort, setActiveSort] = useState('updatedAt_desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leadFilter, setLeadFilter] = useState(null);   // null = todos
  const [leadPickerVisible, setLeadPickerVisible] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [sendModal, setSendModal] = useState({
    visible: false, proposal: null, urlType: 'client',
    channel: 'whatsapp',
    waMsg: '', emailSubject: '', emailMsg: '',
  });

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
      load(id, authData.token);
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

  async function load(id, token) {
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

  function buildSections(proposals, filter, sort = activeSort, lf = leadFilter) {
    let base = lf
      ? proposals.filter((p) => {
          const lead = p.relatedLead;
          if (typeof lead !== 'object' || !lead) return false;
          return (lead._id || lead.id) === lf;
        })
      : proposals;
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
    buildSections(allProposals, key, activeSort, leadFilter);
  }

  function handleSort(key) {
    setActiveSort(key);
    buildSections(allProposals, activeFilter, key, leadFilter);
  }

  function handleLeadFilter(leadId) {
    setLeadFilter(leadId);
    setLeadPickerVisible(false);
    setLeadSearch('');
    buildSections(allProposals, activeFilter, activeSort, leadId);
  }

  function onRefresh() {
    if (!userId || !auth) return;
    setRefreshing(true);
    load(userId, auth.token);
  }

  async function handleLogout() {
    await AsyncStorage.removeItem('auth');
    navigation.replace('Login');
  }

  function buildProposalUrl(proposal, urlType) {
    const id = proposal.id || proposal._id;
    const base = `https://customer-design.prolibu.com/v1/document/proposal/${id}/full`;
    if (urlType === 'anonymous') {
      const rand = Math.floor(Math.random() * 9999999);
      return `${base}?source=none&rand=${rand}`;
    }
    const lead = proposal.relatedLead;
    const email = (typeof lead === 'object' ? lead?.email : null) || '';
    return `${base}?source=${encodeURIComponent(email)}`;
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

  function handleWhatsApp(proposal, urlType, template) {
    const url = buildProposalUrl(proposal, urlType);
    const fullText = template ? `${template}\n${url}` : url;
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

  function handleEmail(proposal, urlType, subjectTpl, bodyTpl) {
    const url = buildProposalUrl(proposal, urlType);
    const to = getLeadEmail(proposal);

    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to)) {
      Alert.alert('Correo inválido', 'El lead no tiene un correo registrado o válido.');
      return;
    }

    const fullBody = bodyTpl ? `${bodyTpl}\n${url}` : url;
    const encodedSubject = encodeURIComponent(subjectTpl || proposal.title || proposal.name || 'Propuesta');
    const encodedBody = encodeURIComponent(fullBody);
    const mailtoUrl = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;

    // Detección inteligente: Gmail / Outlook / genérico
    const domain = (to.split('@')[1] || '').toLowerCase();
    if (domain === 'gmail.com') {
      const gmailUrl = `googlegmail://co?to=${encodeURIComponent(to)}&subject=${encodedSubject}&body=${encodedBody}`;
      Linking.canOpenURL(gmailUrl).then((supported) => {
        Linking.openURL(supported ? gmailUrl : mailtoUrl).catch(() =>
          Linking.openURL(mailtoUrl).catch(() =>
            Alert.alert('Error', 'No se pudo abrir Gmail.')
          )
        );
      });
    } else if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'microsoft.com'].includes(domain)) {
      const outlookUrl = `ms-outlook://compose?to=${encodeURIComponent(to)}&subject=${encodedSubject}&body=${encodedBody}`;
      Linking.canOpenURL(outlookUrl).then((supported) => {
        Linking.openURL(supported ? outlookUrl : mailtoUrl).catch(() =>
          Linking.openURL(mailtoUrl).catch(() =>
            Alert.alert('Error', 'No se pudo abrir Outlook.')
          )
        );
      });
    } else {
      Linking.openURL(mailtoUrl).catch(() =>
        Alert.alert('Error', 'No se pudo abrir la aplicación de correo.')
      );
    }
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
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Editor', { proposal: item, auth })}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
          <View style={[styles.badge, { backgroundColor: color + '25', borderColor: color }]}>
            <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[item.status] || item.status}</Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          {item.number ? <Text style={styles.metaItem}>#{item.number}</Text> : null}
          {item.updatedAt ? <Text style={styles.metaItem}>{formatDate(item.updatedAt)}</Text> : null}
          {item.currency ? <Text style={styles.metaItem}>{typeof item.currency === 'object' ? item.currency.code : item.currency}</Text> : null}
          {TEMP_CONFIG[item.rating] && (
            <View style={[styles.tempBadge, { borderColor: TEMP_CONFIG[item.rating].color }]}>
              <Text style={[styles.tempText, { color: TEMP_CONFIG[item.rating].color }]}>
                {TEMP_CONFIG[item.rating].label}
              </Text>
            </View>
          )}
          {(() => {
            const v = item.views ?? item.visits ?? item.opens ?? item.timesOpened ?? item.opened ?? null;
            if (v == null) return null;
            return (
              <View style={styles.viewsBadge}>
                <Text style={styles.viewsText}>◎ {v}</Text>
              </View>
            );
          })()}
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardArrow}>Editar →</Text>
          <View style={styles.cardFooterRight}>
            {getLeadPhone(item) ? (
              <TouchableOpacity
                style={styles.phoneBtn}
                onPress={() => Linking.openURL(`tel:${getLeadPhone(item)}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.phoneBtnIcon}>✆</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => {
                const lead = item.relatedLead;
                const name = typeof lead === 'object' ? (lead?.firstName || lead?.name || '') : '';
                const title = item.title || item.name || '';
                const waMsg = `${name ? `Hola ${name},` : 'Hola,'} te comparto nuestra propuesta comercial${title ? ` *"${title}"*` : ''}.\n\nPuedes revisarla en el siguiente enlace:`;
                const emailSubject = `Propuesta comercial${title ? `: ${title}` : ''}`;
                const emailMsg = `Hola${name ? ` ${name}` : ''},\n\nEspero que te encuentres muy bien. Te compartimos nuestra propuesta comercial${title ? ` "${title}"` : ''} para tu revisión.\n\nPuedes acceder a ella en el siguiente enlace:\n\nQuedo atento a tus comentarios y a cualquier duda que puedas tener.\n\nSaludos cordiales,`;
                setSendModal({ visible: true, proposal: item, urlType: 'client', channel: 'whatsapp', waMsg, emailSubject, emailMsg });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.sendBtnText}>Enviar ↗</Text>
            </TouchableOpacity>
          </View>
        </View>
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Mis propuestas</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{userName}</Text>
        </View>
        <View style={styles.headerRight}>
          {!loading && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalCount}</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
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

      {/* Barra de ordenamiento + filtro de lead */}
      <View style={styles.sortBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
          {SORT_OPTIONS.map((s) => {
            const active = activeSort === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => handleSort(s.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
          {/* Separador */}
          <View style={styles.sortSep} />
          {/* Chip de lead */}
          <TouchableOpacity
            style={[styles.sortChip, leadFilter && styles.sortChipActive]}
            onPress={() => setLeadPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortChipText, leadFilter && styles.sortChipTextActive]}>
              {leadFilter
                ? `◈ ${getUniqueLeads(allProposals).find((l) => l.id === leadFilter)?.name || 'Lead'}`
                : '◈ Lead'}
            </Text>
            {leadFilter && (
              <TouchableOpacity
                onPress={() => handleLeadFilter(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: COLORS.accent, fontSize: 12, marginLeft: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.accent} size="large" style={styles.loader} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id || item._id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
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
      )}

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
                  { key: 'whatsapp', icon: '◉', label: 'WhatsApp',  color: '#25D366' },
                  { key: 'email',    icon: '✉', label: 'Correo',    color: '#4A90E2' },
                  { key: 'share',    icon: '↑', label: 'Compartir', color: COLORS.accent },
                ].map((ch) => {
                  const active = sendModal.channel === ch.key;
                  return (
                    <TouchableOpacity
                      key={ch.key}
                      style={[styles.channelBtn, active && { borderColor: ch.color, backgroundColor: ch.color + '18' }]}
                      onPress={() => setSendModal({ ...sendModal, channel: ch.key })}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.channelBtnIcon}>{ch.icon}</Text>
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
                <TouchableOpacity
                  style={[styles.urlTypeBtn, sendModal.urlType === 'client' && styles.urlTypeBtnActive]}
                  onPress={() => setSendModal({ ...sendModal, urlType: 'client' })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.urlTypeBtnTitle, sendModal.urlType === 'client' && { color: COLORS.accent }]}>URL Cliente</Text>
                  <Text style={styles.urlTypeBtnDesc}>Contabiliza vistas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.urlTypeBtn, sendModal.urlType === 'anonymous' && styles.urlTypeBtnActive]}
                  onPress={() => setSendModal({ ...sendModal, urlType: 'anonymous' })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.urlTypeBtnTitle, sendModal.urlType === 'anonymous' && { color: COLORS.accent }]}>URL Anónima</Text>
                  <Text style={styles.urlTypeBtnDesc}>Sin seguimiento</Text>
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
                  <Text style={styles.waMsgHint}>La URL se adjunta automáticamente al final</Text>
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
                  <Text style={styles.shareInfoIcon}>↑</Text>
                  <Text style={styles.shareInfoText}>
                    Se abrirá el menú de compartir del sistema con el enlace de la propuesta
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
                    handleWhatsApp(sendModal.proposal, sendModal.urlType, sendModal.waMsg);
                    setSendModal({ ...sendModal, visible: false });
                  } else if (sendModal.channel === 'email') {
                    handleEmail(sendModal.proposal, sendModal.urlType, sendModal.emailSubject, sendModal.emailMsg);
                    setSendModal({ ...sendModal, visible: false });
                  } else {
                    // Share: mantener modal visible, abrir sheet encima, cerrar después
                    const url = buildProposalUrl(sendModal.proposal, sendModal.urlType);
                    try {
                      await Share.share({
                        message: url,
                        url,
                        title: sendModal.proposal?.title || sendModal.proposal?.name || 'Propuesta',
                      });
                    } catch {}
                    setSendModal({ ...sendModal, visible: false });
                  }
                }}
              >
                <Text style={styles.sendConfirmText}>
                  {sendModal.channel === 'whatsapp' ? '◉  Enviar por WhatsApp' :
                   sendModal.channel === 'email'    ? '✉  Enviar por Correo'   :
                                                      '↑  Compartir enlace'}
                </Text>
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

      {/* FAB — nueva propuesta */}
      {auth && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateProposal', { auth })}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerInfo: { flex: 1, marginRight: 12 },
  headerTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { color: COLORS.accentFg, fontWeight: '700', fontSize: 13 },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutText: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },

  // Barra de filtros
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  filterChipText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterBadgeText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },

  loader: { marginTop: 60 },
  list: { padding: 16, paddingBottom: 100 },
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
    color: COLORS.textMuted,
    fontSize: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: { color: COLORS.text, fontWeight: '600', fontSize: 15, flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  metaItem: { color: COLORS.textMuted, fontSize: 12 },
  cardArrow: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  sortBar: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  sortChipActive: {
    backgroundColor: COLORS.accent + '20',
    borderColor: COLORS.accent,
  },
  sortChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  sortChipTextActive: { color: COLORS.accent },
  sortSep: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4, alignSelf: 'stretch' },
  leadPickerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  leadPickerItemActive: { backgroundColor: COLORS.accent + '10' },
  leadPickerName: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  leadPickerEmail: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  leadPickerCount: {
    backgroundColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8,
  },
  leadPickerCountText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  tempBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tempText: { fontSize: 10, fontWeight: '700' },
  viewsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  viewsText: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  phoneBtnIcon: { fontSize: 15, color: COLORS.textMuted },
  sendBtn: {
    backgroundColor: COLORS.accent + '20', borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  sendBtnText: { color: COLORS.accent, fontSize: 12, fontWeight: '700' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sendSheet: {
    backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sendSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20,
  },
  sendSheetTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sendSheetSub: { color: COLORS.textMuted, fontSize: 13, marginBottom: 20 },
  sendSheetLabel: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 16,
  },
  urlTypeRow: { flexDirection: 'row', gap: 10 },
  urlTypeBtn: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.card, padding: 14,
  },
  urlTypeBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '15' },
  urlTypeBtnTitle: { color: COLORS.text, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  urlTypeBtnDesc: { color: COLORS.textMuted, fontSize: 11 },
  waMsgInput: {
    backgroundColor: COLORS.card, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },
  emailSubjectInput: {
    backgroundColor: COLORS.card, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 14,
  },
  waMsgHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 4, marginBottom: 4 },
  channelRow: { flexDirection: 'row', gap: 8 },
  channelBtn: {
    flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.card, paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  channelBtnIcon: { fontSize: 20, color: COLORS.textMuted },
  channelBtnLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  shareInfo: {
    marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.card, padding: 16, alignItems: 'center', gap: 8,
  },
  shareInfoIcon: { fontSize: 28, color: COLORS.text },
  shareInfoText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
  sendConfirmBtn: {
    marginTop: 20, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  sendConfirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sendCancelBtn: {
    marginTop: 20, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  sendCancelText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { color: COLORS.accentFg, fontSize: 30, fontWeight: '300', lineHeight: 34 },
});
