// Kurumsal grup şablonu API istemcisi (`/api/v1/fair-stand/group-templates`).
// Kimlik başlıkları proje istemcisiyle aynı yerden gelir; organizasyon sunucuda oturumdan
// okunur. Oturum yoksa (yerel/bağımsız mod) şablonlar kullanılamaz.

import { getFairStandHostWindow } from './hostDocument.js';

export const GROUP_TEMPLATES_API_BASE = '/api/v1/fair-stand/group-templates';
export const GROUP_TEMPLATES_REMOTE_REQUIRED_MESSAGE = 'Şablonlar için oturum açık olmalı (CRM içinden açın).';

function apiHeaders() {
  const hostWindow = getFairStandHostWindow();
  const headers = hostWindow?.__FAIR_STAND_CATALOG_HEADERS__ || globalThis.__FAIR_STAND_CATALOG_HEADERS__;
  return headers && typeof headers === 'object' ? { ...headers } : {};
}

export function isGroupTemplateRemoteEnabled() {
  const headers = apiHeaders();
  return Boolean(headers.Authorization || headers.authorization);
}

async function request(path = '', { method = 'GET', body } = {}) {
  const headers = { ...apiHeaders() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${GROUP_TEMPLATES_API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = typeof data?.detail === 'string' ? data.detail : '';
    } catch {
      detail = '';
    }
    const error = new Error(detail || `Şablon işlemi başarısız (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function listGroupTemplates() {
  const data = await request('');
  return Array.isArray(data?.templates) ? data.templates : [];
}

export function getGroupTemplate(templateId) {
  return request(`/${encodeURIComponent(templateId)}`);
}

export function createGroupTemplate(name, payload) {
  return request('', { method: 'POST', body: { name, payload } });
}

export function renameGroupTemplate(templateId, name) {
  return request(`/${encodeURIComponent(templateId)}`, { method: 'PATCH', body: { name } });
}

export function deleteGroupTemplate(templateId) {
  return request(`/${encodeURIComponent(templateId)}`, { method: 'DELETE' });
}
