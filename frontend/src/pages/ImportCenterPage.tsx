import React, { useState, useEffect, useRef } from 'react';
import {
  Folder, UploadCloud, Instagram, Sparkles, Check,
  AlertCircle, Trash2, Edit3, ArrowRight, CheckCircle2,
  Clock, FileText, ChevronRight
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export const ImportCenterPage: React.FC = () => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [isImportingIg, setIsImportingIg] = useState(false);
  const [driveStatus, setDriveStatus] = useState<any>(null);

  const fetchBatches = async () => {
    try {
      const data = await apiRequest('/imports/batches');
      setBatches(data);
      if (data.length > 0 && !selectedBatch) {
        setSelectedBatch(data[0]);
      }
    } catch (err) {
      console.warn('Error fetching import batches:', err);
    }
  };

  const fetchDriveStatus = async () => {
    try {
      const data = await apiRequest('/drive/status');
      setDriveStatus(data);
    } catch (err) {
      console.warn('Error checking drive:', err);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchDriveStatus();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const newBatch = await apiRequest('/imports/upload', {
        method: 'POST',
        body: formData
      });
      await fetchBatches();
      setSelectedBatch(newBatch);
    } catch (err: any) {
      alert(`Error al procesar archivo: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInstagramImport = async () => {
    if (!instagramUrl.trim()) return;
    setIsImportingIg(true);
    try {
      const newBatch = await apiRequest('/imports/instagram', {
        method: 'POST',
        body: JSON.stringify({ url: instagramUrl })
      });
      setInstagramUrl('');
      await fetchBatches();
      setSelectedBatch(newBatch);
    } catch (err: any) {
      alert(`Error importando Instagram: ${err.message || err}`);
    } finally {
      setIsImportingIg(false);
    }
  };

  const reviewDraft = async (draftId: number, action: 'approve' | 'discard') => {
    try {
      await apiRequest(`/imports/drafts/${draftId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      await fetchBatches();
      if (selectedBatch) {
        const updated = await apiRequest(`/imports/batches/${selectedBatch.id}`);
        setSelectedBatch(updated);
      }
    } catch (err: any) {
      alert(`Error al revisar borrador: ${err.message || err}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.txt"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header matching Screenshot 2 */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Centro de importación</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Diseño funcional propuesto</p>
      </div>

      {/* Two Big Action Cards matching Screenshot 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Google Drive Card */}
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{t('google_drive')}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{t('drive_hint')}</p>
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-zinc-500">{driveStatus?.status || 'Comprobando...'}</span>
            <button
              onClick={() => alert('Para conectar Google Drive, configura GOOGLE_DRIVE_CLIENT_ID en el archivo .env')}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs"
            >
              Conectar
            </button>
          </div>
        </div>

        {/* Subir archivos Card */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900/80 transition-all flex flex-col justify-between text-left space-y-4 group"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{t('upload_files')}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{t('upload_hint')}</p>
            </div>
          </div>
          <div className="pt-2 flex items-center text-xs font-bold text-amber-400">
            <span>{isUploading ? 'Procesando con OCR e IA...' : 'Seleccionar archivo local'}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </button>
      </div>

      {/* Instagram Importer Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
        <div className="flex items-center gap-2">
          <Instagram className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white">Importar desde Instagram Reel o Vídeo</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="Pega la URL del post o reel (ej. https://www.instagram.com/reel/...)"
            className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
          />
          <button
            onClick={handleInstagramImport}
            disabled={isImportingIg || !instagramUrl}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {isImportingIg ? 'Analizando audio...' : t('import_btn')}
          </button>
        </div>
      </div>

      {/* Processed Batch Progress Card matching Screenshot 2 */}
      {selectedBatch ? (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Lote: {selectedBatch.source_name || selectedBatch.source_type}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                  {selectedBatch.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {selectedBatch.total_detected} {t('recipes_identified')}
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {new Date(selectedBatch.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Segmented Progress Bar matching Screenshot 2 */}
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${selectedBatch.total_detected > 0 ? (selectedBatch.approved_count / selectedBatch.total_detected) * 100 : 0}%` }}
                title={`${selectedBatch.approved_count} publicadas`}
              />
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${selectedBatch.total_detected > 0 ? (selectedBatch.pending_count / selectedBatch.total_detected) * 100 : 0}%` }}
                title={`${selectedBatch.pending_count} pendientes`}
              />
              <div
                className="bg-zinc-600 h-full transition-all duration-500"
                style={{ width: `${selectedBatch.total_detected > 0 ? (selectedBatch.duplicate_count / selectedBatch.total_detected) * 100 : 0}%` }}
                title={`${selectedBatch.duplicate_count} duplicadas`}
              />
            </div>

            {/* Metrics Legend matching Screenshot 2 */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{selectedBatch.approved_count} {t('published')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{selectedBatch.pending_count} {t('pending')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                <span>{selectedBatch.duplicate_count} {t('duplicate')}</span>
              </div>
            </div>
          </div>

          {/* Individual Drafts Queue for Review */}
          <div className="pt-3 border-t border-zinc-800 space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Recetas detectadas en este documento
            </h4>

            <div className="space-y-2">
              {selectedBatch.drafts?.map((draft: any) => (
                <div
                  key={draft.id}
                  className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{draft.title}</span>
                      {draft.status === 'duplicate' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                          Duplicada
                        </span>
                      )}
                      {draft.status === 'approved' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Publicada
                        </span>
                      )}
                    </div>
                    {draft.uncertainty_notes && (
                      <p className="text-[11px] text-amber-400/80">
                        {draft.uncertainty_notes}
                      </p>
                    )}
                  </div>

                  {draft.status === 'pending_review' || draft.status === 'duplicate' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => reviewDraft(draft.id, 'discard')}
                        className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400"
                        title={t('discard')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => reviewDraft(draft.id, 'approve')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>{t('approve')}</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500 italic">Completada</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-zinc-500 text-xs">
          Sube un documento PDF o pega un Reel para ver el lote procesado y revisar recetas.
        </div>
      )}
    </div>
  );
};
