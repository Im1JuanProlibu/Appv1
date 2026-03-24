import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  Modal,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { getProposal, saveProposal, changeProposalStatus, getProducts, getPackages, getCurrencies, searchCurrencies, getApiBase, createProduct } from '../api';
import { ProlibuSpinner } from '../components/ProlibuLoader';
import { ArrowLeft, ArrowRight, CheckCircle, X, Check } from 'phosphor-react-native';

const STATUSES = ['Draft', 'Ready', 'Approved', 'Denied'];
const STATUS_LABEL = { Draft: 'Borrador', Ready: 'Lista', Approved: 'Aprobada', Denied: 'Negada' };
const STATUS_COLOR = {
  Draft: '#FDBD00',
  Ready: '#39B54A',
  Approved: '#4285F4',
  Denied: '#D4145A',
};

function parseProducts(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (typeof raw === 'object') return [raw];
  return [];
}

// ─── Header ─────────────────────────────────────────────────────────────────
function Header({ title, number, onBack }) {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <ArrowLeft size={22} color={COLORS.accent} />
      </TouchableOpacity>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {number ? <Text style={styles.headerSub}>#{number}</Text> : null}
      </View>
    </View>
  );
}

// ─── Success screen ──────────────────────────────────────────────────────────
function SuccessScreen({ propUrl, proposal, status, onBack }) {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.successScroll}>
        <View style={styles.successIconWrap}>
          <CheckCircle size={64} color="#39B54A" weight="fill" />
        </View>
        <Text style={styles.successTitle}>¡Propuesta guardada!</Text>
        <Text style={styles.successSubtitle}>
          {proposal?.proposalNumber ? `N° ${proposal.proposalNumber} · ` : ''}
          Estado: {status}
        </Text>

        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>URL de la propuesta</Text>
          <Text style={styles.urlText} selectable>{propUrl}</Text>
        </View>

        <TouchableOpacity
          style={styles.openBtn}
          onPress={() => Linking.openURL(propUrl).catch(() => Alert.alert('Error', 'No se pudo abrir el enlace.'))}
          activeOpacity={0.8}
        >
          <Text style={styles.openBtnText}>Abrir propuesta </Text><ArrowRight size={16} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => Share.share({ message: propUrl, url: propUrl, title: 'Propuesta Prolibu V1' })}
          activeOpacity={0.8}
        >
          <Text style={styles.shareBtnText}>Compartir enlace</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLinkBtn} onPress={onBack}>
          <ArrowLeft size={14} color={COLORS.accent} /><Text style={styles.backLinkText}> Volver a propuestas</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main EditorScreen ────────────────────────────────────────────────────────
export default function EditorScreen({ navigation, route }) {
  const { colors: COLORS, isDark } = useTheme();
  const { proposal: propSummary, auth } = route.params;
  const proposalId = propSummary.id || propSummary._id;

  const [proposal, setProposal] = useState(null);
  const [status, setStatus] = useState('');
  const [products, setProducts] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [propUrl, setPropUrl] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [currencies, setCurrencies] = useState([]);
  const [currencySearch, setCurrencySearch] = useState('COP');
  const [currencySuggestions, setCurrencySuggestions] = useState([]);
  const [currencySearching, setCurrencySearching] = useState(false);

  // Catalog modal state
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [addQty, setAddQty] = useState('1');
  const [packages, setPackages] = useState([]);
  const [catalogTab, setCatalogTab] = useState('products'); // 'products' | 'packages'

  // Create product modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSku, setCreateSku] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createQty, setCreateQty] = useState('1');
  const [creatingProduct, setCreatingProduct] = useState(false);

  useEffect(() => {
    Promise.all([loadProposal(), loadCatalog(), loadCurrencies(), loadPackages()])
      .then(([, catalogResult]) => {
        if (catalogResult && catalogResult.length > 0) {
          setProducts((prev) => prev.map((p) => {
            if (p.product?.price != null || p.price != null) return p;
            const pId = p.id || p._id;
            const match = catalogResult.find((c) => (c.sku || c.id || c._id) === pId);
            return match ? { ...p, _catalogRef: match } : p;
          }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const [originalStatus, setOriginalStatus] = useState('');

  async function loadProposal() {
    const res = await getProposal(proposalId, auth.token);
    const data = res.data || res;
    setProposal(data);
    const s = data.status || 'Draft';
    setStatus(s);
    setOriginalStatus(s);
    const prods = parseProducts(data.products);
    setProducts(prods);
    const currObj = data.currency;
    const cur = (currObj && typeof currObj === 'object' ? currObj.code : currObj) || 'COP';
    setCurrency(cur);
    setCurrencySearch(cur);
  }

  async function loadCurrencies() {
    try {
      const res = await getCurrencies(auth.token);
      const raw = Array.isArray(res) ? res : (res.data || res.docs || res.records || []);
      const list = Array.isArray(raw) ? raw.filter((c) => c && c.code) : [];
      if (list.length > 0) setCurrencies(list);
    } catch {}
  }

  async function loadCatalog() {
    try {
      const res = await getProducts(auth.token);
      const raw = Array.isArray(res) ? res : (res.docs || res.data || res.records || []);
      const all = Array.isArray(raw) ? raw : [];
      const filtered = all.filter((p) => !p.disabled);
      setCatalog(filtered);
      return filtered;
    } catch {
      return [];
    }
  }

  async function loadPackages() {
    try {
      const res = await getPackages(auth.token);
      const raw = Array.isArray(res) ? res : (res.docs || res.data || res.records || []);
      setPackages(Array.isArray(raw) ? raw : []);
    } catch {}
  }

  function setQty(index, qty) {
    const n = Math.max(1, parseInt(qty) || 1);
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, quantity: n, _edited: true } : p)));
  }

  function setProductComment(index, val) {
    setProducts((prev) => prev.map((p, i) => i === index ? { ...p, comment: val } : p));
  }

  function setDiscount(index, val, mode) {
    setProducts((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      if (mode === 'value') {
        const absVal = Math.max(0, parseFloat(val) || 0);
        const price = (p.product || p._catalogRef)?.price ?? p.price ?? 0;
        const qty = p.quantity || 1;
        const rate = price > 0 ? Math.min(100, (absVal / (price * qty)) * 100) : 0;
        return { ...p, discountRate: rate, _discountMode: 'value', _discountValue: absVal, _edited: true };
      }
      const n = Math.min(100, Math.max(0, parseFloat(val) || 0));
      return { ...p, discountRate: n, _discountMode: 'percent', _edited: true };
    }));
  }

  function toggleDiscountMode(index) {
    setProducts((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      const currentMode = p._discountMode || 'percent';
      const newMode = currentMode === 'percent' ? 'value' : 'percent';
      if (newMode === 'value') {
        const price = (p.product || p._catalogRef)?.price ?? p.price ?? 0;
        const qty = p.quantity || 1;
        const absVal = parseFloat(((price * qty * (p.discountRate || 0)) / 100).toFixed(2));
        return { ...p, _discountMode: 'value', _discountValue: absVal };
      }
      return { ...p, _discountMode: 'percent', _discountValue: null };
    }));
  }

  function removeProduct(index) {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  async function addCustomProduct() {
    const name = createName.trim();
    const sku = createSku.trim();
    if (!name) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del producto.');
      return;
    }
    if (!sku) {
      Alert.alert('SKU requerido', 'Ingresa el SKU del producto.');
      return;
    }
    const price = Math.max(0, parseFloat(createPrice) || 0);
    const qty = Math.max(1, parseInt(createQty) || 1);
    setCreatingProduct(true);
    try {
      const res = await createProduct({ name, sku, price, disabled: false }, auth.token);
      const created = res.data || res;
      const newProduct = { ...(created || {}), name, sku, price };
      const productId = newProduct.sku || newProduct.id || newProduct._id;
      setProducts((prev) => [...prev, { id: productId, name, price, quantity: qty, product: newProduct }]);
      setCatalog((prev) => [...prev, newProduct]);
      setCreateName('');
      setCreateSku('');
      setCreatePrice('');
      setCreateQty('1');
      setShowCreate(false);
    } catch (e) {
      Alert.alert('Error al crear producto', e.message || 'No se pudo crear el producto en el catálogo.');
    } finally {
      setCreatingProduct(false);
    }
  }

  function addCatalogItem() {
    if (!selectedItem) {
      Alert.alert('Selecciona un producto del catálogo');
      return;
    }
    // La API usa el SKU como identificador del producto, no el ID de MongoDB
    const itemId = selectedItem.sku || selectedItem.id || selectedItem._id;
    const qty = Math.max(1, parseInt(addQty) || 1);
    setProducts((prev) => {
      const idx = prev.findIndex((p) => (p.sku || p.id || p._id) === itemId);
      if (idx >= 0) {
        return prev.map((p, i) =>
          i === idx ? { ...p, quantity: (p.quantity || 1) + qty } : p
        );
      }
      return [
        ...prev,
        { id: itemId, name: selectedItem.name, quantity: qty, product: selectedItem },
      ];
    });
    setSelectedItem(null);
    setAddQty('1');
    setShowCatalog(false);
  }

  async function handleSave() {
    setSaving(true);
    const productList = products.map((p) => {
      const entry = {
        id: p.id || p._id,
        quantity: p.quantity || 1,
        discountRate: p.discountRate || 0,
      };
      // Incluir nombre y precio cuando estén disponibles (productos custom o sin referencia de catálogo)
      if (p.name) entry.name = p.name;
      if (p.price != null) entry.price = p.price;
      if (p.comment) entry.comment = p.comment;
      return entry;
    });

    // URL pública de la propuesta: /v1/document/proposal/{mongoId}/full
    const rand = Math.floor(Math.random() * 9999999);
    const base = getApiBase(); // e.g. https://fanalca.prolibu.com/v1
    const propViewUrl = `${base}/document/proposal/${proposalId}/full?source=none&rand=${rand}`;

    try {
      // 1. Guardar productos
      console.log('Guardando productos:', JSON.stringify(productList));
      let productsRes;
      try {
        productsRes = await saveProposal(proposalId, { products: productList, currency }, auth.token);
      } catch {
        productsRes = await saveProposal(proposalId, { products: JSON.stringify(productList), currency }, auth.token);
      }
      console.log('PUT productos OK:', JSON.stringify(productsRes));

      // 2. Cambiar estado solo si cambió
      let statusWarning = null;
      if (status !== originalStatus) {
        try {
          console.log('Cambiando estado a:', status);
          const statusRes = await changeProposalStatus(proposalId, status, auth.token);
          console.log('changeStatus OK:', JSON.stringify(statusRes));
          setOriginalStatus(status);
        } catch (e) {
          console.log('Error al cambiar estado:', e.message);
          statusWarning = e.message || 'No se pudo cambiar el estado.';
          setStatus(originalStatus); // revertir UI al estado original
        }
      }

      setPropUrl(propViewUrl);
      setSaved(true);
      if (statusWarning) {
        Alert.alert('Productos guardados', `Estado no cambiado: ${statusWarning}`);
      }
    } catch (e) {
      console.log('Error al guardar:', e.message);
      Alert.alert('Error al guardar', e.message || 'Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const activeCatalog = catalogTab === 'packages' ? packages : catalog;
  const filteredCatalog = activeCatalog.filter((p) =>
    (p.name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(catalogSearch.toLowerCase())
  );

  // Resumen con desglose: subtotal bruto, descuento, IVA, total
  // p.product.tax puede ser string "19" (tasa %) o number (monto $) — siempre tratamos como tasa
  const summary = products.reduce(
    (acc, p) => {
      const ref = p.product || p._catalogRef;
      const price = parseFloat(ref?.price ?? ref?.value ?? ref?.unitPrice ?? p.price ?? 0) || 0;
      const qty = p.quantity || 1;
      const taxRate = parseFloat(ref?.taxRate ?? ref?.tax ?? p.taxRate ?? 0) || 0;
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
    },
    { subtotal: 0, discount: 0, tax: 0, total: 0 }
  );
  const grandTotal = summary.total;

  const styles = makeStyles(COLORS);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]} edges={['top']}>
        <ProlibuSpinner />
        <Text style={styles.loadingText}>Cargando propuesta...</Text>
      </SafeAreaView>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (saved) {
    return <SuccessScreen propUrl={propUrl} proposal={proposal} status={status} onBack={() => navigation.goBack()} />;
  }

  const proposalTitle =
    proposal?.title || proposal?.name || propSummary.title || 'Sin título';
  const proposalNumber = proposal?.number || propSummary.number;

  // ── Editor ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.bg} />
      <Header
        title={proposalTitle}
        number={proposalNumber}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Status ── */}
        <Text style={styles.sectionLabel}>Estado</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => {
            const active = status === s;
            const color = STATUS_COLOR[s];
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusBtn,
                  active && { borderColor: color, backgroundColor: color + '20' },
                ]}
                onPress={() => setStatus(s)}
                activeOpacity={0.7}
              >
                {active && <View style={[styles.statusDot, { backgroundColor: color }]} />}
                <Text style={[styles.statusBtnText, active && { color }]}>{STATUS_LABEL[s] || s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Moneda ── */}
        <Text style={styles.sectionLabel}>Moneda</Text>
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

        {/* ── Products ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Productos</Text>
          <Text style={styles.sectionCount}>{products.length}</Text>
        </View>

        {products.length === 0 && (
          <Text style={styles.noProducts}>Sin productos. Agrega desde el catálogo.</Text>
        )}

        {products.map((p, i) => {
          const ref = p.product || p._catalogRef;
          const productName = ref?.name || p.name || p.id || p._id;
          const productSku = ref?.sku || p.sku || (String(p.id || '').startsWith('custom-') ? null : p.id);
          const price = parseFloat(ref?.price ?? ref?.value ?? ref?.unitPrice ?? p.price ?? 0) || 0;
          const discount = p.discountRate || 0;
          const discountMode = p._discountMode || 'percent';
          const qty = p.quantity || 1;
          const taxRate = parseFloat(ref?.taxRate ?? ref?.tax ?? p.taxRate ?? 0) || 0;
          const discountDisplayVal = discountMode === 'value'
            ? (p._discountValue != null ? String(p._discountValue) : '')
            : (discount > 0 ? String(discount) : '');
          const lineGross = price * qty;
          const discountAmt = (lineGross * discount) / 100;
          const lineNet = lineGross - discountAmt;
          const taxAmt = taxRate > 0 ? (lineNet * taxRate) / 100 : 0;
          const subtotal = lineNet + taxAmt;
          return (
            <View key={i} style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
                  {productSku ? <Text style={styles.productSku} numberOfLines={1}>SKU: {productSku}</Text> : null}
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(i)}>
                  <X size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.productPrice}>
                $ {price.toLocaleString('es-CO')} c/u{currency ? ` · ${currency}` : ''}{taxRate > 0 ? `  ·  IVA ${taxRate}%` : ''}
              </Text>

              {/* Cantidad */}
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

              {/* Descuento */}
              <View style={styles.productRow}>
                <Text style={styles.fieldLabel}>Descuento</Text>
                <View style={styles.discountRow}>
                  <TouchableOpacity
                    style={styles.discountToggle}
                    onPress={() => toggleDiscountMode(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.discountToggleText}>
                      {discountMode === 'percent' ? '%' : '$'}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.discountInput}
                    value={discountDisplayVal}
                    onChangeText={(v) => setDiscount(i, v, discountMode)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    selectTextOnFocus
                  />
                  {discountMode === 'percent' && discount > 0 && (
                    <Text style={styles.discountCalc}>
                      − ${discountAmt.toLocaleString('es-CO')}
                    </Text>
                  )}
                  {discountMode === 'value' && p._discountValue > 0 && (
                    <Text style={styles.discountCalc}>≈ {discount.toFixed(1)}%</Text>
                  )}
                </View>
              </View>

              {/* Subtotal con IVA */}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>
                  {taxAmt > 0 ? `Neto + IVA ${taxRate}%` : 'Subtotal'}
                </Text>
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

        {/* Total breakdown */}
        {products.length > 0 && (
          <View style={styles.totalBox}>
            <View style={styles.totalBreakdown}>
              <View style={styles.totalBreakdownRow}>
                <Text style={styles.totalBreakdownLabel}>Subtotal</Text>
                <Text style={styles.totalBreakdownValue}>$ {summary.subtotal.toLocaleString('es-CO')}</Text>
              </View>
              {summary.discount > 0 && (
                <View style={styles.totalBreakdownRow}>
                  <Text style={styles.totalBreakdownLabel}>Descuento</Text>
                  <Text style={[styles.totalBreakdownValue, { color: COLORS.success }]}>
                    − $ {summary.discount.toLocaleString('es-CO')}
                  </Text>
                </View>
              )}
              {summary.tax > 0 && (
                <View style={styles.totalBreakdownRow}>
                  <Text style={styles.totalBreakdownLabel}>Impuestos</Text>
                  <Text style={styles.totalBreakdownValue}>$ {summary.tax.toLocaleString('es-CO')}</Text>
                </View>
              )}
              <View style={styles.totalFinalRow}>
                <Text style={styles.totalLabel}>Total{currency ? ` · ${currency}` : ''}</Text>
                <Text style={styles.totalValue}>$ {grandTotal.toLocaleString('es-CO')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Add product buttons */}
        <View style={styles.addBtnRow}>
          <TouchableOpacity
            style={[styles.addBtn, styles.addBtnFlex]}
            onPress={() => { setCreateName(''); setCreateSku(''); setCreatePrice(''); setCreateQty('1'); setShowCreate(true); }}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>+ Crear producto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtnSecondary, styles.addBtnFlex]}
            onPress={() => { setCatalogSearch(''); setSelectedItem(null); setCatalogTab('products'); setShowCatalog(true); }}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnSecondaryText}>Del catálogo</Text>
          </TouchableOpacity>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ProlibuSpinner />
          ) : (
            <Text style={styles.saveBtnText}>Guardar cambios</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Create Product Modal ── */}
      <Modal
        visible={showCreate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreate(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo producto</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.modalCloseBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.createForm}>
            <Text style={styles.createLabel}>Nombre del producto</Text>
            <TextInput
              style={styles.createInput}
              placeholder="Ej: Pintura acrílica blanca"
              placeholderTextColor={COLORS.textMuted}
              value={createName}
              onChangeText={setCreateName}
              autoFocus
              returnKeyType="next"
            />
            <Text style={styles.createLabel}>SKU</Text>
            <TextInput
              style={styles.createInput}
              placeholder="Ej: PROD-001"
              placeholderTextColor={COLORS.textMuted}
              value={createSku}
              onChangeText={setCreateSku}
              autoCapitalize="characters"
              returnKeyType="next"
            />
            <Text style={styles.createLabel}>Precio unitario</Text>
            <TextInput
              style={styles.createInput}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
              value={createPrice}
              onChangeText={setCreatePrice}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
            <Text style={styles.createLabel}>Cantidad</Text>
            <TextInput
              style={styles.createInput}
              placeholder="1"
              placeholderTextColor={COLORS.textMuted}
              value={createQty}
              onChangeText={setCreateQty}
              keyboardType="number-pad"
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.modalAddBtn, { marginTop: 24 }, creatingProduct && { opacity: 0.6 }]}
              onPress={addCustomProduct}
              disabled={creatingProduct}
              activeOpacity={0.8}
            >
              {creatingProduct
                ? <ProlibuSpinner />
                : <Text style={styles.modalAddBtnText}>Agregar producto</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Catalog Modal ── */}
      <Modal
        visible={showCatalog}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCatalog(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Catálogo de productos</Text>
            <Text style={styles.modalProductCount}>{catalog.length} productos</Text>
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

          {/* Search */}
          <TextInput
            style={styles.modalSearch}
            placeholder="Buscar por nombre o SKU..."
            placeholderTextColor={COLORS.textMuted}
            value={catalogSearch}
            onChangeText={setCatalogSearch}
          />

          {/* Catalog list */}
          <FlatList
            data={filteredCatalog}
            keyExtractor={(p) => p.id || p._id}
            renderItem={({ item }) => {
              const itemId = item.id || item._id;
              const active = (selectedItem?.id || selectedItem?._id) === itemId;
              return (
                <TouchableOpacity
                  style={[styles.catalogItem, active && styles.catalogItemActive]}
                  onPress={() => setSelectedItem(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.catalogItemInfo}>
                    <Text style={styles.catalogItemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.sku ? (
                      <Text style={styles.catalogItemSku}>{item.sku}</Text>
                    ) : null}
                  </View>
                  {active && <Check size={18} color={COLORS.accent} weight="bold" />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.catalogEmpty}>
                {catalog.length === 0
                  ? 'Catálogo no disponible (verifica el token)'
                  : 'Sin resultados'}
              </Text>
            }
          />

          {/* Add footer */}
          {selectedItem && (
            <View style={styles.modalFooter}>
              <Text style={styles.modalSelectedText} numberOfLines={1}>
                {selectedItem.name}
              </Text>
              <View style={styles.modalQtyRow}>
                <Text style={styles.modalQtyLabel}>Cantidad:</Text>
                <TextInput
                  style={styles.modalQtyInput}
                  value={addQty}
                  onChangeText={setAddQty}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={styles.modalAddBtn}
                  onPress={addCatalogItem}
                  activeOpacity={0.8}
                >
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
    centered: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: C.textMuted, marginTop: 12, fontSize: 14 },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: C.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    backText: { color: C.text, fontSize: 18, fontWeight: '700' },
    headerInfo: { flex: 1 },
    headerTitle: { color: C.text, fontWeight: '700', fontSize: 17 },
    headerSub: { color: C.textMuted, fontSize: 12, marginTop: 2 },

    // Scroll
    scroll: { padding: 16, paddingBottom: 48 },

    // Section labels
    sectionLabel: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 20,
      marginBottom: 10,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
      marginBottom: 10,
    },
    sectionCount: {
      color: C.accent,
      fontSize: 12,
      fontWeight: '700',
      backgroundColor: C.accent + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },

    // Currency
    currencySearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    currencyInput: {
      flex: 1, backgroundColor: C.card, color: C.text,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    },
    currencySpinner: { position: 'absolute', right: 80 },
    currencyChip: {
      backgroundColor: C.accent + '20', borderWidth: 1, borderColor: C.accent,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    },
    currencyChipText: { color: C.accent, fontWeight: '700', fontSize: 14 },
    currencyDropdown: {
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 10, marginTop: 4, overflow: 'hidden',
    },
    currencyDropdownItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    currencyDropdownCode: { color: C.text, fontWeight: '700', fontSize: 14, minWidth: 44 },
    currencyDropdownName: { color: C.textMuted, fontSize: 13, flex: 1 },

    // Status
    statusRow: { flexDirection: 'row', gap: 8 },
    statusBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusBtnText: { color: C.textMuted, fontWeight: '700', fontSize: 13 },

    // Products
    noProducts: {
      color: C.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 20,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      borderStyle: 'dashed',
    },
    productCard: {
      backgroundColor: C.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 8,
    },
    productHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 4,
    },
    productName: { color: C.text, fontWeight: '600', fontSize: 14, flex: 1 },
    productSku: { color: C.textMuted, fontSize: 11, marginTop: 2 },
    productPrice: { color: C.textMuted, fontSize: 12, marginBottom: 10 },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    fieldLabel: { color: C.textMuted, fontSize: 13, fontWeight: '600' },

    // Qty pill stepper
    qtyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      backgroundColor: C.bg,
    },
    qtyPillBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.card,
    },
    qtyPillBtnText: { color: C.text, fontWeight: '700', fontSize: 22, lineHeight: 26 },
    qtyPillInput: {
      color: C.text,
      fontWeight: '700',
      fontSize: 16,
      textAlign: 'center',
      width: 56,
      height: 44,
      backgroundColor: C.bg,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: C.border,
    },

    // Discount
    discountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    discountInput: {
      color: C.text,
      fontWeight: '700',
      fontSize: 15,
      textAlign: 'center',
      width: 70,
      height: 44,
      backgroundColor: C.bg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
    },
    discountToggle: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: C.accent + '20',
      borderWidth: 1,
      borderColor: C.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    discountToggleText: { color: C.accent, fontWeight: '800', fontSize: 15 },
    discountCalc: { color: C.accent, fontSize: 12, fontWeight: '600' },

    // Subtotal row (inside card)
    subtotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    subtotalLabel: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    subtotalValue: { color: C.text, fontSize: 15, fontWeight: '700' },
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

    // Grand total box
    totalBox: {
      backgroundColor: C.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.accent + '50',
      padding: 16,
      marginTop: 4,
      marginBottom: 4,
    },
    totalBreakdown: { gap: 6 },
    totalBreakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalBreakdownLabel: { color: C.textMuted, fontSize: 13 },
    totalBreakdownValue: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
    totalFinalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    totalLabel: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    totalValue: { color: C.accent, fontSize: 22, fontWeight: '800' },

    spacer: { flex: 1 },
    removeBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: C.error + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeBtnText: { color: C.error, fontWeight: '700', fontSize: 14 },

    // Add product buttons
    addBtnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    addBtnFlex: { flex: 1 },
    addBtn: {
      borderWidth: 1,
      borderColor: C.accent,
      borderStyle: 'dashed',
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
    },
    addBtnText: { color: C.accent, fontWeight: '600', fontSize: 14 },
    addBtnSecondary: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
    },
    addBtnSecondaryText: { color: C.textMuted, fontWeight: '600', fontSize: 14 },

    // Create product form
    createForm: { padding: 20 },
    createLabel: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
      marginTop: 16,
    },
    createInput: {
      backgroundColor: C.bg,
      color: C.text,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
    },

    // Save button
    saveBtn: {
      backgroundColor: C.accent,
      borderRadius: 12,
      padding: 18,
      alignItems: 'center',
      marginTop: 28,
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    // ── Success ────────────────────────────────────────────────────────────────
    successScroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 28,
      alignItems: 'center',
    },
    successIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.success + '25',
      borderWidth: 2,
      borderColor: C.success,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    successIconText: { color: C.success, fontSize: 32, fontWeight: '900' },
    successTitle: {
      color: C.text,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 8,
    },
    successSubtitle: {
      color: C.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 28,
    },
    urlBox: {
      width: '100%',
      backgroundColor: C.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 20,
    },
    urlLabel: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    urlText: { color: C.text, fontSize: 13, lineHeight: 20 },
    openBtn: {
      backgroundColor: C.accent,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      width: '100%',
      marginBottom: 10,
    },
    openBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    shareBtn: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      width: '100%',
      marginBottom: 24,
    },
    shareBtnText: { color: C.text, fontWeight: '600', fontSize: 14 },
    backLinkBtn: { padding: 8 },
    backLinkText: { color: C.accent, fontWeight: '600', fontSize: 14 },

    // ── Catalog Modal ──────────────────────────────────────────────────────────
    modalSafe: { flex: 1, backgroundColor: C.bg },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    modalTitle: { color: C.text, fontSize: 18, fontWeight: '700', flex: 1 },
    modalProductCount: { color: C.textMuted, fontSize: 13, marginRight: 8, alignSelf: 'center' },
    modalCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseText: { color: C.textMuted, fontSize: 14, fontWeight: '700' },

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

    modalSearch: {
      margin: 16,
      backgroundColor: C.card,
      color: C.text,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.border,
      fontSize: 14,
    },
    catalogItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: C.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    catalogItemActive: { borderColor: C.accent, backgroundColor: C.accent + '15' },
    catalogItemInfo: { flex: 1 },
    catalogItemName: { color: C.text, fontWeight: '600', fontSize: 14 },
    catalogItemSku: { color: C.textMuted, fontSize: 11, marginTop: 3 },
    catalogCheck: {
      color: C.accent,
      fontWeight: '900',
      fontSize: 18,
      marginLeft: 10,
    },
    catalogEmpty: {
      color: C.textMuted,
      textAlign: 'center',
      marginTop: 48,
      fontSize: 14,
      paddingHorizontal: 32,
    },
    modalFooter: {
      padding: 20,
      backgroundColor: C.card,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    modalSelectedText: {
      color: C.text,
      fontWeight: '600',
      fontSize: 14,
      marginBottom: 12,
    },
    modalQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    modalQtyLabel: { color: C.textMuted, fontSize: 14 },
    modalQtyInput: {
      backgroundColor: C.bg,
      color: C.text,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      padding: 10,
      width: 60,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
    },
    modalAddBtn: {
      flex: 1,
      backgroundColor: C.accent,
      borderRadius: 8,
      padding: 13,
      alignItems: 'center',
    },
    modalAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
