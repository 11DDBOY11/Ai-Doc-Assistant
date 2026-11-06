import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  Plus,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function DocumentHub({
  documents,
  onUploadText,
  onUploadFile,
  onDeleteDocument,
  onViewChunks,
}) {
  const [activeUploadTab, setActiveUploadTab] = useState('file'); // 'file' or 'text'
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileTitle, setFileTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textTitle.trim() || !textContent.trim()) {
      setErrorMsg('Title and content are required.');
      return;
    }
    setErrorMsg('');
    setIsUploading(true);
    try {
      await onUploadText(textTitle.trim(), textContent.trim());
      setSuccessMsg('Document indexed successfully.');
      setTextTitle('');
      setTextContent('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a file to upload.');
      return;
    }
    setErrorMsg('');
    setIsUploading(true);
    try {
      await onUploadFile(selectedFile, fileTitle.trim());
      setSuccessMsg('File uploaded and indexed.');
      setSelectedFile(null);
      setFileTitle('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Upload Box */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div>
            <h2 className="text-sm font-bold text-zinc-950">Document Ingestion</h2>
            <p className="text-xs text-zinc-600">
              Upload PDF, Word (.docx), Markdown, TXT, CSV, JSON files or paste raw text.
            </p>
          </div>

          {/* Toggle Tab */}
          <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs">
            <button
              onClick={() => setActiveUploadTab('file')}
              className={`px-3 py-1 rounded-md transition ${
                activeUploadTab === 'file'
                  ? 'bg-zinc-950 text-white font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Upload File
            </button>
            <button
              onClick={() => setActiveUploadTab('text')}
              className={`px-3 py-1 rounded-md transition ${
                activeUploadTab === 'text'
                  ? 'bg-zinc-950 text-white font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Paste Text
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-zinc-800" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-zinc-900" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* Tab 1: File Upload */}
        {activeUploadTab === 'file' && (
          <form onSubmit={handleFileSubmit} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                  Optional Custom Title
                </label>
                <input
                  type="text"
                  placeholder="Defaults to filename"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                  Select File (.docx, .pdf, .md, .txt, .csv, .json)
                </label>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt,.md,.markdown,.csv,.json"
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                  className="w-full text-xs text-zinc-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:text-zinc-800 hover:file:bg-zinc-100 file:cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="px-4 py-2 rounded-md bg-zinc-950 hover:bg-black text-white text-xs font-semibold transition disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Indexing...' : 'Index File'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Text Ingestion */}
        {activeUploadTab === 'text' && (
          <form onSubmit={handleTextSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                Document Title
              </label>
              <input
                type="text"
                placeholder="e.g., Cloud Native Architecture Guide"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                Content (Markdown supported)
              </label>
              <textarea
                rows={5}
                placeholder="Paste technical documentation or policies here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 rounded-md px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 font-mono"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isUploading || !textTitle.trim() || !textContent.trim()}
                className="px-4 py-2 rounded-md bg-zinc-950 hover:bg-black text-white text-xs font-semibold transition disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Indexing...' : 'Index Text'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Document Library Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Indexed Document Library</h3>
            <p className="text-xs text-zinc-600">
              {documents.length} document{documents.length === 1 ? '' : 's'} indexed in Hybrid Vector Store.
            </p>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No documents indexed yet. Upload one above or click "Load Benchmark Docs" in the top bar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 text-zinc-700 border-b border-zinc-200 font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-2.5">Document Title</th>
                  <th className="px-4 py-2.5">Filename</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5">Chunks</th>
                  <th className="px-4 py-2.5">Indexed At</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50 transition">
                    <td className="px-4 py-3 font-semibold text-zinc-950 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-zinc-700 shrink-0" />
                      <span>{doc.title}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 text-[11px]">
                      {doc.filename}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-800 font-mono text-[10px] font-semibold">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 text-[11px]">
                      {formatSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-950 font-bold text-[11px]">
                      {doc.total_chunks}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-[11px]">
                      {doc.uploaded_at ? doc.uploaded_at.slice(0, 16) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewChunks(doc.id)}
                          className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded border border-zinc-200 transition"
                          title="Inspect chunks"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteDocument(doc.id)}
                          className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded border border-zinc-200 transition"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
