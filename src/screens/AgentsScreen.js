import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import { getAgents } from '../api';
import { Check, ArrowRight } from 'phosphor-react-native';

export default function AgentsScreen({ navigation }) {
  const [agents, setAgents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('auth').then((val) => {
      if (!val) {
        navigation.replace('Login');
        return;
      }
      const authData = JSON.parse(val);
      setAuth(authData);
      load(authData);
    });
  }, []);

  async function load(authData) {
    try {
      const res = await getAgents();
      const raw = res.data || res || [];
      const list = (Array.isArray(raw) ? raw : []).map((a) => ({
        id: a.id || a._id,
        email: a.email || '',
        name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email,
        initials: (a.firstName?.[0] || a.email?.[0] || '?').toUpperCase(),
      }));
      setAgents(list);
      setFiltered(list);

      // Auto-select if logged user is an agent
      const userEmail = authData.user?.email;
      if (userEmail) {
        const match = list.find((a) => a.email === userEmail);
        if (match) setSelected(match);
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar los asesores: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      agents.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q)
      )
    );
  }, [search, agents]);

  async function handleLogout() {
    await AsyncStorage.removeItem('auth');
    navigation.replace('Login');
  }

  function handleNext() {
    if (!selected) {
      Alert.alert('Selecciona un asesor', 'Toca un asesor de la lista para continuar.');
      return;
    }
    navigation.navigate('Proposals', { agent: selected, auth });
  }

  function renderAgent({ item }) {
    const isSelected = selected?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => setSelected(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
          <Text style={styles.avatarText}>{item.initials}</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemEmail}>{item.email}</Text>
        </View>
        {isSelected && (
          <View style={styles.check}>
            <Check size={14} color="#fff" weight="bold" />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Asesores</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {auth?.user?.email}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={styles.search}
        placeholder="Buscar por nombre o email..."
        placeholderTextColor={COLORS.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {/* List */}
      {loading ? (
        <ActivityIndicator color={COLORS.accent} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={renderAgent}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search ? 'Sin resultados para "' + search + '"' : 'No hay asesores disponibles'}
            </Text>
          }
        />
      )}

      {/* Footer CTA */}
      <View style={styles.footer}>
        {selected ? (
          <View style={styles.footerSelected}>
            <View style={styles.footerAvatarSmall}>
              <Text style={styles.avatarText}>{selected.initials}</Text>
            </View>
            <Text style={styles.footerName} numberOfLines={1}>
              {selected.name}
            </Text>
          </View>
        ) : (
          <Text style={styles.footerHint}>Selecciona un asesor para continuar</Text>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, !selected && styles.nextBtnDisabled]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.nextText}>Ver propuestas</Text>
            <ArrowRight size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerInfo: { flex: 1, marginRight: 12 },
  headerTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutText: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },
  search: {
    margin: 16,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
  },
  loader: { marginTop: 60 },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8,
  },
  itemSelected: { borderColor: COLORS.accent, backgroundColor: '#1a0e08' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSelected: { backgroundColor: COLORS.accent },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  itemInfo: { flex: 1 },
  itemName: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
  itemEmail: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 60, fontSize: 14 },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  footerSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  footerAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerName: { color: COLORS.text, fontWeight: '600', flex: 1 },
  footerHint: { color: COLORS.textMuted, fontSize: 13, marginBottom: 12 },
  nextBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
