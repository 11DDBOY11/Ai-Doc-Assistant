/**
 * API client for the AI Document Assistant backend.
 * Uses window.location.origin in production or localhost:8000 fallback.
 */

const API_BASE = window.location.port === '3000' ? '' : (window.location.origin.includes('localhost') ? 'http://localhost:8000' : '');

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchDocuments() {
  const res = await fetch(`${API_BASE}/api/documents`);
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.statusText}`);
  return res.json();
}

export async function uploadTextDocument(title, content) {
  const res = await fetch(`${API_BASE}/api/documents/upload-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadFileDocument(file, title = '') {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);

  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `File upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteDocument(docId) {
  const res = await fetch(`${API_BASE}/api/documents/${docId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
  return res.json();
}

export async function fetchDocumentChunks(docId) {
  const res = await fetch(`${API_BASE}/api/documents/${docId}/chunks`);
  if (!res.ok) throw new Error(`Failed to load chunks: ${res.statusText}`);
  return res.json();
}

export async function queryAssistant({
  query,
  top_k = 3,
  filter_doc_id = null,
  threshold = 0.2,
  groq_api_key = null,
  groq_model = 'llama-3.3-70b-versatile',
}) {
  const headers = { 'Content-Type': 'application/json' };
  if (groq_api_key) {
    headers['X-Groq-Api-Key'] = groq_api_key;
  }

  const res = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      top_k,
      filter_doc_id: filter_doc_id ? Number(filter_doc_id) : null,
      threshold: Number(threshold),
      groq_api_key: groq_api_key || null,
      groq_model,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Query failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchHistory(limit = 25) {
  const res = await fetch(`${API_BASE}/api/history?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.statusText}`);
  return res.json();
}

export async function exportSessionData() {
  const res = await fetch(`${API_BASE}/api/export`);
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  return res.json();
}

export async function loadSampleDocs() {
  const res = await fetch(`${API_BASE}/api/sample-docs/load`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Sample docs load failed: ${res.statusText}`);
  return res.json();
}
