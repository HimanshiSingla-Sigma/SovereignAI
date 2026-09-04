import React, { useState, useEffect } from 'react';
import { BookOpen, Upload, FileText, CheckCircle2, Shield, Eye, Search } from 'lucide-react';
import { apiClient } from '../../services/api';

export const DocumentsView: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState('INTERNAL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDocs = async () => {
    try {
      const res = await apiClient.get('/documents');
      setDocuments(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);
    formData.append('classification', classification);

    try {
      await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFile(null);
      setTitle('');
      await fetchDocs();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Document upload and local OCR processing failed.');
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.doc_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getClassificationBadge = (lvl: string) => {
    switch (lvl) {
      case 'RESTRICTED': return 'bg-rose-900/60 text-rose-300 border-rose-700';
      case 'CONFIDENTIAL': return 'bg-amber-900/60 text-amber-300 border-amber-700';
      case 'INTERNAL': return 'bg-cyan-900/60 text-cyan-300 border-cyan-700';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">PRIVATE DOCUMENT INTELLIGENCE & OCR</h2>
          <p className="text-xs text-slate-400">Local Zero-Cloud Ingestion, Scanned PDF OCR, Classification & Dense Vector Indexing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form Panel */}
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">INGEST NEW TECHNICAL MANUAL</h3>
          </div>

          <form onSubmit={handleUpload} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 mb-1">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SOP-MNT-099: Spindle Bearings"
                className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Data Classification Level</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-cyan-400 font-bold focus:outline-none focus:border-cyan-500"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="INTERNAL">INTERNAL</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="RESTRICTED">RESTRICTED</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Select File (PDF, TXT, MD, Image)</label>
              <input
                type="file"
                accept=".pdf,.txt,.md,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                className="w-full text-slate-400 text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-industrial-800 file:text-cyan-400 file:font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition shadow-sm"
            >
              {uploading ? 'Extracting via Local OCR & Indexing...' : 'Upload & Index Document'}
            </button>
          </form>
        </div>

        {/* Document Library Table */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">INDEXED SOVEREIGN REPOSITORY</h3>
            </div>
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search manuals..."
                className="w-full pl-8 pr-3 py-1.5 bg-industrial-950 border border-industrial-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-industrial-800 text-slate-400 text-left">
                  <th className="p-2">Doc ID</th>
                  <th className="p-2">Title</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Classification</th>
                  <th className="p-2">Pages</th>
                  <th className="p-2">Index Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.doc_id} className="border-b border-industrial-800/40 hover:bg-industrial-800/20">
                    <td className="p-2 text-cyan-400 font-bold">{doc.doc_id}</td>
                    <td className="p-2 text-slate-200">{doc.title}</td>
                    <td className="p-2 text-slate-400">{doc.file_type}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${getClassificationBadge(doc.classification)}`}>
                        {doc.classification}
                      </span>
                    </td>
                    <td className="p-2 text-slate-300">{doc.page_count}</td>
                    <td className="p-2">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>INDEXED</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
