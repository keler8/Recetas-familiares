import React, { useState, useEffect } from 'react';
import {
  Package, Plus, AlertTriangle, Minus, Trash2,
  Calendar, Check, Filter, Search
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export const PantryPage: React.FC = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('unidad');
  const [newItemLocation, setNewItemLocation] = useState('despensa');
  const [newItemExpiry, setNewItemExpiry] = useState('');

  const fetchPantry = async () => {
    setLoading(true);
    try {
      const url = selectedLocation ? `/pantry?location=${selectedLocation}` : '/pantry';
      const data = await apiRequest(url);
      setItems(data);
    } catch (err) {
      console.warn('Error fetching pantry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPantry();
  }, [selectedLocation]);

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await apiRequest('/pantry', {
        method: 'POST',
        body: JSON.stringify({
          product_name: newItemName,
          quantity: newItemQty,
          unit: newItemUnit,
          location: newItemLocation,
          expiry_date: newItemExpiry || null
        })
      });
      setShowAddModal(false);
      setNewItemName('');
      setNewItemQty(1);
      setNewItemExpiry('');
      await fetchPantry();
    } catch (err) {
      console.warn('Error adding item:', err);
    }
  };

  const handleConsume = async (id: number, amount: number) => {
    try {
      await apiRequest(`/pantry/${id}/consume?amount=${amount}`, { method: 'POST' });
      await fetchPantry();
    } catch (err) {
      console.warn('Error consuming:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/pantry/${id}`, { method: 'DELETE' });
      await fetchPantry();
    } catch (err) {
      console.warn('Error deleting:', err);
    }
  };

  const locations = [
    { id: '', label: 'Todo' },
    { id: 'despensa', label: 'Despensa' },
    { id: 'nevera', label: 'Nevera' },
    { id: 'congelador', label: 'Congelador' }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t('pantry')}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Control de existencias y caducidades del hogar</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>{t('add_product')}</span>
        </button>
      </div>

      {/* Location Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {locations.map(loc => (
          <button
            key={loc.id}
            onClick={() => setSelectedLocation(loc.id)}
            className={`px-4 py-2 rounded-xl font-bold transition-colors border ${
              selectedLocation === loc.id
                ? 'bg-amber-500 text-zinc-950 border-amber-500'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {loc.label}
          </button>
        ))}
      </div>

      {/* Pantry Items List */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 text-sm">Cargando despensa...</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 p-6">
          <Package className="w-12 h-12 text-zinc-600 mx-auto" />
          <p className="text-zinc-400 text-sm font-medium">No hay productos registrados en esta ubicación.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 divide-y divide-zinc-800/80 overflow-hidden">
          {items.map(item => (
            <div
              key={item.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-900/60 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{item.product_name}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 capitalize">
                    {item.location}
                  </span>
                </div>
                {item.expiry_date && (
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    <span>Caduca: {item.expiry_date}</span>
                  </p>
                )}
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => handleConsume(item.id, 1)}
                    className="p-1 rounded text-zinc-400 hover:text-white"
                    title="Consumir 1 unidad"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-bold text-amber-400 px-2">
                    {item.quantity} {item.unit}
                  </span>
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors"
                  title="Eliminar producto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-white">{t('add_product')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 font-medium">Nombre del producto</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="ej. Tomate triturado"
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-400 font-medium">Cantidad</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium">Unidad</label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  >
                    <option value="unidad">unidad</option>
                    <option value="g">gramos (g)</option>
                    <option value="kg">kilogramos (kg)</option>
                    <option value="ml">mililitros (ml)</option>
                    <option value="l">litros (l)</option>
                    <option value="lata">lata</option>
                    <option value="paquete">paquete</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">Ubicación</label>
                <select
                  value={newItemLocation}
                  onChange={(e) => setNewItemLocation(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                >
                  <option value="despensa">Despensa</option>
                  <option value="nevera">Nevera</option>
                  <option value="congelador">Congelador</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium">Fecha de caducidad (opcional)</label>
                <input
                  type="date"
                  value={newItemExpiry}
                  onChange={(e) => setNewItemExpiry(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
