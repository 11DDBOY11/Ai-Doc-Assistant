import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import QASearch from './components/QASearch';
import DocumentHub from './components/DocumentHub';
import ChunkExplorer from './components/ChunkExplorer';
import AuditLogs from './components/AuditLogs';
import SensitivitySettings from './components/SensitivitySettings';
import GroqModal from './components/GroqModal';

import {
  fetchHealth,
  fetchDocuments,
  uploadTextDocument,
  uploadFileDocument,
  deleteDocument,
  fetchDocumentChunks,
  queryAssistant,
  fetchHistory,
  exportSessionData,
  loadSampleDocs,
} from './services/api';

const SESSION_STORAGE_KEY = 'docassist_chat_session_v2';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export default function App() {
  const storedSession = getStoredSession();

  const [activeTab, setActiveTab] = useState('qa');
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [chunks, setChunks] = useState([]);
  const [selectedDocIdForChunks, setSelectedDocIdForChunks] = useState(null);
  const [history, setHistory] = useState([]);

  // Chat conversation state (restored from 2-hour session storage)
  const [messages, setMessages] = useState(() => storedSession?.messages || []);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(() => storedSession?.expiresAt || null);

  // Query and parameters state
  const [scopeDocId, setScopeDocId] = useState(() => storedSession?.scopeDocId ?? null);
  const [threshold, setThreshold] = useState(() => storedSession?.threshold ?? 0.2);
  const [topK, setTopK] = useState(3);
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('groq_api_key') || '');
  const [queryResult, setQueryResult] = useState(null);

  // UI state
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [groqModalOpen, setGroqModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadInitialData = async () => {
    try {
      const [healthData, docData, histData] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchDocuments().catch(() => ({ documents: [] })),
        fetchHistory(20).catch(() => ({ history: [] })),
      ]);

      if (healthData) setHealth(healthData);
      if (docData?.documents) {
        setDocuments(docData.documents);
        loadAllChunks(docData.documents);
      }
      if (histData?.history) setHistory(histData.history);
    } catch (err) {
      console.error('Initial load failure:', err);
    }
  };

  const loadAllChunks = async (docs) => {
    setLoadingChunks(true);
    try {
      const all = [];
      for (const d of docs) {
        const res = await fetchDocumentChunks(d.id).catch(() => ({ chunks: [] }));
        if (res.chunks) {
          for (const c of res.chunks) {
            all.push({ ...c, doc_title: d.title });
          }
        }
      }
      setChunks(all);
    } catch (err) {
      console.error('Failed to load chunks:', err);
    } finally {
      setLoadingChunks(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSaveGroqKey = (key) => {
    setGroqKey(key);
    if (key) {
      localStorage.setItem('groq_api_key', key);
      showToast('Groq API Key saved for this session.', 'success');
    } else {
      localStorage.removeItem('groq_api_key');
      showToast('Groq API Key removed. Using local fallback.', 'info');
    }
  };

  // Auto-persist conversation to 2-Hour Local Session Storage
  useEffect(() => {
    if (messages.length > 0) {
      let expiresAt = sessionExpiresAt;
      if (!expiresAt || expiresAt < Date.now()) {
        expiresAt = Date.now() + TWO_HOURS_MS;
        setSessionExpiresAt(expiresAt);
      }
      const sessionData = {
        messages,
        scopeDocId,
        threshold,
        expiresAt,
        updatedAt: Date.now(),
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    }
  }, [messages, scopeDocId, threshold, sessionExpiresAt]);

  const handleClearChat = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setMessages([]);
    setSessionExpiresAt(null);
    setQueryResult(null);
    showToast('Chat conversation cleared.', 'info');
  };

  const handleRunQuery = async (queryText) => {
    setLoadingQuery(true);
    try {
      const resp = await queryAssistant({
        query: queryText,
        top_k: topK,
        filter_doc_id: scopeDocId,
        threshold,
        groq_api_key: groqKey,
        groq_model: groqModel,
      });

      if (resp?.result) {
        setQueryResult(resp.result);
        const newMsg = {
          id: Date.now(),
          query: queryText,
          result: resp.result,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMsg]);

        // Refresh audit logs
        fetchHistory(20).then((res) => {
          if (res?.history) setHistory(res.history);
        });
      }
    } catch (err) {
      showToast(err.message || 'Query failed', 'error');
    } finally {
      setLoadingQuery(false);
    }
  };

  const handleUploadText = async (title, content) => {
    const res = await uploadTextDocument(title, content);
    showToast(`"${res.title}" indexed with ${res.total_chunks} chunks.`, 'success');
    await loadInitialData();
  };

  const handleUploadFile = async (file, customTitle) => {
    const res = await uploadFileDocument(file, customTitle);
    showToast(`"${res.title}" parsed and indexed.`, 'success');
    await loadInitialData();
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm('Delete this document and all associated chunks?')) return;
    try {
      await deleteDocument(id);
      showToast('Document deleted.', 'info');
      await loadInitialData();
      if (scopeDocId === id) setScopeDocId(null);
    } catch (err) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const handleViewChunks = (docId) => {
    setSelectedDocIdForChunks(docId);
    setActiveTab('chunks');
  };

  const handleLoadSamples = async () => {
    setLoadingSamples(true);
    try {
      const res = await loadSampleDocs();
      showToast(`Loaded ${res.loaded_documents?.length || 0} benchmark documents!`, 'success');
      await loadInitialData();
    } catch (err) {
      showToast(err.message || 'Failed to load samples', 'error');
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleExportSession = async () => {
    setIsExporting(true);
    try {
      const data = await exportSessionData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `docassist_session_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Session audit exported to JSON.', 'success');
    } catch (err) {
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        health={health}
        groqKey={groqKey}
        onOpenGroqModal={() => setGroqModalOpen(true)}
        onLoadSamples={handleLoadSamples}
        loadingSamples={loadingSamples}
      />

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col lg:flex-row">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onExport={handleExportSession}
          isExporting={isExporting}
        />

        {/* Content Pane */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'qa' && (
            <QASearch
              documents={documents}
              scopeDocId={scopeDocId}
              setScopeDocId={setScopeDocId}
              sensitivityThreshold={threshold}
              groqKey={groqKey}
              onRunQuery={handleRunQuery}
              loading={loadingQuery}
              messages={messages}
              sessionExpiresAt={sessionExpiresAt}
              onClearChat={handleClearChat}
            />
          )}

          {activeTab === 'docs' && (
            <DocumentHub
              documents={documents}
              onUploadText={handleUploadText}
              onUploadFile={handleUploadFile}
              onDeleteDocument={handleDeleteDocument}
              onViewChunks={handleViewChunks}
            />
          )}

          {activeTab === 'chunks' && (
            <ChunkExplorer
              documents={documents}
              chunks={
                selectedDocIdForChunks
                  ? chunks.filter((c) => c.document_id === selectedDocIdForChunks)
                  : chunks
              }
              selectedDocId={selectedDocIdForChunks}
              onSelectDoc={setSelectedDocIdForChunks}
              loadingChunks={loadingChunks}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogs
              history={history}
              onRefresh={() => {
                setLoadingHistory(true);
                fetchHistory(50)
                  .then((res) => {
                    if (res?.history) setHistory(res.history);
                  })
                  .finally(() => setLoadingHistory(false));
              }}
              loadingHistory={loadingHistory}
            />
          )}

          {activeTab === 'sensitivity' && (
            <SensitivitySettings
              threshold={threshold}
              setThreshold={setThreshold}
              topK={topK}
              setTopK={setTopK}
              groqModel={groqModel}
              setGroqModel={setGroqModel}
            />
          )}
        </main>
      </div>

      {/* Groq Key Modal */}
      <GroqModal
        isOpen={groqModalOpen}
        onClose={() => setGroqModalOpen(false)}
        groqKey={groqKey}
        onSaveKey={handleSaveGroqKey}
        serverConfigured={health?.groq_configured}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <div className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-zinc-950 text-white border border-zinc-800 shadow-xl flex items-center gap-2">
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
