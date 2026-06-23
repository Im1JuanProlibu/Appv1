// BASE is set at runtime via setApiDomain() — default kept for safety
let BASE = 'https://customer-design.prolibu.com/v1';

/** Call this once on app start with the stored domain (e.g. "customer-design.prolibu.com") */
export function setApiDomain(domain) {
  const clean = domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '').replace(/\/v1$/i, '');
  BASE = `https://${clean}/v1`;
}

export function getApiBase() { return BASE; }

// Token fijo de la plataforma (va en el body del login)
const ACCESS_TOKEN = '56a69869-bf0a-4650-98e9-fcd9680b31d5';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no válida (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const err = new Error(json?.message || json?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json;
}

// POST /v1/user/login
// La API espera: username + password + accessToken (token fijo de la plataforma)
// Retorna el body JSON + _token (del header Authorization si no viene en el body)
export async function login(username, password) {
  const res = await fetch(`${BASE}/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Respuesta no válida (HTTP ${res.status})`); }
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);

  // La API usa el accessToken fijo para todas las llamadas — se retorna como _token
  const headerToken = (res.headers.get('authorization') || res.headers.get('token') || '').replace(/^Bearer\s+/i, '');
  return { ...json, _headerToken: headerToken, _accessToken: ACCESS_TOKEN };
}

// GET /v1/publicservices/getAgents
// Roles must be passed as roles[] (jQuery array serialization), NOT ?roles=agent
export function getAgents() {
  const params = new URLSearchParams();
  params.append('status', 'active');
  params.append('roles[]', 'agent');
  return request(`/publicservices/getAgents?${params}`);
}

// GET /v1/proposal — si agentId es null carga todas las propuestas (admin)
export function getProposals(agentId, token, page = 1, limit = 50) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort: 'updatedAt DESC',
    populate: 'all',
  });
  if (agentId) params.set('inCharge', agentId);
  return request(`/proposal?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// GET /v1/proposal/{id}
export function getProposal(id, token) {
  return request(`/proposal/${id}?populate=all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// POST /v1/urlShort/generate — devuelve { url: "https://dominio/r/AbCd3F" }
// Reutiliza la URL corta si la URL larga ya existe en la DB
export function generateShortUrl(longUrl, userId, token) {
  return request('/urlShort/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ url: longUrl, createdBy: userId, updatedBy: userId }),
  });
}

// PUT /v1/proposal/{id}
export function saveProposal(id, body, token) {
  return request(`/proposal/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// PUT /v1/proposal/denialReason
export function saveDenialReason(id, denialReason, token) {
  return request('/proposal/denialReason', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({ id, denialReason }),
  });
}

// GET /v1/proposal/getNextNumber
export function getNextNumber(token) {
  return request('/proposal/getNextNumber', {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// POST /v1/user/push-token — registra el Expo Push Token del dispositivo (merge, multi-device)
export function registerPushToken(expoPushToken, token, userId) {
  return request('/user/push-token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ expoPushToken, userId }),
  });
}

// PUT /v1/proposal/changeStatus
export function changeProposalStatus(id, status, token) {
  return request('/proposal/changeStatus', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({ id, status }),
  });
}

// GET /v1/currency
export function getCurrencies(token) {
  return request('/currency', {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// GET /v1/config/getGroup/system — configuración global de la plataforma
export function getSystemConfig(token) {
  return request('/config/getGroup/system', {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// GET /v1/config/getGroup/<group> — detecta si una integración está activa para esta cuenta
// Ej: getIntegrationConfig(token, 'hubspot'), getIntegrationConfig(token, 'zoho')
export function getIntegrationConfig(token, group) {
  return request(`/config/getGroup/${encodeURIComponent(group)}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// ─── HubSpot Direct API ──────────────────────────────────────────────────────
// Crea un deal directamente en HubSpot usando el token privado de la cuenta.
// Retorna el objeto deal creado ({ id, properties, ... })
export async function createHubspotDeal({ dealName, pipeline, dealstage, amount, currencyCode, ownerId, hsToken }) {
  const properties = {
    dealname: dealName,
    pipeline: pipeline || 'default',
    dealstage: dealstage || 'qualifiedtobuy',
    amount: String(amount || 0),
    deal_currency_code: currencyCode || 'USD',
  };
  if (ownerId) properties.hubspot_owner_id = String(ownerId);
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hsToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`HubSpot: respuesta no válida (HTTP ${res.status})`); }
  if (!res.ok) throw new Error(json?.message || json?.errors?.[0]?.message || `HubSpot HTTP ${res.status}`);
  return json;
}

// Busca un contacto en HubSpot por email. Retorna el objeto o null si no existe.
export async function findHubspotContact(email, hsToken) {
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email&properties=hubspot_owner_id,email,firstname,lastname`, {
    headers: { Authorization: `Bearer ${hsToken}` },
  });
  if (res.status === 404) return null;
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { return null; }
  if (!res.ok) return null;
  return json;
}

// Crea un contacto en HubSpot. Retorna el objeto creado.
export async function createHubspotContact({ email, firstName, lastName, phone, ownerId, hsToken }) {
  const properties = {
    email,
    firstname: firstName || '',
    lastname: lastName || '',
    phone: phone || '',
  };
  if (ownerId) properties.hubspot_owner_id = String(ownerId);
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hsToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`HubSpot: respuesta no válida (HTTP ${res.status})`); }
  if (!res.ok) throw new Error(json?.message || json?.errors?.[0]?.message || `HubSpot HTTP ${res.status}`);
  return json;
}

// Actualiza el owner de un contacto existente en HubSpot.
export async function updateHubspotContactOwner(contactId, ownerId, hsToken) {
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${hsToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { hubspot_owner_id: String(ownerId) } }),
  });
  return res.ok;
}

// Asocia un contacto a un deal en HubSpot.
export async function associateHubspotDealContact(dealId, contactId, hsToken) {
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${hsToken}` },
  });
  return res.ok;
}

// Busca un owner (usuario/agente) en HubSpot por email. Retorna { id } o null.
export async function findHubspotOwner(email, hsToken) {
  const res = await fetch(`https://api.hubapi.com/crm/v3/owners?email=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${hsToken}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.results?.[0] || null;
}

// Obtiene un owner aleatorio de HubSpot. Retorna { id } o null.
export async function getRandomHubspotOwner(hsToken) {
  const res = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', {
    headers: { Authorization: `Bearer ${hsToken}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const owners = json.results || [];
  if (owners.length === 0) return null;
  return owners[Math.floor(Math.random() * owners.length)];
}

// GET /v1/tax?sort=updatedAt DESC — lista de impuestos disponibles
export function getTaxes(token) {
  return request('/tax?sort=updatedAt%20DESC&limit=100', {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// GET /v1/currency/search
export function searchCurrencies(criteria, token) {
  const params = new URLSearchParams({
    criteria,
    limit: '100',
    page: '1',
    searchFields: 'code,name',
    selectedFields: 'code,name',
    sort: 'updatedAt DESC',
  });
  return request(`/currency/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// GET /v1/product?disabled=false&limit=1000
export function getProducts(token) {
  return request(`/product?disabled=false&limit=1000`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// POST /v1/product — crea un producto en el catálogo
export function createProduct(data, token) {
  return request('/product', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
}

// GET /v1/lead/exist?key=email&val={email} — check custom que puede bypasear AC
export async function checkLeadByEmail(email, token) {
  const params = new URLSearchParams({ key: 'email', val: email });
  const res = await fetch(`${BASE}/lead/exist?${params}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  const text = await res.text();
  console.log('[api] /lead/exist status:', res.status, 'body:', text.substring(0, 300));
  let json;
  try { json = JSON.parse(text); } catch { return null; }
  // Si el backend devuelve 404 o no-ok pero tiene data, intentar extraer el lead
  if (json && (json.id || json._id)) return json;
  if (json?.data && (json.data.id || json.data._id)) return json.data;
  if (Array.isArray(json) && json.length > 0) return json[0];
  if (Array.isArray(json?.data) && json.data.length > 0) return json.data[0];
  return null;
}

// GET /v1/lead?email={email}  (búsqueda por email en el listado — sujeta a AC)
export function searchLeadByEmail(email, token) {
  const params = new URLSearchParams({ email, limit: '1' });
  return request(`/lead?${params}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// POST /v1/lead — crear lead. Si falla por duplicado, intenta devolver el lead existente.
export async function createLead(data, token) {
  const res = await fetch(`${BASE}/lead`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Respuesta no válida (HTTP ${res.status})`); }
  if (!res.ok) {
    console.log('[api] createLead error:', res.status, text.substring(0, 300));
    const err = new Error(json?.message || json?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json;
}


// POST /v1/proposal
export function createProposal(data, token) {
  return request('/proposal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
}

// PUT /v1/proposal — actualizar metadata de una propuesta (ej: guardar hubspotDealId)
export function updateProposal(id, data, token) {
  return request(`/proposal/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
}

// GET /v1/proposal/calcStats?inCharge={agentId}
export function getProposalStats(agentId, token) {
  const params = new URLSearchParams({ inCharge: agentId });
  return request(`/proposal/calcStats?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// GET /v1/package?sort=updatedAt DESC
export function getPackages(token) {
  return request('/package?sort=updatedAt%20DESC&limit=200', {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// GET /v1/report?limit=50
export function getReports(token) {
  return request('/report?limit=50&sort=createdAt DESC', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// GET /v1/report/{id}/run
export function runReport(id, token) {
  return request(`/report/${id}/run`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// GET /v1/report/{id}/download — envía Excel por email al usuario
export function downloadReport(id, token) {
  return request(`/report/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// GET /v1/user?status=active&limit=200 — lista todos los usuarios activos
// Los agentes tienen home="/app/dashboard"; admins tienen home="/app"
export function getActiveUsers(token) {
  return request('/user?status=active&limit=200&sort=firstName ASC', {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}
