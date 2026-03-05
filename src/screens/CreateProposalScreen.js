import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme';
import { checkLeadByEmail, searchLeadByEmail, createLead, createProposal } from '../api';

function genProposalNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CreateProposalScreen({ navigation, route }) {
  const { auth } = route.params;

  const [proposalNumber, setProposalNumber] = useState(() => genProposalNumber());
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [leadFound, setLeadFound] = useState(null);
  const [leadNotFound, setLeadNotFound] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleSearchLead() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSearching(true);
    setLeadFound(null);
    setLeadNotFound(false);
    try {
      // Intenta /lead/exist primero
      let lead = null;
      try {
        const res = await checkLeadByEmail(trimmed, auth.token);
        console.log('=== lead/exist response ===', JSON.stringify(res));
        // Normaliza distintas estructuras posibles
        const raw = Array.isArray(res) ? res[0] : (Array.isArray(res?.data) ? res.data[0] : (res?.data || res));
        if (raw && (raw.id || raw._id)) lead = raw;
      } catch {
        // 404 o error → sigue al fallback
      }

      // Fallback: GET /v1/lead?email=xxx
      if (!lead) {
        const res2 = await searchLeadByEmail(trimmed, auth.token);
        console.log('=== lead search response ===', JSON.stringify(res2));
        const list = Array.isArray(res2) ? res2 : (Array.isArray(res2?.data) ? res2.data : []);
        const match = list.find((l) => (l.email || '').toLowerCase() === trimmed.toLowerCase()) || list[0];
        if (match && (match.id || match._id)) lead = match;
      }

      if (lead) {
        setLeadFound(lead);
      } else {
        setLeadNotFound(true);
      }
    } catch {
      setLeadNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  function clearLead() {
    setLeadFound(null);
    setLeadNotFound(false);
    setFirstName('');
    setLastName('');
  }

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert('Título requerido', 'Ingresa un título para la propuesta.');
      return;
    }
    if (!leadFound && !leadNotFound) {
      Alert.alert('Busca un cliente', 'Ingresa un email y presiona Buscar.');
      return;
    }
    setCreating(true);
    try {
      let leadId;
      if (leadFound) {
        leadId = leadFound.id || leadFound._id;
      } else {
        if (!firstName.trim()) {
          Alert.alert('Nombre requerido', 'Ingresa el nombre del cliente.');
          setCreating(false);
          return;
        }
        const newLead = await createLead(
          { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() },
          auth.token
        );
        const created = newLead.data || newLead;
        leadId = created.id || created._id;
      }
      if (!leadId) throw new Error('No se pudo obtener el ID del cliente.');

      const res = await createProposal(
        { proposalNumber: proposalNumber.trim().toUpperCase(), title: title.trim(), relatedLead: leadId, numberOfPayments: 1 },
        auth.token
      );
      const proposal = res.data || res;
      navigation.replace('Editor', { proposal, auth });
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo crear la propuesta.');
    } finally {
      setCreating(false);
    }
  }

  const canCreate =
    proposalNumber.trim().length > 0 &&
    title.trim().length > 0 &&
    (leadFound != null || (leadNotFound && firstName.trim().length > 0));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva propuesta</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Número de propuesta */}
        <Text style={styles.label}>Número de propuesta</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: BS4H3M"
          placeholderTextColor={COLORS.textMuted}
          value={proposalNumber}
          onChangeText={(v) => setProposalNumber(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={10}
          returnKeyType="next"
          autoFocus
        />

        {/* Título */}
        <Text style={styles.label}>Título</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Propuesta pintura vial 2025"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
        />

        {/* Lead */}
        <Text style={styles.label}>Cliente (Lead)</Text>

        {!leadFound && !leadNotFound && (
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Email del cliente"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={handleSearchLead}
            />
            <TouchableOpacity
              style={[styles.searchBtn, (!email.trim() || searching) && { opacity: 0.5 }]}
              onPress={handleSearchLead}
              disabled={searching || !email.trim()}
              activeOpacity={0.7}
            >
              {searching
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.searchBtnText}>Buscar</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {leadFound && (
          <View style={styles.leadCard}>
            <View style={styles.leadInfo}>
              <Text style={styles.leadBadge}>✓ Encontrado</Text>
              <Text style={styles.leadName}>
                {[leadFound.firstName, leadFound.lastName].filter(Boolean).join(' ') ||
                  leadFound.name || 'Sin nombre'}
              </Text>
              <Text style={styles.leadEmail}>{leadFound.email || email}</Text>
            </View>
            <TouchableOpacity onPress={clearLead} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Cambiar</Text>
            </TouchableOpacity>
          </View>
        )}

        {leadNotFound && (
          <View>
            <View style={styles.notFoundBox}>
              <Text style={styles.notFoundText}>No existe cliente con ese email.</Text>
              <Text style={styles.notFoundEmail}>{email}</Text>
              <TouchableOpacity onPress={clearLead}>
                <Text style={styles.retryText}>Buscar otro email</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Crear cliente nuevo</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre *"
              placeholderTextColor={COLORS.textMuted}
              value={firstName}
              onChangeText={setFirstName}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Apellido"
              placeholderTextColor={COLORS.textMuted}
              value={lastName}
              onChangeText={setLastName}
              returnKeyType="done"
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.createBtn, (!canCreate || creating) && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={!canCreate || creating}
          activeOpacity={0.8}
        >
          {creating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.createBtnText}>Crear propuesta →</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  backText: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  headerTitle: { color: COLORS.text, fontWeight: '700', fontSize: 18 },
  scroll: { padding: 20, paddingBottom: 48 },
  label: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 24, marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.card, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBtn: {
    backgroundColor: COLORS.accent, borderRadius: 10,
    paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', minWidth: 80,
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  leadCard: {
    backgroundColor: COLORS.card, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.success + '60',
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  leadInfo: { flex: 1 },
  leadBadge: {
    color: COLORS.success, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4,
  },
  leadName: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  leadEmail: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  changeBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  changeBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  notFoundBox: {
    backgroundColor: COLORS.card, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 16,
  },
  notFoundText: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
  notFoundEmail: { color: COLORS.text, fontWeight: '600', fontSize: 14, marginBottom: 10 },
  retryText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  createBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12,
    padding: 18, alignItems: 'center', marginTop: 36,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
