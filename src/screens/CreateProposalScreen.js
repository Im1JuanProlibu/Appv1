import React, { useState, useEffect } from 'react';
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
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme';
import { checkLeadByEmail, searchLeadByEmail, createLead, createProposal, getProducts, getCurrencies, searchCurrencies } from '../api';

const COUNTRY_CODES = [
  { code: '+57',  flag: '🇨🇴', name: 'CO' },
  { code: '+1',   flag: '🇺🇸', name: 'US' },
  { code: '+52',  flag: '🇲🇽', name: 'MX' },
  { code: '+54',  flag: '🇦🇷', name: 'AR' },
  { code: '+56',  flag: '🇨🇱', name: 'CL' },
  { code: '+51',  flag: '🇵🇪', name: 'PE' },
  { code: '+55',  flag: '🇧🇷', name: 'BR' },
  { code: '+58',  flag: '🇻🇪', name: 'VE' },
  { code: '+593', flag: '🇪🇨', name: 'EC' },
  { code: '+34',  flag: '🇪🇸', name: 'ES' },
];

function genProposalNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CreateProposalScreen({ navigation, route }) {
  const { auth } = route.params;

  const [proposalNumber, setProposalNumber] = useState(() => genProposalNumber());
  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [currencies, setCurrencies] = useState([]);
  const [currencySearch, setCurrencySearch] = useState('COP');
  const [currencySuggestions, setCurrencySuggestions] = useState([]);
  const [currencySearching, setCurrencySearching] = useState(false);

  // Lead
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [leadFound, setLeadFound] = useState(null);
  const [leadNotFound, setLeadNotFound] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [countryCode, setCountryCode] = useState('+57');
  const [phone, setPhone] = useState('');

  // Products
  const [products, setProducts] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [addQty, setAddQty] = useState('1');

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setCatalogLoading(true);
    Promise.all([
      getProducts(auth.token).then((res) => {
        const raw = Array.isArray(res) ? res : (res.docs || res.data || res.records || []);
        const all = Array.isArray(raw) ? raw : [];
        setCatalog(all.filter((p) => !p.disabled));
      }).catch(() => {}),
      getCurrencies(auth.token).then((res) => {
        const raw = Array.isArray(res) ? res : (res.data || res.docs || res.records || []);
        const list = Array.isArray(raw) ? raw.filter((c) => c && c.code) : [];
        if (list.length > 0) setCurrencies(list);
      }).catch(() => {}),
    ]).finally(() => setCatalogLoading(false));
  }, []);

  async function handleSearchLead() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSearching(true);
    setLeadFound(null);
    setLeadNotFound(false);
    try {
      let lead = null;
      try {
        const res = await checkLeadByEmail(trimmed, auth.token);
        const raw = Array.isArray(res) ? res[0] : (Array.isArray(res?.data) ? res.data[0] : (res?.data || res));
        if (raw && (raw.id || raw._id)) lead = raw;
      } catch {}
      if (!lead) {
        const res2 = await searchLeadByEmail(trimmed, auth.token);
        const list = Array.isArray(res2) ? res2 : (Array.isArray(res2?.data) ? res2.data : []);
        const match = list.find((l) => (l.email || '').toLowerCase() === trimmed.toLowerCase()) || list[0];
        if (match && (match.id || match._id)) lead = match;
      }
      lead ? setLeadFound(lead) : setLeadNotFound(true);
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
    setPhone('');
  }

  function addFromCatalog() {
    if (!selectedItem) return;
    const itemId = selectedItem.sku || selectedItem.id || selectedItem._id;
    const qty = Math.max(1, parseInt(addQty) || 1);
    setProducts((prev) => {
      const idx = prev.findIndex((p) => (p.sku || p.id) === itemId);
      if (idx >= 0) {
        return prev.map((p, i) => i === idx ? { ...p, quantity: (p.quantity || 1) + qty } : p);
      }
      return [...prev, { id: itemId, name: selectedItem.name, quantity: qty, discountRate: 0, product: selectedItem }];
    });
    setSelectedItem(null);
    setAddQty('1');
    setShowCatalog(false);
  }

  function removeProduct(index) {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  function setQty(index, val) {
    const n = Math.max(1, parseInt(val) || 1);
    setProducts((prev) => prev.map((p, i) => i === index ? { ...p, quantity: n } : p));
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
        const cleanPhone = phone.trim().replace(/\D/g, '');
        const leadData = { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() };
        if (cleanPhone) leadData.phone = countryCode + cleanPhone;
        const newLead = await createLead(leadData, auth.token);
        const created = newLead.data || newLead;
        leadId = created.id || created._id;
      }
      if (!leadId) throw new Error('No se pudo obtener el ID del cliente.');

      const productList = products.map((p) => {
        const entry = {
          id: p.id || p._id,
          quantity: p.quantity || 1,
          discountRate: p.discountRate || 0,
        };
        if (p.name) entry.name = p.name;
        if (p.price != null) entry.price = p.price;
        return entry;
      });

      const res = await createProposal(
        {
          proposalNumber: proposalNumber.trim().toUpperCase(),
          title: title.trim(),
          relatedLead: leadId,
          numberOfPayments: 1,
          currency,
          products: productList,
        },
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

  // Resumen
  const summary = products.reduce((acc, p) => {
    const price = parseFloat(p.product?.price ?? p.product?.value ?? p.product?.unitPrice ?? p.price ?? 0) || 0;
    const qty = p.quantity || 1;
    const taxRate = parseFloat(p.product?.taxRate ?? p.product?.tax ?? 0) || 0;
    const lineGross = price * qty;
    const discountAmt = (lineGross * (p.discountRate || 0)) / 100;
    const lineNet = lineGross - discountAmt;
    const taxAmt = (lineNet * taxRate) / 100;
    return {
      subtotal: acc.subtotal + lineGross,
      discount: acc.discount + discountAmt,
      tax: acc.tax + taxAmt,
      total: acc.total + lineNet + taxAmt,
    };
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 });

  const filteredCatalog = catalog.filter((p) =>
    (p.name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const canCreate =
    proposalNumber.trim().length > 0 &&
    title.trim().length > 0 &&
    (leadFound != null || (leadNotFound && firstName.trim().length > 0));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva propuesta</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Número */}
        <Text style={styles.label}>Número de propuesta</Text>
        <TextInput
          style={styles.input}
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

        {/* Moneda */}
        <Text style={styles.label}>Moneda</Text>
        <View style={styles.currencySearchWrap}>
          <TextInput
            style={styles.currencyInput}
            placeholder="Buscar moneda (ej: COP, USD...)"
            placeholderTextColor={COLORS.textMuted}
            value={currencySearch}
            autoCapitalize="characters"
            onChangeText={async (text) => {
              setCurrencySearch(text);
              if (text.length < 1) { setCurrencySuggestions([]); return; }
              setCurrencySearching(true);
              try {
                const res = await searchCurrencies(text, auth.token);
                const raw = Array.isArray(res) ? res : (res.data || res.docs || res.records || []);
                setCurrencySuggestions(Array.isArray(raw) ? raw.filter((c) => c && c.code) : []);
              } catch { setCurrencySuggestions([]); } finally { setCurrencySearching(false); }
            }}
          />
          {currencySearching && <ActivityIndicator size="small" color={COLORS.accent} style={styles.currencySpinner} />}
          {currency ? (
            <View style={styles.currencyChip}>
              <Text style={styles.currencyChipText}>{currency}</Text>
            </View>
          ) : null}
        </View>
        {currencySuggestions.length > 0 && (
          <View style={styles.currencyDropdown}>
            {currencySuggestions.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={styles.currencyDropdownItem}
                onPress={() => { setCurrency(c.code); setCurrencySearch(c.code); setCurrencySuggestions([]); }}
                activeOpacity={0.7}
              >
                <Text style={styles.currencyDropdownCode}>{c.code}</Text>
                {c.name ? <Text style={styles.currencyDropdownName}>{c.name}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Cliente */}
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
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Buscar</Text>}
            </TouchableOpacity>
          </View>
        )}
        {leadFound && (
          <View style={styles.leadCard}>
            <View style={styles.leadInfo}>
              <Text style={styles.leadBadge}>✓ Encontrado</Text>
              <Text style={styles.leadName}>
                {[leadFound.firstName, leadFound.lastName].filter(Boolean).join(' ') || leadFound.name || 'Sin nombre'}
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
              <TouchableOpacity onPress={clearLead}><Text style={styles.retryText}>Buscar otro email</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>Crear cliente nuevo</Text>
            <TextInput style={styles.input} placeholder="Nombre *" placeholderTextColor={COLORS.textMuted} value={firstName} onChangeText={setFirstName} returnKeyType="next" />
            <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Apellido" placeholderTextColor={COLORS.textMuted} value={lastName} onChangeText={setLastName} returnKeyType="next" />
            <Text style={[styles.label, { marginTop: 16 }]}>Celular (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryRow}>
              {COUNTRY_CODES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.countryChip, countryCode === c.code && styles.countryChipActive]}
                  onPress={() => setCountryCode(c.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryChipText}>{c.flag} {c.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Número de celular"
              placeholderTextColor={COLORS.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="done"
            />
          </View>
        )}

        {/* Productos */}
        <View style={styles.sectionRow}>
          <Text style={styles.label}>Productos</Text>
          {products.length > 0 && <Text style={styles.sectionCount}>{products.length}</Text>}
        </View>

        {products.map((p, i) => {
          const price = parseFloat(p.product?.price ?? p.product?.value ?? p.product?.unitPrice ?? p.price ?? 0) || 0;
          const taxRate = parseFloat(p.product?.taxRate ?? p.product?.tax ?? 0) || 0;
          const qty = p.quantity || 1;
          const lineGross = price * qty;
          const taxAmt = taxRate > 0 ? (lineGross * taxRate) / 100 : 0;
          const subtotal = lineGross + taxAmt;
          return (
            <View key={i} style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={2}>{p.product?.name || p.name}</Text>
                  {(p.product?.sku || p.sku) ? <Text style={styles.productSku} numberOfLines={1}>SKU: {p.product?.sku || p.sku}</Text> : null}
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(i)}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.productPrice}>
                $ {price.toLocaleString('es-CO')} c/u · {currency}{taxRate > 0 ? `  ·  IVA ${taxRate}%` : ''}
              </Text>
              <View style={styles.productRow}>
                <Text style={styles.fieldLabel}>Cantidad</Text>
                <View style={styles.qtyPill}>
                  <TouchableOpacity style={styles.qtyPillBtn} onPress={() => setQty(i, qty - 1)}>
                    <Text style={styles.qtyPillBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.qtyPillInput}
                    value={String(qty)}
                    onChangeText={(v) => setQty(i, v)}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <TouchableOpacity style={styles.qtyPillBtn} onPress={() => setQty(i, qty + 1)}>
                    <Text style={styles.qtyPillBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>{taxRate > 0 ? `Neto + IVA ${taxRate}%` : 'Subtotal'}</Text>
                <Text style={styles.subtotalValue}>$ {subtotal.toLocaleString('es-CO')}</Text>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.addCatalogBtn}
          onPress={() => { setCatalogSearch(''); setSelectedItem(null); setShowCatalog(true); }}
          activeOpacity={0.7}
        >
          {catalogLoading
            ? <ActivityIndicator color={COLORS.accent} size="small" />
            : <Text style={styles.addCatalogBtnText}>+ Agregar del catálogo</Text>
          }
        </TouchableOpacity>

        {/* Total */}
        {products.length > 0 && (
          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalVal}>$ {summary.subtotal.toLocaleString('es-CO')}</Text>
            </View>
            {summary.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Descuento</Text>
                <Text style={[styles.totalVal, { color: COLORS.success }]}>− $ {summary.discount.toLocaleString('es-CO')}</Text>
              </View>
            )}
            {summary.tax > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Impuestos</Text>
                <Text style={styles.totalVal}>$ {summary.tax.toLocaleString('es-CO')}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.totalFinal]}>
              <Text style={styles.totalFinalLabel}>Total · {currency}</Text>
              <Text style={styles.totalFinalVal}>$ {summary.total.toLocaleString('es-CO')}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.createBtn, (!canCreate || creating) && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={!canCreate || creating}
          activeOpacity={0.8}
        >
          {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Crear propuesta →</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Catalog Modal */}
      <Modal visible={showCatalog} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCatalog(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Catálogo de productos</Text>
            <TouchableOpacity onPress={() => setShowCatalog(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.modalSearch}
            placeholder="Buscar por nombre o SKU..."
            placeholderTextColor={COLORS.textMuted}
            value={catalogSearch}
            onChangeText={setCatalogSearch}
            autoFocus
          />
          <FlatList
            data={filteredCatalog}
            keyExtractor={(p) => p.id || p._id || p.sku}
            renderItem={({ item }) => {
              const itemId = item.id || item._id;
              const active = (selectedItem?.id || selectedItem?._id) === itemId;
              const taxRate = parseFloat(item.taxRate ?? item.tax ?? 0);
              return (
                <TouchableOpacity
                  style={[styles.catalogItem, active && styles.catalogItemActive]}
                  onPress={() => setSelectedItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.catalogItemInfo}>
                    <Text style={styles.catalogItemName} numberOfLines={2}>{item.name}</Text>
                    {item.sku ? <Text style={styles.catalogItemSku}>SKU: {item.sku}</Text> : null}
                    <Text style={styles.catalogItemSku}>
                      $ {(item.price || 0).toLocaleString('es-CO')} · {item.currency || currency}{taxRate > 0 ? ` · IVA ${taxRate}%` : ''}
                    </Text>
                  </View>
                  {active && <Text style={styles.catalogCheck}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.catalogEmpty}>
                {catalog.length === 0 ? 'Catálogo no disponible' : 'Sin resultados'}
              </Text>
            }
          />
          {selectedItem && (
            <View style={styles.modalFooter}>
              <Text style={styles.modalSelectedText} numberOfLines={1}>{selectedItem.name}</Text>
              <View style={styles.modalQtyRow}>
                <Text style={styles.modalQtyLabel}>Cantidad:</Text>
                <TextInput
                  style={styles.modalQtyInput}
                  value={addQty}
                  onChangeText={setAddQty}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
                <TouchableOpacity style={styles.modalAddBtn} onPress={addFromCatalog} activeOpacity={0.8}>
                  <Text style={styles.modalAddBtnText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12,
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
  currencySearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyInput: {
    flex: 1, backgroundColor: COLORS.card, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
  },
  currencySpinner: { position: 'absolute', right: 80 },
  currencyChip: {
    backgroundColor: COLORS.accent + '20', borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  currencyChipText: { color: COLORS.accent, fontWeight: '700', fontSize: 14 },
  currencyDropdown: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, marginTop: 4, overflow: 'hidden',
  },
  currencyDropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  currencyDropdownCode: { color: COLORS.text, fontWeight: '700', fontSize: 14, minWidth: 44 },
  currencyDropdownName: { color: COLORS.textMuted, fontSize: 13, flex: 1 },
  countryRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  countryChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  countryChipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '20' },
  countryChipText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13 },
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
  leadBadge: { color: COLORS.success, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  leadName: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  leadEmail: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  changeBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  notFoundBox: {
    backgroundColor: COLORS.card, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 16,
  },
  notFoundText: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
  notFoundEmail: { color: COLORS.text, fontWeight: '600', fontSize: 14, marginBottom: 10 },
  retryText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 },
  sectionCount: {
    color: COLORS.accent, fontSize: 12, fontWeight: '700',
    backgroundColor: COLORS.accent + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  productCard: {
    backgroundColor: COLORS.card, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 8,
  },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  productName: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  productSku: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  productPrice: { color: COLORS.textMuted, fontSize: 12, marginBottom: 10 },
  productRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  fieldLabel: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  qtyPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', backgroundColor: COLORS.bg },
  qtyPillBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.card },
  qtyPillBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 22, lineHeight: 26 },
  qtyPillInput: {
    color: COLORS.text, fontWeight: '700', fontSize: 16, textAlign: 'center',
    width: 56, height: 44, backgroundColor: COLORS.bg,
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border,
  },
  subtotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  subtotalLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  subtotalValue: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  removeBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: COLORS.error + '20', justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 14 },
  addCatalogBtn: {
    borderWidth: 1, borderColor: COLORS.accent, borderStyle: 'dashed',
    borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4,
  },
  addCatalogBtnText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },
  totalBox: {
    backgroundColor: COLORS.card, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.accent + '50', padding: 16, marginTop: 12,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  totalLabel: { color: COLORS.textMuted, fontSize: 13 },
  totalVal: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  totalFinal: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, marginBottom: 0 },
  totalFinalLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  totalFinalVal: { color: COLORS.accent, fontSize: 22, fontWeight: '800' },
  createBtn: { backgroundColor: COLORS.accent, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 28 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalSafe: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
  },
  modalCloseText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  modalSearch: {
    margin: 16, backgroundColor: COLORS.card, color: COLORS.text,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.border, fontSize: 14,
  },
  catalogItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  catalogItemActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '15' },
  catalogItemInfo: { flex: 1 },
  catalogItemName: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  catalogItemSku: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },
  catalogCheck: { color: COLORS.accent, fontWeight: '900', fontSize: 18, marginLeft: 10 },
  catalogEmpty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 48, fontSize: 14, paddingHorizontal: 32 },
  modalFooter: { padding: 20, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  modalSelectedText: { color: COLORS.text, fontWeight: '600', fontSize: 14, marginBottom: 12 },
  modalQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalQtyLabel: { color: COLORS.textMuted, fontSize: 14 },
  modalQtyInput: {
    backgroundColor: COLORS.bg, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, padding: 10, width: 60, textAlign: 'center', fontSize: 16, fontWeight: '700',
  },
  modalAddBtn: { flex: 1, backgroundColor: COLORS.accent, borderRadius: 8, padding: 13, alignItems: 'center' },
  modalAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
