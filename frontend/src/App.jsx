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

export default function App() {
  const [activeTab, setActiveTab] = useState('qa');
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [chunks, setChunks] = useState([]);
  const [selectedDocIdForChunks, setSelectedDocIdForChunks] = useState(null);
  const [history, setHistory] = useState([]);

  // Query and parameters state
  const [scopeDocId, setScopeDocId] = useState(null);
  const [threshold, setThreshold] = useState(0.2);
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
    showToast(`"${res.title}" indexed successfully with ${res.total_chunks} chunks.`, 'success');
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
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
              queryResult={queryResult}
              loading={loadingQuery}
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
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-3.5 py-2 rounded-lg text-xs font-medium border shadow-lg flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-800'
                : toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
                : 'bg-zinc-900 text-zinc-200 border-zinc-700'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
