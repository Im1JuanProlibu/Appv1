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
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Lee auth desde AsyncStorage — no depende de params
    AsyncStorage.getItem('auth').then((val) => {
      if (!val) { navigation.replace('Login'); return; }
      const authData = JSON.parse(val);
      const user = authData.user || {};
      const id = authData.userId || user._id || user.id || user.userId || user.agentId || '';
      const name = user.firstName || user.name || user.email || 'Mi cuenta';

      if (!id) {
        Alert.alert(
          'Sin ID de usuario',
          'No se pudo obtener tu ID. Revisa la consola (console.log del login).',
        );
        console.log('Auth guardada:', JSON.stringify(authData));
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
      const raw = res.data || res || [];
      const list = Array.isArray(raw) ? raw : [];

      const filtered = list.filter((p) =>
        ['Ready', 'Draft', 'Approved', 'Denied'].includes(p.status)
      );
      filtered.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

      const secs = [];
      for (const st of ['Ready', 'Draft', 'Approved', 'Denied']) {
        const group = filtered.filter((p) => p.status === st);
        if (group.length) secs.push({ title: st, data: group });
      }
      setSections(secs);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar las propuestas: ' + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
          {item.currency ? <Text style={styles.metaItem}>{item.currency}</Text> : null}
        </View>
        <Text style={styles.cardArrow}>Editar →</Text>
      </TouchableOpacity>
    );
  }

  function renderSectionHeader({ section }) {
    const color = STATUS_COLOR[section.title];
    return (
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={[styles.sectionTitle, { color }]}>{STATUS_LABEL[section.title] || section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>
    );
  }

  const totalCount = sections.reduce((acc, s) => acc + s.data.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

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
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Sin propuestas</Text>
              <Text style={styles.emptyHint}>Desliza hacia abajo para recargar</Text>
            </View>
          }
        />
      )}

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
  countText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutText: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },
  loader: { marginTop: 60 },
  list: { padding: 16 },
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
  emptyHint: { color: COLORS.textMuted, fontSize: 13 },
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
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', lineHeight: 34 },
});
