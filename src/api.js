const DOMAIN = 'customer-design.prolibu.com';
const BASE = `https://${DOMAIN}/v1`;

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
export function login(username, password) {
  return request('/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({ username, password, accessToken: ACCESS_TOKEN }),
  });
}

// GET /v1/publicservices/getAgents
// Roles must be passed as roles[] (jQuery array serialization), NOT ?roles=agent
export function getAgents() {
  const params = new URLSearchParams();
  params.append('status', 'active');
  params.append('roles[]', 'agent');
  return request(`/publicservices/getAgents?${params}`);
}

// GET /v1/proposal?createdBy={agentId}&limit=200
export function getProposals(agentId, token) {
  const params = new URLSearchParams({ createdBy: agentId, limit: '200' });
  return request(`/proposal?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// GET /v1/proposal/{id}
export function getProposal(id, token) {
  return request(`/proposal/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
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

// GET /v1/product?disabled=false
export function getProducts(token) {
  return request(`/product?disabled=false`, {
    headers: { Authorization: `Bearer ${token}` },
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
