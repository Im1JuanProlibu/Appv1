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
    throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
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

// GET /v1/proposal?inCharge={agentId}&sort=updatedAt DESC&populate=all
export function getProposals(agentId, token) {
  const params = new URLSearchParams({
    inCharge: agentId,
    page: '1',
    limit: '200',
    sort: 'updatedAt DESC',
    populate: 'all',
  });
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
export function registerPushToken(expoPushToken, token) {
  return request('/user/push-token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ expoPushToken }),
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

// GET /v1/lead/exist?key=email&val={email}
export function checkLeadByEmail(email, token) {
  const params = new URLSearchParams({ key: 'email', val: email });
  return request(`/lead/exist?${params}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// GET /v1/lead?email={email}  (búsqueda por email en el listado)
export function searchLeadByEmail(email, token) {
  const params = new URLSearchParams({ email, limit: '1' });
  return request(`/lead?${params}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
}

// POST /v1/lead
export function createLead(data, token) {
  return request('/lead', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
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
