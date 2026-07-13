const BASE = '/api/admin';

async function request(path, { method = 'GET', body, params, headers } = {}) {
  let url = `${BASE}${path}`;
  if (params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    const qs = new URLSearchParams(entries).toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : undefined),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.error;
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  login: (email, password) => request('/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/logout', { method: 'POST' }),
  me: () => request('/me'),

  listConversations: (params) => request('/conversations', { params }),
  getConversation: (id) => request(`/conversations/${id}`),
  reply: (id, text) => request(`/conversations/${id}/reply`, { method: 'POST', body: { text } }),
  claim: (id) => request(`/conversations/${id}/claim`, { method: 'POST' }),
  release: (id) => request(`/conversations/${id}/release`, { method: 'POST' }),
  switchToHuman: (id) => request(`/conversations/${id}/human`, { method: 'POST' }),
  returnToBot: (id, notifyCustomer = true) =>
    request(`/conversations/${id}/bot`, { method: 'POST', body: { notifyCustomer } }),
  markRead: (id) => request(`/conversations/${id}/read`, { method: 'POST' }),
  close: (id) => request(`/conversations/${id}/close`, { method: 'POST' }),
  reopen: (id) => request(`/conversations/${id}/reopen`, { method: 'POST' }),

  listUsers: () => request('/users'),
  createUser: (payload) => request('/users', { method: 'POST', body: payload }),
  updateUser: (id, payload) => request(`/users/${id}`, { method: 'PATCH', body: payload }),

  listTemplates: (refresh) => request('/templates', { params: refresh ? { refresh: '1' } : undefined }),
  startConversation: (payload, idempotencyKey) =>
    request('/conversations/new', {
      method: 'POST',
      body: payload,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
};
