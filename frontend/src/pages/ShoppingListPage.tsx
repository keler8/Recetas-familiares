import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, Plus, CheckSquare, Square, Trash2,
  Receipt, Sparkles, Store, ArrowRight, CheckCircle2
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export const ShoppingListPage: React.FC = () => {
  const { t } = useLanguage();
  const [lists, setLists] = useState<any[]>([]);
  const [activeList, setActiveList] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('unidad');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genMode, setGenMode] = useState('smart');

  const fetchLists = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/shopping/lists');
      setLists(data);
      if (data.length > 0 && !activeList) {
        setActiveList(data[0]);
      } else if (activeList) {
        const found = data.find((l: any) => l.id === activeList.id);
        setActiveList(found || data[0] || null);
      }
    } catch (err) {
      console.warn('Error fetching shopping lists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleCreateList = async () => {
    const title = prompt('Nombre de la lista (ej. Mercadona o Compra semanal):');
    if (!title) return;
    try {
      const created = await apiRequest('/shopping/lists', {
        method: 'POST',
        body: JSON.stringify({ title })
      });
      await fetchLists();
      setActiveList(created);
    } catch (err) {
      console.warn('Error creating list:', err);
    }
  };

  const handleAddItem = async () => {
    if (!activeList || !newItemName.trim()) return;
    try {
      await apiRequest(`/shopping/lists/${activeList.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          product_name: newItemName,
          amount: newItemAmount,
          unit: newItemUnit
        })
      });
      setNewItemName('');
      setNewItemAmount(1);
      await fetchLists();
    } catch (err) {
      console.warn('Error adding item:', err);
    }
  };

  const toggleCheckItem = async (item: any) => {
    const willBeChecked = !item.is_checked;
    let addToPantry = false;
    let pantryLocation = 'despensa';

    if (willBeChecked && !item.added_to_pantry) {
      addToPantry = window.confirm(`¿Quieres añadir "${item.product_name}" directamente a la despensa del hogar?`);
    }

    try {
      await apiRequest(`/shopping/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_checked: willBeChecked,
          add_to_pantry: addToPantry,
          pantry_location: pantryLocation
        })
      });
      await fetchLists();
    } catch (err) {
      console.warn('Error updating item check:', err);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await apiRequest(`/shopping/items/${itemId}`, { method: 'DELETE' });
      await fetchLists();
    } catch (err) {
      console.warn('Error deleting item:', err);
    }
  };

  const handleGenerate = async () => {
    try {
      const res = await apiRequest('/shopping/generate', {
        method: 'POST',
        body: JSON.stringify({
          title: `Lista inteligente (${genMode})`,
          mode: genMode
        })
      });
      setShowGenerateModal(false);
      await fetchLists();
      setActiveList(res);
    } catch (err: any) {
      alert(`Error generando lista: ${err.message || err}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t('shopping')}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Colaboración familiar en tiempo real y tickets</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/receipts"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 font-bold text-xs"
          >
            <Receipt className="w-4 h-4 text-amber-400" />
            <span>Escanear Ticket</span>
          </Link>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('generate_list')}</span>
          </button>
        </div>
      </div>

      {/* Lists Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {lists.map(l => (
          <button
            key={l.id}
            onClick={() => setActiveList(l)}
            className={`px-4 py-2 rounded-xl font-bold transition-colors border ${
              activeList?.id === l.id
                ? 'bg-amber-500 text-zinc-950 border-amber-500'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {l.title}
          </button>
        ))}
        <button
          onClick={handleCreateList}
          className="px-3 py-2 rounded-xl bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva lista</span>
        </button>
      </div>

      {/* Active List Content */}
      {activeList ? (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-base font-bold text-white">{activeList.title}</h3>
            <span className="text-xs text-zinc-500 font-medium">
              {activeList.items?.filter((i: any) => i.is_checked).length} de {activeList.items?.length || 0} comprados
            </span>
          </div>

          {/* Add item inline bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Añadir artículo a la lista..."
              className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={newItemAmount}
              onChange={(e) => setNewItemAmount(Number(e.target.value))}
              className="w-16 px-2 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white text-center"
            />
            <button
              onClick={handleAddItem}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
            >
              Añadir
            </button>
          </div>

          {/* Items List */}
          <div className="space-y-1.5 pt-2">
            {activeList.items?.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-6 text-center">La lista está vacía.</p>
            ) : (
              activeList.items?.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => toggleCheckItem(item)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    item.is_checked
                      ? 'bg-zinc-950/60 border-zinc-800/40 text-zinc-500 line-through'
                      : 'bg-zinc-950 border-zinc-800/80 text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button className="text-amber-400">
                      {item.is_checked ? <CheckSquare className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5 text-zinc-600" />}
                    </button>
                    <div>
                      <span className="text-sm font-semibold">{item.product_name}</span>
                      {item.notes && <p className="text-[10px] text-amber-400/80 no-underline">{item.notes}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-zinc-400">
                      {item.amount} {item.unit}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id);
                      }}
                      className="p-1 rounded text-zinc-600 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-zinc-500 text-xs">Crea o selecciona una lista de la compra.</div>
      )}

      {/* Generate List Modal (3 Modes) */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-white">Generar Lista Automática</h3>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">Modo de cálculo</label>
              <div className="space-y-2">
                {[
                  { id: 'smart', title: 'Compra inteligente', desc: 'Descuenta las existencias registradas en despensa' },
                  { id: 'complete', title: 'Compra completa', desc: 'Todos los ingredientes sin mirar despensa' },
                  { id: 'assisted', title: 'Compra asistida', desc: 'Muestra existencias como sugerencias antes de comprar' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setGenMode(m.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      genMode === m.id
                        ? 'bg-amber-500/10 border-amber-500/50 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-amber-400">{m.title}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400"
              >
                Generar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
