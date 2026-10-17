import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Upload, Receipt as ReceiptIcon, Check,
  AlertCircle, ArrowLeft, Plus, Trash2
} from 'lucide-react';
import { apiRequest } from '../services/api';

export const ReceiptScanPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [storeName, setStoreName] = useState('');
  const [lines, setLines] = useState<any[]>([]);
  const [addToPantry, setAddToPantry] = useState(true);
  const [pantryLocation, setPantryLocation] = useState('despensa');
  const [isConfirming, setIsConfirming] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await apiRequest('/receipts/scan', {
        method: 'POST',
        body: formData
      });
      setReceipt(data);
      setStoreName(data.store_name || '');
      setLines(data.lines || []);
    } catch (err: any) {
      alert(`Error al escanear ticket: ${err.message || err}`);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateLine = (idx: number, field: string, value: any) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    if (!receipt) return;
    setIsConfirming(true);
    try {
      await apiRequest(`/receipts/${receipt.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          store_name: storeName,
          receipt_date: receipt.receipt_date,
          lines: lines,
          add_selected_to_pantry: addToPantry,
          pantry_location: pantryLocation
        })
      });
      alert('¡Ticket confirmado! Precios registrados y productos añadidos a la despensa.');
      navigate('/pantry');
    } catch (err: any) {
      alert(`Error confirmando ticket: ${err.message || err}`);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-20">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Lectura de Tickets</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Escanea tickets para registrar precios y reponer despensa</p>
        </div>
      </div>

      {!receipt ? (
        <div className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Fotografiar o subir ticket</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Utiliza la cámara del móvil o sube una imagen/PDF de tu compra en Mercadona, Carrefour, Lidl, etc.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20"
          >
            {isScanning ? 'Extrayendo productos con OCR e IA...' : 'Hacer foto al ticket'}
          </button>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Supermercado</span>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="block text-base font-bold text-white bg-transparent border-b border-zinc-700 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Importe Total</span>
              <p className="text-lg font-black text-amber-400 font-mono">
                {receipt.total_amount?.toFixed(2)} €
              </p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Artículos Detectados ({lines.length})
            </h4>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-center justify-between gap-2"
                >
                  <input
                    type="text"
                    value={line.product_name}
                    onChange={(e) => updateLine(idx, 'product_name', e.target.value)}
                    className="flex-1 bg-transparent text-xs font-semibold text-white focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                      className="w-14 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-white text-center"
                    />
                    <span className="text-[11px] text-zinc-500">{line.unit}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={line.line_total}
                      onChange={(e) => updateLine(idx, 'line_total', Number(e.target.value))}
                      className="w-16 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-amber-400 font-mono font-bold text-center"
                    />
                    <span className="text-xs text-zinc-400">€</span>
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-zinc-600 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add to Pantry Options */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={addToPantry}
                onChange={(e) => setAddToPantry(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-zinc-900 border-zinc-700"
              />
              <span className="text-xs font-bold text-zinc-200">
                Añadir automáticamente los artículos confirmados a la despensa
              </span>
            </label>

            {addToPantry && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-xs text-zinc-400">Ubicación destino:</span>
                <select
                  value={pantryLocation}
                  onChange={(e) => setPantryLocation(e.target.value)}
                  className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                >
                  <option value="despensa">Despensa</option>
                  <option value="nevera">Nevera</option>
                  <option value="congelador">Congelador</option>
                </select>
              </div>
            )}
          </div>

          {/* Confirm Button */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setReceipt(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
            >
              Descartar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-lg shadow-amber-500/20"
            >
              {isConfirming ? 'Registrando precios...' : 'Confirmar e incorporar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
