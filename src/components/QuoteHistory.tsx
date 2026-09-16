import React, { useState, useMemo, useCallback } from 'react';
import { Quote, QuoteStatus, useQuoteHistory } from '../hooks/useQuoteHistory';
import { useToast } from '../hooks/useToast';
import { 
  Search, 
  Plus, 
  Archive, 
  Trash2, 
  ChevronRight, 
  FileText, 
  Link as LinkIcon, 
  Download, 
  RotateCcw, 
  MessageSquare, 
  ArrowRight, 
  X, 
  MessageCircle, 
  Inbox, 
  AlertTriangle, 
  Copy, 
  Settings, 
  Printer, 
  CheckSquare, 
  Square, 
  MinusSquare,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportQuoteToPDF } from '../lib/pdfHelper';
import { MessagePresetsModal } from './MessagePresetsModal';

interface QuoteHistoryProps {
  onNewQuote?: () => void;
  onCloneQuote?: (quote: Quote) => void;
  onEdit?: (quote: Quote) => void;
  onEditDraft?: (quote: Quote) => void;
  onPrint?: (quote: Quote) => void;
  onOpenPresetsModal?: () => void;
}

const formatMXN = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value);
};

const STATUS_ORDER: QuoteStatus[] = ['borrador', 'enviada', 'revision', 'aprobada', 'produccion', 'entregada'];

const STATUS_COLORS: Record<QuoteStatus, string> = {
  borrador: 'bg-[#F7F5F0] text-[#4B5563] border-gray-300',
  enviada: 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]',
  revision: 'bg-[#FEFCE8] text-[#854D0E] border-[#FEF08A]',
  aprobada: 'bg-[#F0FDF4] text-[#166534] border-[#82C69E]',
  produccion: 'bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]',
  entregada: 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]',
  cancelada: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
};

type SortField = 'folio' | 'clientName' | 'operatorName' | 'total' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export const QuoteHistory: React.FC<QuoteHistoryProps> = ({ 
  onNewQuote, 
  onCloneQuote, 
  onEdit, 
  onEditDraft, 
  onPrint, 
  onOpenPresetsModal 
}) => {
  const { quotes, updateStatus, updateNotes, archiveQuote, deleteQuote, cloneQuote } = useQuoteHistory();
  const { success, error, warning } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuoteStatus | 'todas' | 'archivadas'>('todas');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Selección múltiple para borrado y acciones por lote
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  // Stats
  const activeQuotes = useMemo(() => quotes.filter(q => !q.isArchived), [quotes]);
  
  const stats = useMemo(() => {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    
    const createdThisMonth = activeQuotes.filter(q => {
      const d = new Date(q.createdAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    const inProduction = activeQuotes.filter(q => q.status === 'produccion').length;
    
    const approvedRevenue = activeQuotes
      .filter(q => ['aprobada', 'produccion', 'entregada'].includes(q.status))
      .reduce((sum, q) => sum + q.total, 0);

    const approvalRate = activeQuotes.length > 0 
      ? (activeQuotes.filter(q => ['aprobada', 'produccion', 'entregada'].includes(q.status)).length / activeQuotes.length) * 100
      : 0;

    return {
      total: activeQuotes.length,
      thisMonth: createdThisMonth,
      inProduction,
      approvedRevenue,
      approvalRate
    };
  }, [activeQuotes]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const filteredQuotes = useMemo(() => {
    let filtered = quotes;

    // View Filter
    if (filter === 'archivadas') {
      filtered = filtered.filter(q => q.isArchived);
    } else if (filter !== 'todas') {
      filtered = filtered.filter(q => !q.isArchived && q.status === filter);
    } else {
      filtered = filtered.filter(q => !q.isArchived);
    }

    // Search text
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(q => 
        q.folio.toLowerCase().includes(s) || 
        q.clientName.toLowerCase().includes(s) || 
        q.operatorName.toLowerCase().includes(s)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      if (sortField === 'total') {
        return sortOrder === 'asc' ? a.total - b.total : b.total - a.total;
      }
      if (sortField === 'createdAt') {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valA = (a[sortField] || '').toString().toLowerCase();
      const valB = (b[sortField] || '').toString().toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [quotes, search, filter, sortField, sortOrder]);

  // Selección individual
  const toggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Seleccionar / Deseleccionar todos los visibles
  const visibleIds = useMemo(() => filteredQuotes.map(q => q.id), [filteredQuotes]);
  const isAllSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isSomeSelected = visibleIds.some(id => selectedIds.includes(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Deseleccionar todas las visibles
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Agregar todas las visibles que no estén seleccionadas aún
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // BUG 3: Await en handleDelete y feedback solo tras resolución exitosa
  const handleDelete = async (e: React.MouseEvent, q: Quote) => {
    e.stopPropagation();
    try {
      await deleteQuote(q.id);
      setSelectedIds(prev => prev.filter(id => id !== q.id));
      success(`Cotización ${q.folio} eliminada`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la cotización';
      error(msg, {
        label: "Archivar ahora",
        onClick: async () => {
          try {
            await archiveQuote(q.id);
            success(`Cotización ${q.folio} archivada`);
          } catch (archErr: unknown) {
            const archMsg = archErr instanceof Error ? archErr.message : 'Error al archivar';
            error(archMsg);
          }
        }
      });
    }
  };

  // BUG 3: Await en handleArchive
  const handleArchive = async (e: React.MouseEvent, q: Quote) => {
    e.stopPropagation();
    try {
      await archiveQuote(q.id);
      success(q.isArchived ? `Cotización ${q.folio} desarchivada` : `Cotización ${q.folio} archivada`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al archivar la cotización';
      error(msg);
    }
  };

  // Borrado masivo de seleccionadas
  const handleExecuteBatchDelete = async () => {
    if (selectedIds.length === 0 || isDeletingBatch) return;
    setIsDeletingBatch(true);
    let deletedCount = 0;
    let failedCount = 0;

    const idsToDelete = [...selectedIds];

    for (const id of idsToDelete) {
      try {
        await deleteQuote(id);
        deletedCount++;
      } catch (err: unknown) {
        console.error(`Fallo al eliminar cotización con id ${id}:`, err);
        failedCount++;
      }
    }

    setIsDeletingBatch(false);
    setShowBatchDeleteModal(false);
    setSelectedIds([]);

    if (deletedCount > 0 && failedCount === 0) {
      success(`${deletedCount} cotizaciones eliminadas exitosamente`);
    } else if (deletedCount > 0 && failedCount > 0) {
      warning(`Se eliminaron ${deletedCount} cotizaciones, pero ${failedCount} no se pudieron eliminar (requieren ser borrador o estar archivadas)`);
    } else if (failedCount > 0) {
      error(`No se pudieron eliminar ${failedCount} cotizaciones. Solo se pueden borrar borradores o cotizaciones archivadas.`);
    }
  };

  // Archivado masivo de seleccionadas
  const handleBatchArchive = async () => {
    if (selectedIds.length === 0 || isDeletingBatch) return;
    setIsDeletingBatch(true);
    let archivedCount = 0;

    for (const id of selectedIds) {
      try {
        await archiveQuote(id);
        archivedCount++;
      } catch (err: unknown) {
        console.error(`Fallo al archivar cotización con id ${id}:`, err);
      }
    }

    setIsDeletingBatch(false);
    setSelectedIds([]);
    success(`${archivedCount} cotizaciones actualizadas en archivo`);
  };

  const Highlight = ({ text }: { text: string }) => {
    if (!search.trim()) return <>{text}</>;
    const regex = new RegExp(`(${search})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((p, i) => 
          regex.test(p) ? <span key={i} className="bg-[#82C69E]/40 text-[#1B4D3E] font-bold px-0.5 rounded">{p}</span> : p
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border border-[#82C69E]/60 rounded-2xl shadow-sm relative overflow-hidden animate-in fade-in">
      
      {/* Stats Bar */}
      <div className="flex border-b border-gray-200 bg-[#F7F5F0] overflow-x-auto scrollbar-hide shrink-0">
        <div className="p-4 border-r border-gray-200 flex flex-col justify-center min-w-[150px]">
          <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">Cotizaciones</span>
          <span className="text-2xl font-mono font-black text-[#1B4D3E] mt-1">{stats.total}</span>
        </div>
        <div className="p-4 border-r border-gray-200 flex flex-col justify-center min-w-[150px]">
          <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">Este mes</span>
          <span className="text-2xl font-mono font-black text-[#1B4D3E] mt-1">{stats.thisMonth}</span>
        </div>
        <div className="p-4 border-r border-gray-200 flex flex-col justify-center min-w-[150px]">
          <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">En Producción</span>
          <span className="text-2xl font-mono font-black text-[#2E7D32] mt-1">{stats.inProduction}</span>
        </div>
        <div className="p-4 border-r border-gray-200 flex flex-col justify-center min-w-[200px]">
          <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">Ingresos Aprobados</span>
          <span className="text-2xl font-mono font-black text-[#1B4D3E] mt-1">{formatMXN(stats.approvedRevenue)}</span>
        </div>
        <div className="p-4 border-r border-gray-200 flex flex-col justify-center min-w-[150px]">
          <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">Tasa Aprobación</span>
          <span className="text-2xl font-mono font-black text-[#1B4D3E] mt-1">{stats.approvalRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Barra de Herramientas & Controles */}
      <div className="p-4 border-b border-gray-200 bg-white flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shrink-0">
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto overflow-hidden">
          <div className="relative border border-[#82C69E] focus-within:border-[#1B4D3E] bg-[#F7F5F0] rounded-xl min-w-[280px] shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
               type="text" 
               placeholder="Buscar folio, cliente, asesor..." 
               value={search}
               onChange={e => setSearch(e.target.value)}
               className="w-full bg-transparent px-10 py-2.5 text-xs font-medium outline-none text-[#2B2B2B] placeholder:text-gray-400"
            />
          </div>
          
          <div className="flex overflow-x-auto scrollbar-hide gap-1.5 items-center py-1">
            {['todas', 'borrador', 'enviada', 'revision', 'aprobada', 'produccion', 'entregada', 'archivadas'].map(mode => (
              <button 
                key={mode} 
                onClick={() => setFilter(mode as QuoteStatus | 'todas' | 'archivadas')}
                className={`px-3 py-1.5 text-[10px] font-mono border whitespace-nowrap uppercase tracking-widest transition-all rounded-lg font-bold ${
                  filter === mode 
                  ? 'border-[#1B4D3E] text-white bg-[#1B4D3E] shadow-xs' 
                  : 'border-gray-200 text-gray-600 hover:border-[#82C69E] hover:text-[#1B4D3E] bg-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        
        {onNewQuote && (
          <button 
            onClick={onNewQuote} 
            className="shrink-0 bg-[#1B4D3E] text-white px-5 py-2.5 rounded-xl border border-[#1B4D3E] hover:bg-[#2E7D32] transition-all uppercase font-mono text-xs font-bold tracking-wider flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus size={16} /> Nueva Cotización
          </button>
        )}
      </div>

      {/* Barra de Acciones por Lote (cuando hay cotizaciones seleccionadas) */}
      {selectedIds.length > 0 && (
        <div className="bg-[#1B4D3E] text-white px-4 py-3 border-b border-[#2E7D32] flex flex-wrap items-center justify-between gap-3 shadow-inner animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-[#82C69E] text-[#1B4D3E] text-xs font-black px-2.5 py-0.5 rounded-full font-mono">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold font-sans">
              {selectedIds.length === 1 ? 'cotización seleccionada' : 'cotizaciones seleccionadas'}
            </span>
            <button 
              onClick={handleClearSelection}
              className="text-xs text-gray-300 hover:text-white underline font-medium ml-2 cursor-pointer"
            >
              Deseleccionar todas
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchArchive}
              disabled={isDeletingBatch}
              className="bg-[#2E7D32] text-white hover:bg-[#388E3C] px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Archive size={14} /> Archivar Seleccionadas
            </button>
            
            <button
              type="button"
              onClick={() => setShowBatchDeleteModal(true)}
              disabled={isDeletingBatch}
              className="bg-red-600 text-white hover:bg-red-700 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Trash2 size={14} /> Eliminar Seleccionadas
            </button>
          </div>
        </div>
      )}

      {/* Table & List */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#F7F5F0] z-10 border-b border-gray-200 shadow-xs">
            <tr className="text-[10px] uppercase font-mono text-gray-600 font-bold">
              {/* Checkbox de Seleccionar Todos */}
              <th className="py-3.5 pl-4 pr-2 w-10">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center justify-center text-gray-500 hover:text-[#1B4D3E] transition-colors cursor-pointer"
                  title={isAllSelected ? "Deseleccionar todas las cotizaciones visibles" : "Seleccionar todas las cotizaciones visibles"}
                >
                  {isAllSelected ? (
                    <CheckSquare size={18} className="text-[#1B4D3E]" />
                  ) : isSomeSelected ? (
                    <MinusSquare size={18} className="text-[#2E7D32]" />
                  ) : (
                    <Square size={18} className="text-gray-400" />
                  )}
                </button>
              </th>
              <th className="py-3.5 pl-2 pr-4 cursor-pointer hover:text-[#1B4D3E] transition-colors" onClick={() => handleSort('folio')}>
                Folio {sortField === 'folio' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-3.5 pr-4 cursor-pointer hover:text-[#1B4D3E] transition-colors" onClick={() => handleSort('clientName')}>
                Cliente / Proyecto {sortField === 'clientName' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-3.5 pr-4 cursor-pointer hover:text-[#1B4D3E] transition-colors" onClick={() => handleSort('operatorName')}>Asesor</th>
              <th className="py-3.5 pr-4">Estado</th>
              <th className="py-3.5 pr-4 text-right cursor-pointer hover:text-[#1B4D3E] transition-colors" onClick={() => handleSort('total')}>
                Total {sortField === 'total' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-3.5 pr-4 cursor-pointer hover:text-[#1B4D3E] transition-colors" onClick={() => handleSort('createdAt')}>
                Fecha {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-3.5 pr-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                    <Inbox size={48} className="mb-2 opacity-30" />
                    <p className="font-mono text-xs uppercase tracking-wider font-bold text-gray-500">
                      {filter === 'todas' 
                        ? (search ? 'No hay resultados para la búsqueda.' : 'Aún no tienes cotizaciones guardadas.') 
                        : filter === 'archivadas' ? 'No tienes cotizaciones archivadas.' : `No hay cotizaciones con estado ${filter.toUpperCase()}.`}
                    </p>
                    {filter === 'todas' && !search && onNewQuote && (
                      <button 
                        onClick={onNewQuote} 
                        className="mt-4 text-[#1B4D3E] border-b border-[#1B4D3E] pb-0.5 uppercase font-mono text-[10px] tracking-widest font-bold hover:text-[#2E7D32] hover:border-[#2E7D32] transition-colors cursor-pointer"
                      >
                        Crear primera cotización
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredQuotes.map(quote => {
                const isSelected = selectedIds.includes(quote.id);
                return (
                  <React.Fragment key={quote.id}>
                    <tr 
                      className={`group hover:bg-[#F7F5F0]/60 transition-colors cursor-pointer ${expandedId === quote.id ? 'bg-[#F7F5F0]' : ''} ${isSelected ? 'bg-[#F0FDF4]' : ''}`}
                      onClick={() => setExpandedId(expandedId === quote.id ? null : quote.id)}
                    >
                      {/* Checkbox individual para seleccionar cuáles sí o cuáles no */}
                      <td className="py-3.5 pl-4 pr-2" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => toggleSelectOne(quote.id, e)}
                          className="flex items-center justify-center text-gray-400 hover:text-[#1B4D3E] transition-colors cursor-pointer"
                          title={isSelected ? "Deseleccionar esta cotización" : "Seleccionar esta cotización"}
                        >
                          {isSelected ? (
                            <CheckSquare size={17} className="text-[#1B4D3E]" />
                          ) : (
                            <Square size={17} className="text-gray-300 group-hover:text-gray-400" />
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 pl-2 pr-4 font-mono font-black text-xs text-[#1B4D3E]">
                        <Highlight text={quote.folio} />
                      </td>
                      <td className="py-3.5 pr-4 font-bold text-xs text-[#2B2B2B]">
                        <Highlight text={quote.clientName || 'Sin Nombre'} />
                      </td>
                      <td className="py-3.5 pr-4 text-xs font-mono text-gray-600">
                        <Highlight text={quote.operatorName} />
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold border ${STATUS_COLORS[quote.status]}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {quote.status}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono font-bold text-xs text-[#1B4D3E]">
                        {formatMXN(quote.total)}
                      </td>
                      <td className="py-3.5 pr-4 text-xs font-mono text-gray-500">
                        {format(new Date(quote.createdAt), "dd MMM yyyy", { locale: es })}
                      </td>
                      <td className="py-3.5 pr-6 text-right relative">
                        <div className="flex items-center justify-end gap-2.5">
                          <button 
                            type="button"
                            onClick={(e) => handleArchive(e, quote)} 
                            className="text-gray-400 hover:text-[#2E7D32] transition-colors p-1" 
                            title={quote.isArchived ? 'Desarchivar' : 'Archivar'}
                          >
                            <Archive size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => handleDelete(e, quote)} 
                            className="text-gray-400 hover:text-red-600 transition-colors p-1" 
                            title="Eliminar cotización"
                          >
                            <Trash2 size={15} />
                          </button>
                          <ChevronRight size={17} className={`text-gray-400 transition-transform duration-300 ${expandedId === quote.id ? 'rotate-90 text-[#1B4D3E]' : ''}`} />
                        </div>
                      </td>
                    </tr>
                    
                    {expandedId === quote.id && (
                      <tr className="bg-[#FAFAF9] border-b-2 border-[#82C69E]">
                        <td colSpan={8} className="p-0">
                          <QuoteDetail 
                            quote={quote} 
                            onAdvance={async (status, note) => {
                              try {
                                await updateStatus(quote.id, status, note);
                                success(`Estado actualizado a ${status}`);
                              } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : 'Error al actualizar estado';
                                error(msg);
                              }
                            }}
                            onRevert={async (status, note) => {
                              try {
                                await updateStatus(quote.id, status, note);
                                success(`Estado revertido a ${status}`);
                              } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : 'Error al revertir estado';
                                error(msg);
                              }
                            }}
                            onClone={async () => {
                              if (!onCloneQuote) return;
                              try {
                                const newQ = await cloneQuote(quote.id);
                                if (newQ) {
                                  success(`Cotización clonada como ${newQ.folio}`);
                                  onCloneQuote(newQ);
                                }
                              } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : 'Error al clonar cotización';
                                error(msg);
                              }
                            }}
                            canClone={Boolean(onCloneQuote)}
                            onEdit={() => {
                              if (onEdit) onEdit(quote);
                              else if (onEditDraft) onEditDraft(quote);
                            }}
                            onUpdateNotes={async (n) => {
                              try {
                                await updateNotes(quote.id, n);
                                success("Nota actualizada");
                              } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : 'Error al guardar nota';
                                error(msg);
                              }
                            }}
                            onArchive={() => handleArchive({ stopPropagation:()=>{} } as unknown as React.MouseEvent, quote)}
                            onDelete={() => handleDelete({ stopPropagation:()=>{} } as unknown as React.MouseEvent, quote)}
                            onPrint={onPrint}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmación de Borrado Masivo */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#82C69E] w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-[#2B2B2B] animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <h3 className="font-bold text-base text-[#2B2B2B]">Confirmar Eliminación Masiva</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Estás a punto de eliminar <span className="font-bold text-red-600 font-mono">{selectedIds.length} cotizaciones</span> seleccionadas. Esta acción es permanente y no se puede deshacer.
            </p>

            <div className="bg-[#F7F5F0] p-3 rounded-xl border border-gray-200 text-xs text-gray-600">
              <p className="font-medium">
                Nota: De acuerdo con las reglas de taller, solo se borrarán documentos en estado <span className="font-bold text-[#1B4D3E]">borrador</span> o <span className="font-bold text-[#1B4D3E]">archivadas</span>.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={() => setShowBatchDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold uppercase tracking-wider font-mono hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingBatch}
                onClick={handleExecuteBatchDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold uppercase tracking-wider font-mono hover:bg-red-700 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {isDeletingBatch ? 'Eliminando...' : `Sí, eliminar ${selectedIds.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// -- Quote Detail Accordion Subcomponent --

const QuoteDetail: React.FC<{
  quote: Quote;
  onAdvance: (s: QuoteStatus, n?: string) => Promise<void>;
  onRevert: (s: QuoteStatus, n?: string) => Promise<void>;
  onClone: () => Promise<void>;
  canClone: boolean;
  onEdit?: () => void;
  onUpdateNotes: (n: string) => Promise<void>;
  onArchive: () => void;
  onDelete: () => void;
  onPrint?: (quote: Quote) => void;
}> = ({ quote, onAdvance, onRevert, onClone, canClone, onEdit, onUpdateNotes, onArchive, onDelete, onPrint }) => {
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState(quote.notes);
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceNote, setAdvanceNote] = useState('');
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const currentIndex = STATUS_ORDER.indexOf(quote.status);
  const nextStatus = currentIndex >= 0 && currentIndex < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIndex + 1] : null;
  const prevStatus = currentIndex > 0 ? STATUS_ORDER[currentIndex - 1] : null;

  const isCancelled = quote.status === 'cancelada';

  const handleGeneratePDF = () => {
    exportQuoteToPDF(quote);
  };

  const handlePrintAction = () => {
    if (onPrint) {
      onPrint(quote);
    } else {
      window.print();
    }
  };

  const handleCopyLink = () => {
    const payload = JSON.stringify({ items: quote.items, operatorName: quote.operatorName });
    const encoded = btoa(payload);
    const url = new URL(window.location.href);
    url.searchParams.set('q', encoded);
    navigator.clipboard.writeText(url.toString());
  };

  return (
    <div className="p-5 md:p-7 flex flex-col gap-6 animate-in slide-in-from-top-3 duration-200">
      
      {/* 4a. Pipeline visual */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide shrink-0">
        {!isCancelled ? STATUS_ORDER.map((s, i) => {
           const isPast = currentIndex >= i;
           const isCurrent = currentIndex === i;
           const badgeClass = isCurrent 
             ? 'bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-xs' 
             : isPast 
               ? 'bg-[#F0FDF4] text-[#2E7D32] border-[#82C69E]' 
               : 'bg-white text-gray-400 border-gray-200';
               
           return (
             <React.Fragment key={s}>
               {i > 0 && <span className="text-gray-300 font-bold mx-1">›</span>}
               <div className={`px-3.5 py-1 rounded-full border text-[10px] uppercase font-mono font-bold whitespace-nowrap transition-colors ${badgeClass}`}>
                 {s}
               </div>
             </React.Fragment>
           );
        }) : (
           <div className="flex items-center gap-2 w-full">
             {STATUS_ORDER.map(s => <div key={s} className="px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-400 text-[10px] uppercase font-mono font-bold whitespace-nowrap opacity-50">{s}</div>)}
             <span className="text-gray-300 font-bold mx-2">›</span>
             <div className="px-3.5 py-1 rounded-full border bg-red-100 text-red-700 border-red-300 text-[10px] uppercase font-mono font-bold whitespace-nowrap">CANCELADA</div>
           </div>
        )}
      </div>

      {/* 4b. Tabla de items */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden relative shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#F7F5F0] border-b border-gray-200 font-mono text-[10px] uppercase text-gray-600 font-bold">
              <th className="py-2.5 pl-4 pr-2">Tipo</th>
              <th className="py-2.5 px-2">Nombre</th>
              <th className="py-2.5 px-2">Perfil</th>
              <th className="py-2.5 px-2">Cant</th>
              <th className="py-2.5 px-2">Espec.</th>
              <th className="py-2.5 px-2 text-right">P/u</th>
              <th className="py-2.5 pr-4 pl-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quote.items.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F7F5F0]/40'}>
                <td className="py-2.5 pl-4 pr-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${item.itemType==='hardware' ? 'bg-gray-200 text-gray-700' : 'bg-[#82C69E]/20 text-[#1B4D3E]'}`}>
                    {item.itemType==='hardware' ? 'HW' : '3D'}
                  </span>
                </td>
                <td className="py-2.5 px-2 font-bold text-[#2B2B2B]">{item.itemName}</td>
                <td className="py-2.5 px-2 text-gray-600 font-medium">{item.profileName}</td>
                <td className="py-2.5 px-2 font-mono font-bold text-[#1B4D3E]">{item.quantity}x</td>
                <td className="py-2.5 px-2 text-gray-500 font-mono">{item.itemType === 'hardware' ? '—' : `${item.weightInfo}g / ${item.timeInfo}h`}</td>
                <td className="py-2.5 px-2 text-right font-mono text-gray-600">{formatMXN(item.unitPrice)}</td>
                <td className="py-2.5 pr-4 pl-2 text-right font-mono font-bold text-[#1B4D3E]">{formatMXN(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* 4c. Tarjetas resumen y 4e. Notas */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-gray-200 bg-white p-3.5 rounded-xl flex flex-col">
              <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">Piezas 3D</span>
              <span className="text-xl font-black font-mono mt-1 text-[#1B4D3E]">{quote.items.filter(i=>i.itemType!=='hardware').reduce((a,b)=>a+b.quantity, 0)}</span>
            </div>
            <div className="border border-gray-200 bg-white p-3.5 rounded-xl flex flex-col">
              <span className="text-[10px] uppercase font-mono text-gray-500 font-bold">Hardware</span>
              <span className="text-xl font-black font-mono mt-1 text-gray-700">{formatMXN(quote.items.filter(i=>i.itemType==='hardware').reduce((a,b)=>a+b.totalPrice, 0))}</span>
            </div>
            <div className="border border-[#82C69E] bg-[#F0FDF4] p-3.5 rounded-xl flex flex-col">
              <span className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Total Cotización</span>
              <span className="text-xl font-black font-mono mt-1 text-[#1B4D3E]">{formatMXN(quote.total)}</span>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl bg-white p-4">
             {editingNotes ? (
               <div className="flex flex-col gap-2">
                 <textarea 
                   className="w-full bg-[#F7F5F0] border border-[#82C69E] rounded-lg p-3 text-xs font-sans outline-none focus:ring-1 focus:ring-[#1B4D3E] resize-none h-24"
                   value={draftNotes}
                   onChange={e => setDraftNotes(e.target.value)}
                   autoFocus
                   placeholder="Notas internas..."
                 />
                 <div className="flex justify-end gap-2">
                   <button onClick={() => {setEditingNotes(false); setDraftNotes(quote.notes);}} className="text-xs font-mono font-bold px-3 py-1.5 text-gray-600 hover:text-gray-900 transition-colors">Cancelar</button>
                   <button onClick={async () => {await onUpdateNotes(draftNotes); setEditingNotes(false);}} className="text-xs uppercase font-mono font-bold px-3.5 py-1.5 bg-[#1B4D3E] text-white rounded-lg hover:bg-[#2E7D32] transition-colors">Guardar Nota</button>
                 </div>
               </div>
             ) : quote.notes ? (
               <div className="flex items-start gap-3 group">
                 <MessageSquare size={16} className="text-[#2E7D32] mt-0.5 shrink-0" />
                 <p className="text-xs text-gray-700 font-sans leading-relaxed whitespace-pre-wrap flex-1">{quote.notes}</p>
                 <button onClick={() => setEditingNotes(true)} className="opacity-0 group-hover:opacity-100 text-[10px] uppercase font-mono font-bold text-[#1B4D3E] hover:underline underline-offset-2">Editar</button>
               </div>
             ) : (
               <button onClick={() => setEditingNotes(true)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#1B4D3E] transition-colors font-medium">
                 <Plus size={15} /> Añadir nota interna...
               </button>
             )}
          </div>
        </div>

        {/* 4d. Log Eventos */}
        {quote.statusHistory && quote.statusHistory.length > 0 && (
          <div className="w-full md:w-80 border border-gray-200 rounded-xl bg-white p-4 flex flex-col h-full max-h-64 overflow-y-auto scrollbar-hide">
             <span className="text-[10px] uppercase font-mono text-gray-500 font-bold mb-3 sticky top-0 bg-white pb-2 border-b border-gray-100">Historial de cambios</span>
             <div className="flex flex-col gap-3 relative">
               <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200 z-0"></div>
               {quote.statusHistory.map((ev, i) => (
                 <div key={i} className="flex gap-2.5 relative z-10">
                   <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#1B4D3E] shrink-0 mt-1"></div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-mono text-gray-400">{format(new Date(ev.changedAt), "dd/MMM HH:mm")} por {ev.changedBy}</span>
                     <span className="text-xs font-bold text-gray-800 mt-0.5">
                       {ev.from ? `${ev.from} → ` : ''}{ev.to}
                     </span>
                     {ev.note && <span className="text-xs text-gray-500 font-serif italic mt-0.5 border-l-2 border-gray-300 pl-2">{ev.note}</span>}
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>

      {/* 4f. Barra de acciones */}
      {showAdvanceModal ? (
        <div className="flex flex-col gap-3 p-4 border border-[#82C69E] rounded-xl bg-[#F0FDF4] animate-in fade-in zoom-in-95 duration-200">
           <h4 className="font-bold text-xs text-[#1B4D3E]">Avanzar cotización a: <span className="text-[#2E7D32] uppercase font-mono font-black">{nextStatus}</span></h4>
           <input 
             type="text" 
             placeholder="Motivo del cambio (opcional)..." 
             value={advanceNote}
             onChange={e => setAdvanceNote(e.target.value)}
             className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs outline-none focus:border-[#1B4D3E]"
           />
           <div className="flex justify-end gap-2 mt-1">
             <button disabled={isAdvancing} onClick={() => {setShowAdvanceModal(false); setAdvanceNote('');}} className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-gray-700 text-xs font-bold uppercase font-mono hover:bg-white">Cancelar</button>
             <button disabled={isAdvancing} onClick={async () => {setIsAdvancing(true); await onAdvance(nextStatus!, advanceNote); setIsAdvancing(false); setShowAdvanceModal(false); setAdvanceNote('');}} className="px-4 py-1.5 bg-[#1B4D3E] text-white rounded-lg text-xs font-bold uppercase font-mono hover:bg-[#2E7D32]">Confirmar Avance</button>
           </div>
        </div>
      ) : showDeletionConfirm ? (
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border border-red-300 rounded-xl bg-red-50 animate-in fade-in zoom-in-95 duration-200 gap-3">
           <span className="text-red-700 text-xs font-bold flex items-center gap-2"><AlertTriangle size={16}/> ¿Eliminar {quote.folio}? Esta acción no se puede deshacer.</span>
           <div className="flex gap-2">
             <button onClick={() => setShowDeletionConfirm(false)} className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-gray-700 text-xs font-bold uppercase font-mono bg-white hover:bg-gray-50">Cancelar</button>
             <button onClick={() => {onDelete(); setShowDeletionConfirm(false);}} className="px-3.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold uppercase font-mono hover:bg-red-700">Sí, eliminar</button>
           </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200">
          
          <div className="flex flex-wrap gap-2">
            {!isCancelled && nextStatus && (
              <button onClick={() => setShowAdvanceModal(true)} className="bg-[#1B4D3E] text-white px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-[#2E7D32] transition-colors shadow-xs cursor-pointer">
                Avanzar Estado <ArrowRight size={14} />
              </button>
            )}
            {!isCancelled && prevStatus && (
              <button onClick={() => onRevert(prevStatus)} className="bg-white border border-gray-300 text-gray-700 px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-gray-50 transition-colors cursor-pointer">
                <RotateCcw size={14} /> Revertir a {prevStatus}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {quote.status === 'borrador' && onEdit && (
              <button onClick={onEdit} className="bg-white border border-[#1B4D3E] text-[#1B4D3E] px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-[#F0FDF4] transition-colors cursor-pointer">
                <Settings size={14} /> Editar
              </button>
            )}
            
            {/* BUG 4: Si canClone es falso, deshabilitar y no escribir silenciosamente */}
            <button 
              onClick={onClone} 
              disabled={!canClone}
              title={canClone ? "Crear una copia editable de esta cotización" : "Clonación no disponible"}
              className="bg-white border border-gray-300 text-gray-700 px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Copy size={14} /> Clonar
            </button>

            <button onClick={handleGeneratePDF} className="bg-white border border-gray-300 text-gray-700 px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-gray-50 transition-colors cursor-pointer">
              <Download size={14} /> PDF
            </button>
            <button 
              onClick={handlePrintAction}
              className="bg-white border border-[#1B4D3E] text-[#1B4D3E] px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button 
              onClick={() => setIsPresetsOpen(true)}
              className="bg-white border border-[#2E7D32] text-[#2E7D32] px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
            >
              <MessageCircle size={14} /> Presets Chat
            </button>
            <button onClick={handleCopyLink} className="bg-white border border-gray-300 text-gray-700 px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-gray-50 transition-colors cursor-pointer" title="Copiar Link">
              <LinkIcon size={14} /> Link
            </button>
          </div>

          <div className="flex gap-2 ml-auto">
            <button onClick={onArchive} className={`px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors border cursor-pointer ${quote.isArchived ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100' : 'border-gray-300 text-gray-600 hover:text-amber-700 hover:border-amber-400 bg-white'}`}>
              <Archive size={14} /> {quote.isArchived ? 'Desarchivar' : 'Archivar'}
            </button>
            <button onClick={() => setShowDeletionConfirm(true)} className="bg-white border border-transparent text-gray-500 px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
          
        </div>
      )}

      {isPresetsOpen && (
        <MessagePresetsModal 
          isOpen={isPresetsOpen}
          onClose={() => setIsPresetsOpen(false)}
          quote={quote}
        />
      )}
    </div>
  );
};
