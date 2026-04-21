import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  FlatList,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { checkLeadByEmail, searchLeadByEmail, createLead, createProposal, getProducts, getPackages, getCurrencies, searchCurrencies, getNextNumber } from '../api';
import { ProlibuSpinner } from '../components/ProlibuLoader';
import { ArrowLeft, ArrowRight, Check, X } from 'phosphor-react-native';
import { useTranslation } from '../i18n';

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
  const { colors: COLORS, isDark } = useTheme();
  const { t } = useTranslation();
  const { auth } = route.params;

  const [proposalNumber, setProposalNumber] = useState(() => genProposalNumber());
  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [currencies, setCurrencies] = useState([]);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [currencyResults, setCurrencyResults] = useState([]);
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

  // Products & Packages
  const [products, setProducts] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [packages, setPackages] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogTab, setCatalogTab] = useState('products'); // 'products' | 'packages'
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [addQty, setAddQty] = useState('1');

  const [creating, setCreating] = useState(false);

  // Modo avanzado
  const [advMode, setAdvMode] = useState(false);
  const [useConsecutive, setUseConsecutive] = useState(false);
  const [loadingNextNumber, setLoadingNextNumber] = useState(false);
  const [specialObservations, setSpecialObservations] = useState('');
  const [expirationDate, setExpirationDate]       = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [numberOfPayments, setNumberOfPayments]   = useState('');
  const [referenceNumber, setReferenceNumber]     = useState('');

  useEffect(() => {
    setCatalogLoading(true);
    Promise.all([
      getProducts(auth.token).then((res) => {
        const raw = Array.isArray(res) ? res : (res.docs || res.data || res.records || []);
        const all = Array.isArray(raw) ? raw : [];
        setCatalog(all.filter((p) => !p.disabled));
      }).catch(() => {}),
      getPackages(auth.token).then((res) => {
        const raw = Array.isArray(res) ? res : (res.docs || res.data || res.records || []);
        setPackages(Array.isArray(raw) ? raw : []);
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

  function setProductComment(index, val) {
    setProducts((prev) => prev.map((p, i) => i === index ? { ...p, comment: val } : p));
  }

  function setDiscount(index, val) {
    const n = Math.min(100, Math.max(0, parseFloat(val) || 0));
    setProducts((prev) => prev.map((p, i) => i === index ? { ...p, discountRate: n } : p));
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
        if (p.comment) entry.comment = p.comment;
        return entry;
      });

      const payload = {
        proposalNumber: proposalNumber.trim().toUpperCase(),
        title: title.trim(),
        relatedLead: leadId,
        numberOfPayments: advMode && numberOfPayments ? parseInt(numberOfPayments) || 1 : 1,
        currency,
        products: productList,
      };
      if (advMode) {
        if (specialObservations.trim()) payload.specialObservations = specialObservations.trim();
        if (referenceNumber.trim())     payload.referenceNumber     = referenceNumber.trim();
        // Fechas: convertir DD/MM/AAAA → YYYY-MM-DD
        const parseDate = (str) => {
          if (!str) return null;
          if (str.includes('/')) {
            const [d, m, y] = str.split('/').map(Number);
            if (y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          }
          return null;
        };
        const exp  = parseDate(expirationDate);
        const ecd  = parseDate(expectedCloseDate);
        if (exp) payload.expirationDate    = exp;
        if (ecd) payload.expectedCloseDate = ecd;
      }
      const res = await createProposal(payload, auth.token);
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

  const activeCatalog = catalogTab === 'packages' ? packages : catalog;
  const filteredCatalog = activeCatalog.filter((p) =>
    (p.name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const canCreate =
    proposalNumber.trim().length > 0 &&
    title.trim().length > 0 &&
    (leadFound != null || (leadNotFound && firstName.trim().length > 0));

  const styles = makeStyles(COLORS);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('createProposalTitle')}</Text>
      </View>

      {/* Toggle Básico / Avanzado */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeChip, !advMode && styles.modeChipActive]}
          onPress={() => setAdvMode(false)}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeChipText, !advMode && styles.modeChipTextActive]}>Básico</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeChip, advMode && styles.modeChipActive]}
          onPress={() => setAdvMode(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeChipText, advMode && styles.modeChipTextActive]}>Avanzado</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

        {/* Título */}
        <Text style={styles.label}>{t('fieldTitle')}</Text>
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
        <TouchableOpacity
          style={styles.currencyPickerBtn}
          onPress={() => { setCurrencySearch(''); setCurrencyResults(currencies); setShowCurrencyModal(true); }}
          activeOpacity={0.7}
        >
          <Text style={styles.currencyPickerBtnText}>{currency || 'Seleccionar moneda'}</Text>
          <Text style={styles.currencyPickerArrow}>▾</Text>
        </TouchableOpacity>

        {/* Cliente */}
        <Text style={styles.label}>{t('fieldClient')}</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Check size={13} color="#39B54A" weight="bold" />
                <Text style={styles.leadBadge}>Encontrado</Text>
              </View>
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
            <Text style={styles.label}>{t('createNewClient')}</Text>
            <TextInput style={styles.input} placeholder={`${t('clientName')} *`} placeholderTextColor={COLORS.textMuted} value={firstName} onChangeText={setFirstName} returnKeyType="next" />
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
          const discount = p.discountRate || 0;
          const lineGross = price * qty;
          const discountAmt = (lineGross * discount) / 100;
          const lineNet = lineGross - discountAmt;
          const taxAmt = taxRate > 0 ? (lineNet * taxRate) / 100 : 0;
          const subtotal = lineNet + taxAmt;
          return (
            <View key={i} style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={2}>{p.product?.name || p.name}</Text>
                  {(p.product?.sku || p.sku) ? <Text style={styles.productSku} numberOfLines={1}>SKU: {p.product?.sku || p.sku}</Text> : null}
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(i)}>
                  <X size={16} color={COLORS.textMuted} />
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
              <View style={styles.productRow}>
                <Text style={styles.fieldLabel}>Descuento %</Text>
                <View style={styles.discountRow}>
                  <TextInput
                    style={styles.discountInput}
                    value={discount > 0 ? String(discount) : ''}
                    onChangeText={(v) => setDiscount(i, v)}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                  <Text style={styles.discountPct}>%</Text>
                  {discount > 0 && (
                    <Text style={styles.discountAmt}>  −$ {discountAmt.toLocaleString('es-CO')}</Text>
                  )}
                </View>
              </View>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>{taxRate > 0 ? `Neto + IVA ${taxRate}%` : 'Subtotal'}</Text>
                <Text style={styles.subtotalValue}>$ {subtotal.toLocaleString('es-CO')}</Text>
              </View>
              <TextInput
                style={styles.productComment}
                placeholder="Nota interna del producto (opcional)..."
                placeholderTextColor={COLORS.textMuted}
                value={p.comment || ''}
                onChangeText={(v) => setProductComment(i, v)}
                multiline
                numberOfLines={2}
              />
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.addCatalogBtn}
          onPress={() => { setCatalogSearch(''); setSelectedItem(null); setCatalogTab('products'); setShowCatalog(true); }}
          activeOpacity={0.7}
        >
          {catalogLoading
            ? <ProlibuSpinner />
            : <Text style={styles.addCatalogBtnText}>{t('addFromCatalogBtn')}</Text>
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

        {/* Campos avanzados */}
        {advMode && (
          <View style={styles.advBlock}>
            <Text style={styles.advTitle}>Campos adicionales</Text>

            {/* Número de propuesta */}
            <Text style={styles.label}>Número de propuesta</Text>
            <View style={styles.consecutiveRow}>
              <TouchableOpacity
                style={[styles.consecutiveChip, !useConsecutive && styles.consecutiveChipActive]}
                onPress={() => {
                  setUseConsecutive(false);
                  setProposalNumber(genProposalNumber());
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.consecutiveChipText, !useConsecutive && styles.consecutiveChipTextActive]}>Aleatorio</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.consecutiveChip, useConsecutive && styles.consecutiveChipActive]}
                onPress={async () => {
                  setUseConsecutive(true);
                  setLoadingNextNumber(true);
                  try {
                    const res = await getNextNumber(auth.token);
                    const num = res?.number ?? res?.proposalNumber ?? res?.nextNumber ?? res?.data ?? res;
                    if (num && typeof num === 'string') setProposalNumber(num);
                  } catch {}
                  finally { setLoadingNextNumber(false); }
                }}
                activeOpacity={0.7}
              >
                {loadingNextNumber
                  ? <ProlibuSpinner />
                  : <Text style={[styles.consecutiveChipText, useConsecutive && styles.consecutiveChipTextActive]}>Consecutivo</Text>
                }
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholderTextColor={COLORS.textMuted}
              value={proposalNumber}
              onChangeText={(v) => setProposalNumber(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={30}
              returnKeyType="next"
              editable={!loadingNextNumber}
            />

            <Text style={styles.label}>Número de referencia</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: OC-2026-001"
              placeholderTextColor={COLORS.textMuted}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Cuotas de pago</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={COLORS.textMuted}
              value={numberOfPayments}
              onChangeText={setNumberOfPayments}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Fecha de vencimiento (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.input}
              placeholder="31/12/2026"
              placeholderTextColor={COLORS.textMuted}
              value={expirationDate}
              onChangeText={setExpirationDate}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Fecha estimada de cierre (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.input}
              placeholder="31/12/2026"
              placeholderTextColor={COLORS.textMuted}
              value={expectedCloseDate}
              onChangeText={setExpectedCloseDate}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Observaciones especiales</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Notas o condiciones particulares para el cliente…"
              placeholderTextColor={COLORS.textMuted}
              value={specialObservations}
              onChangeText={setSpecialObservations}
              multiline
              maxLength={500}
            />
            <Text style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 8, textAlign: 'right' }}>
              {specialObservations.length}/500
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.createBtn, (!canCreate || creating) && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={!canCreate || creating}
          activeOpacity={0.8}
        >
          {creating ? <ProlibuSpinner /> : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.createBtnText}>{t('createProposalBtn')}</Text>
              <ArrowRight size={18} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Currency Modal */}
      <Modal visible={showCurrencyModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCurrencyModal(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar moneda</Text>
            <TouchableOpacity onPress={() => setShowCurrencyModal(false)} style={styles.modalCloseBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.modalSearch}
            placeholder="Buscar por código o nombre (COP, USD...)"
            placeholderTextColor={COLORS.textMuted}
            value={currencySearch}
            autoCapitalize="characters"
            onChangeText={async (text) => {
              setCurrencySearch(text);
              if (!text.trim()) { setCurrencyResults(currencies); return; }
              setCurrencySearching(true);
              try {
                const res = await searchCurrencies(text.trim(), auth.token);
                const raw = Array.isArray(res) ? res : (res.data || res.docs || res.records || []);
                setCurrencyResults(Array.isArray(raw) ? raw.filter((c) => c && c.code) : []);
              } catch { setCurrencyResults([]); }
              finally { setCurrencySearching(false); }
            }}
          />
          {currencySearching && (
            <ActivityIndicator size="small" color={COLORS.accent} style={{ marginVertical: 12 }} />
          )}
          <FlatList
            data={currencyResults}
            keyExtractor={(c) => c.code}
            renderItem={({ item }) => {
              const active = item.code === currency;
              return (
                <TouchableOpacity
                  style={[styles.catalogItem, active && styles.catalogItemActive]}
                  onPress={() => { setCurrency(item.code); setShowCurrencyModal(false); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.catalogItemInfo}>
                    <Text style={[styles.catalogItemName, active && { color: COLORS.accent }]}>{item.code}</Text>
                    {item.name ? <Text style={styles.catalogItemSku}>{item.name}</Text> : null}
                  </View>
                  {active && <Check size={18} color={COLORS.accent} weight="bold" />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              !currencySearching ? (
                <Text style={styles.catalogEmpty}>
                  {currencySearch ? 'Sin resultados' : 'Escribe para buscar una moneda'}
                </Text>
              ) : null
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Catalog Modal */}
      <Modal visible={showCatalog} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCatalog(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Catálogo</Text>
            <TouchableOpacity onPress={() => setShowCatalog(false)} style={styles.modalCloseBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          {/* Productos / Paquetes toggle */}
          <View style={styles.catalogTabRow}>
            <TouchableOpacity
              style={[styles.catalogTabBtn, catalogTab === 'products' && styles.catalogTabBtnActive]}
              onPress={() => { setCatalogTab('products'); setSelectedItem(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.catalogTabText, catalogTab === 'products' && styles.catalogTabTextActive]}>
                Productos {catalog.length > 0 ? `(${catalog.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.catalogTabBtn, catalogTab === 'packages' && styles.catalogTabBtnActive]}
              onPress={() => { setCatalogTab('packages'); setSelectedItem(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.catalogTabText, catalogTab === 'packages' && styles.catalogTabTextActive]}>
                Paquetes {packages.length > 0 ? `(${packages.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.modalSearch}
            placeholder={t('productSearchPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={catalogSearch}
            onChangeText={setCatalogSearch}
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
                  {active && <Check size={18} color={COLORS.accent} weight="bold" />}
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

function makeStyles(C) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      justifyContent: 'center', alignItems: 'center',
    },
    backText: { color: C.text, fontSize: 18, fontWeight: '700' },
    headerTitle: { color: C.text, fontWeight: '700', fontSize: 18 },
    scroll: { padding: 20, paddingBottom: 48 },
    label: {
      color: C.textMuted, fontSize: 11, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 1,
      marginTop: 24, marginBottom: 8,
    },
    input: {
      backgroundColor: C.card, color: C.text,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    },
    currencyPickerBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
    },
    currencyPickerBtnText: { color: C.text, fontSize: 15, fontWeight: '600' },
    currencyPickerArrow: { color: C.textMuted, fontSize: 16 },
    countryRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
    countryChip: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    },
    countryChipActive: { borderColor: C.accent, backgroundColor: C.accent + '20' },
    countryChipText: { color: C.textMuted, fontWeight: '600', fontSize: 13 },
    searchRow: { flexDirection: 'row', gap: 8 },
    searchBtn: {
      backgroundColor: C.accent, borderRadius: 10,
      paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', minWidth: 80,
    },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    leadCard: {
      backgroundColor: C.card, borderRadius: 10,
      borderWidth: 1, borderColor: C.success + '60',
      padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    leadInfo: { flex: 1 },
    leadBadge: { color: C.success, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
    leadName: { color: C.text, fontWeight: '700', fontSize: 15 },
    leadEmail: { color: C.textMuted, fontSize: 12, marginTop: 2 },
    changeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border },
    changeBtnText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
    notFoundBox: {
      backgroundColor: C.card, borderRadius: 10,
      borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16,
    },
    notFoundText: { color: C.textMuted, fontSize: 13, marginBottom: 4 },
    notFoundEmail: { color: C.text, fontWeight: '600', fontSize: 14, marginBottom: 10 },
    retryText: { color: C.accent, fontSize: 13, fontWeight: '600' },
    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 },
    sectionCount: {
      color: C.accent, fontSize: 12, fontWeight: '700',
      backgroundColor: C.accent + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    },
    productCard: {
      backgroundColor: C.card, borderRadius: 10,
      borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8,
    },
    productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
    productName: { color: C.text, fontWeight: '600', fontSize: 14 },
    productSku: { color: C.textMuted, fontSize: 11, marginTop: 2 },
    productPrice: { color: C.textMuted, fontSize: 12, marginBottom: 10 },
    productRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    fieldLabel: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
    qtyPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden', backgroundColor: C.bg },
    qtyPillBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: C.card },
    qtyPillBtnText: { color: C.text, fontWeight: '700', fontSize: 22, lineHeight: 26 },
    qtyPillInput: {
      color: C.text, fontWeight: '700', fontSize: 16, textAlign: 'center',
      width: 56, height: 44, backgroundColor: C.bg,
      borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border,
    },
    subtotalRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
    },
    subtotalLabel: { color: C.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    subtotalValue: { color: C.text, fontSize: 15, fontWeight: '700' },
    discountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    discountInput: {
      width: 56, borderWidth: 1, borderColor: C.border, borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 6, fontSize: 14,
      color: C.text, backgroundColor: C.bg, textAlign: 'center',
    },
    discountPct: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
    discountAmt: { color: '#39B54A', fontSize: 13, fontWeight: '700' },
    productComment: {
      marginTop: 8,
      backgroundColor: C.bg,
      color: C.text,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      minHeight: 44,
      textAlignVertical: 'top',
    },
    removeBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.error + '20', justifyContent: 'center', alignItems: 'center' },
    removeBtnText: { color: C.error, fontWeight: '700', fontSize: 14 },
    addCatalogBtn: {
      borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed',
      borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4,
    },
    addCatalogBtnText: { color: C.accent, fontWeight: '600', fontSize: 14 },
    totalBox: {
      backgroundColor: C.card, borderRadius: 10,
      borderWidth: 1, borderColor: C.accent + '50', padding: 16, marginTop: 12,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    totalLabel: { color: C.textMuted, fontSize: 13 },
    totalVal: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
    totalFinal: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, marginBottom: 0 },
    totalFinalLabel: { color: C.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    totalFinalVal: { color: C.accent, fontSize: 22, fontWeight: '800' },
    createBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 28 },
    createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    modalSafe: { flex: 1, backgroundColor: C.bg },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
    modalCloseBtn: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: C.card,
      borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center',
    },
    modalCloseText: { color: C.textMuted, fontSize: 14, fontWeight: '700' },
    modalSearch: {
      margin: 16, backgroundColor: C.card, color: C.text,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.border, fontSize: 14,
    },
    catalogItem: {
      flexDirection: 'row', alignItems: 'center', padding: 14,
      marginHorizontal: 16, marginBottom: 8, backgroundColor: C.card,
      borderRadius: 10, borderWidth: 1, borderColor: C.border,
    },
    catalogItemActive: { borderColor: C.accent, backgroundColor: C.accent + '15' },
    catalogItemInfo: { flex: 1 },
    catalogItemName: { color: C.text, fontWeight: '600', fontSize: 14 },
    catalogItemSku: { color: C.textMuted, fontSize: 12, marginTop: 3 },
    catalogCheck: { color: C.accent, fontWeight: '900', fontSize: 18, marginLeft: 10 },
    catalogEmpty: { color: C.textMuted, textAlign: 'center', marginTop: 48, fontSize: 14, paddingHorizontal: 32 },
    modalFooter: { padding: 20, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
    modalSelectedText: { color: C.text, fontWeight: '600', fontSize: 14, marginBottom: 12 },
    modalQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    modalQtyLabel: { color: C.textMuted, fontSize: 14 },
    modalQtyInput: {
      backgroundColor: C.bg, color: C.text, borderWidth: 1, borderColor: C.border,
      borderRadius: 8, padding: 10, width: 60, textAlign: 'center', fontSize: 16, fontWeight: '700',
    },
    modalAddBtn: { flex: 1, backgroundColor: C.accent, borderRadius: 8, padding: 13, alignItems: 'center' },
    modalAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    // Modo Básico / Avanzado
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: C.card,
      borderRadius: 12,
      marginHorizontal: 20,
      marginTop: 12,
      marginBottom: 4,
      padding: 4,
      borderWidth: 1,
      borderColor: C.border,
    },
    modeChip: {
      flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center',
    },
    modeChipActive: {
      backgroundColor: C.accent,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    modeChipText:       { color: C.textMuted, fontWeight: '600', fontSize: 14 },
    modeChipTextActive: { color: '#fff', fontWeight: '700' },

    // Tabs catálogo
    catalogTabRow: {
      flexDirection: 'row', marginHorizontal: 16, marginBottom: 4,
      backgroundColor: C.card, borderRadius: 10,
      borderWidth: 1, borderColor: C.border, padding: 3,
    },
    catalogTabBtn: {
      flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    },
    catalogTabBtnActive: { backgroundColor: C.accent },
    catalogTabText: { color: C.textMuted, fontWeight: '600', fontSize: 13 },
    catalogTabTextActive: { color: '#fff', fontWeight: '700' },

    // Bloque avanzado
    advBlock: {
      backgroundColor: C.accent + '08',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.accent + '30',
      padding: 16,
      marginBottom: 16,
      marginTop: 16,
    },
    advTitle: {
      color: C.accent,
      fontWeight: '800',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    },
    consecutiveRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    consecutiveChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      backgroundColor: C.card,
    },
    consecutiveChipActive: {
      backgroundColor: C.accent,
      borderColor: C.accent,
    },
    consecutiveChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textMuted,
    },
    consecutiveChipTextActive: {
      color: '#fff',
    },
  });
}
