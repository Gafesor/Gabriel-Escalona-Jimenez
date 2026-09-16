import React, { useState, useMemo } from 'react';
import { Quote, QuoteStatus, useQuoteHistory } from '../hooks/useQuoteHistory';
import { useToast } from '../hooks/useToast';
import { Search, Plus, Archive, Trash2, ChevronDown, ChevronRight, FileText, Link as LinkIcon, Download, RotateCcw, MessageSquare, ArrowRight, X, MessageCircle, Inbox, AlertTriangle, Copy, Settings, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportQuoteToPDF } from '../lib/pdfHelper';
import { MessagePresetsModal } from './MessagePresetsModal';

interface QuoteHistoryProps {
  onNewQuote: () => void;
  onCloneQuote: (quote: Quote) => void;
  onEdit?: (quote: Quote) => void;
  onPrint?: (quote: Quote) => void;
}

const formatMXN = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value);
};

const STATUS_ORDER: QuoteStatus[] = ['borrador', 'enviada', 'revision', 'aprobada', 'produccion', 'entregada'];

const STATUS_COLORS: Record<QuoteStatus, string> = {
  borrador: 'bg-[#F3F4F6] text-[#555] border-[#2a2a2a]',
  enviada: 'bg-[#1a2a3a] text-[#4a9eff] border-[#1e3a5a]',
  revision: 'bg-[#2a2200] text-[#ccaa00] border-[#3a3200]',
  aprobada: 'bg-[#0d2a1a] text-[#3dcc7e] border-[#1a4a2e]',
  produccion: 'bg-[#2a1800] text-emerald-800 border-[#3a2200]',
  entregada: 'bg-[#1a1a2a] text-[#9b8fff] border-[#2a2a4a]',
  cancelada: 'bg-[#1a0000] text-[#cc3333] border-[#3a1111]'
};

type SortField = 'folio' | 'clientName' | 'operatorName' | 'total' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export const QuoteHistory: React.FC<QuoteHistoryProps> = ({ onNewQuote, onCloneQuote, onEdit, onPrint }) => {
  const { quotes, updateStatus, updateNotes, archiveQuote, deleteQuote, cloneQuote } = useQuoteHistory();
  const { success, error } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuoteStatus | 'todas' | 'archivadas'>('todas');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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
    return filtered.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'total') {
         // numerical
      } else if (sortField === 'createdAt') {
         valA = new Date(valA).getTime();
         valB = new Date(valB).getTime();
      } else {
         valA = valA.toString().toLowerCase();
         valB = valB.toString().toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  }, [quotes, search, filter, sortField, sortOrder]);

  const handleDelete = (e: React.MouseEvent, q: Quote) => {
    e.stopPropagation();
    try {
      deleteQuote(q.id);
      success(`Cotización ${q.folio} eliminada`);
    } catch (err: any) {
      error(err.message, {
        label: "Archivar ahora",
        onClick: () => {
          archiveQuote(q.id);
          success(`Cotización ${q.folio} archivada`);
        }
      });
    }
  };

  const handleArchive = (e: React.MouseEvent, q: Quote) => {
    e.stopPropagation();
    archiveQuote(q.id);
    success(q.isArchived ? `Cotización ${q.folio} desarchivada` : `Cotización ${q.folio} archivada`);
  };

  const Highlight = ({ text }: { text: string }) => {
    if (!search.trim()) return <>{text}</>;
    const regex = new RegExp(`(${search})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((p, i) => 
          regex.test(p) ? <span key={i} className="bg-[#059669]/25 text-[#111827]">{p}</span> : p
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#F3F4F6] border-2 border-[#D1D5DB] shadow-2xl relative animate-in fade-in">
      {/* Stats Bar */}
      <div className="flex border-b border-[#D1D5DB] bg-[#F3F4F6] overflow-x-auto scrollbar-hide shrink-0">
        <div className="p-4 border-r border-[#E5E7EB] flex flex-col justify-center min-w-[150px]">
          <span className="text-[10px] uppercase font-mono text-[#6B7280]">Cotizaciones</span>
          <span className="text-2xl font-mono font-bold text-[#111827] mt-1">{stats.total}</span>
        </div>
        <div className="p-4 border-r border-[#E5E7EB] flex flex-col justify-center min-w-[150px]">
          <span className="text-[10px] uppercase font-mono text-[#6B7280]">Este mes</span>
          <span className="text-2xl font-mono font-bold text-[#111827] mt-1">{stats.thisMonth}</span>
        </div>
        <div className="p-4 border-r border-[#E5E7EB] flex flex-col justify-center min-w-[150px]">
          <span className="text-[10px] uppercase font-mono text-[#6B7280]">En Producción</span>
          <span className="text-2xl font-mono font-bold text-emerald-800 mt-1">{stats.inProduction}</span>
        </div>
        <div className="p-4 border-r border-[#E5E7EB] flex flex-col justify-center min-w-[200px]">
          <span className="text-[10px] uppercase font-mono text-[#6B7280]">Ingresos Aprobados</span>
          <span className="text-2xl font-mono font-bold text-[#3dcc7e] mt-1">{formatMXN(stats.approvedRevenue)}</span>
        </div>
        <div className="p-4 border-r border-[#E5E7EB] flex flex-col justify-center min-w-[150px]">
          <span className="text-[10px] uppercase font-mono text-[#6B7280]">Tasa Aprobación</span>
          <span className="text-2xl font-mono font-bold text-[#111827] mt-1">{stats.approvalRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-[#D1D5DB] bg-white flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shrink-0">
        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto overflow-hidden">
          <div className="relative border-2 border-[#D1D5DB] focus-within:border-[#059669] bg-white min-w-[250px] shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={16} />
            <input 
               type="text" 
               placeholder="Buscar folio, cliente, asesor..." 
               value={search}
               onChange={e => setSearch(e.target.value)}
               className="w-full bg-transparent px-10 py-3 text-sm font-sans outline-none text-[#111827] placeholder:text-[#9CA3AF]"
            />
          </div>
          <div className="flex overflow-x-auto scrollbar-hide gap-2 items-center">
            {['todas', 'borrador', 'enviada', 'revision', 'aprobada', 'produccion', 'entregada', 'archivadas'].map(mode => (
              <button 
                key={mode} 
                onClick={() => setFilter(mode as any)}
                className={`px-3 py-1.5 text-[10px] font-mono border whitespace-nowrap uppercase tracking-widest transition-colors rounded-full ${
                  filter === mode 
                  ? 'border-[#059669] text-emerald-800 bg-[#059669]/10' 
                  : 'border-[#D1D5DB] text-[#4B5563] hover:border-gray-500'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        
        <button onClick={onNewQuote} className="shrink-0 bg-[#059669] text-white px-6 py-3 border-2 border-[#059669] hover:bg-transparent hover:text-emerald-800 transition-colors uppercase font-mono text-xs font-bold tracking-widest flex items-center gap-2">
          <Plus size={16} /> Nueva Cotización
        </button>
      </div>

      {/* Table & List */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#F3F4F6] z-10 border-b-2 border-[#D1D5DB] shadow-md">
            <tr className="text-[10px] uppercase font-mono text-[#6B7280]">
              <th className="py-4 pl-6 pr-4 cursor-pointer hover:text-[#111827] transition-colors" onClick={() => handleSort('folio')}>
                Folio {sortField === 'folio' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-4 pr-4 cursor-pointer hover:text-[#111827] transition-colors" onClick={() => handleSort('clientName')}>
                Cliente / Proyecto {sortField === 'clientName' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-4 pr-4 cursor-pointer hover:text-[#111827] transition-colors" onClick={() => handleSort('operatorName')}>Asesor</th>
              <th className="py-4 pr-4">Estado</th>
              <th className="py-4 pr-4 text-right cursor-pointer hover:text-[#111827] transition-colors" onClick={() => handleSort('total')}>
                Total {sortField === 'total' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-4 pr-4 cursor-pointer hover:text-[#111827] transition-colors" onClick={() => handleSort('createdAt')}>
                Fecha {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-4 pr-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center text-[#6B7280]">
                    <Inbox size={48} className="mb-4 opacity-20" />
                    <p className="font-mono text-sm uppercase">
                      {filter === 'todas' 
                        ? (search ? 'No hay resultados para la búsqueda.' : 'Aún no tienes cotizaciones guardadas.') 
                        : filter === 'archivadas' ? 'No tienes cotizaciones archivadas.' : `No hay cotizaciones con estado ${filter.toUpperCase()}.`}
                    </p>
                    {filter === 'todas' && !search && (
                      <button onClick={onNewQuote} className="mt-6 text-emerald-800 border-b border-[#059669] pb-1 uppercase font-mono text-[10px] tracking-widest hover:text-[#111827] hover:border-[#374151] transition-colors">
                        Crear primera cotización
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredQuotes.map(quote => (
                <React.Fragment key={quote.id}>
                  <tr 
                    className={`group hover:bg-white transition-colors cursor-pointer ${expandedId === quote.id ? 'bg-[#F3F4F6]' : ''} ${Date.now() - new Date(quote.createdAt).getTime() < 2000 ? 'animate-highlight-pulse' : ''}`}
                    onClick={() => setExpandedId(expandedId === quote.id ? null : quote.id)}
                  >
                    <td className="py-4 pl-6 pr-4 font-mono font-bold text-sm text-emerald-800">
                      <Highlight text={quote.folio} />
                    </td>
                    <td className="py-4 pr-4 font-bold text-sm">
                      <Highlight text={quote.clientName || 'Sin Nombre'} />
                    </td>
                    <td className="py-4 pr-4 text-xs font-mono text-[#4B5563]">
                      <Highlight text={quote.operatorName} />
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-mono font-bold border ${STATUS_COLORS[quote.status]}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {quote.status}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right font-mono font-bold">
                      {formatMXN(quote.total)}
                    </td>
                    <td className="py-4 pr-4 text-xs font-mono text-[#6B7280]">
                      {format(new Date(quote.createdAt), "dd MMM yyyy", { locale: es })}
                    </td>
                    <td className="py-4 pr-6 text-right relative">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={(e) => handleArchive(e, quote)} className="opacity-0 group-hover:opacity-100 hover:text-yellow-500 transition-all" title={quote.isArchived ? 'Desarchivar' : 'Archivar'}>
                          <Archive size={16} />
                        </button>
                        <button onClick={(e) => handleDelete(e, quote)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                        <ChevronRight size={18} className={`text-[#9CA3AF] transition-transform duration-300 ${expandedId === quote.id ? 'rotate-90 text-emerald-800' : ''}`} />
                      </div>
                    </td>
                  </tr>
                  
                  {expandedId === quote.id && (
                    <tr className="bg-[#F9FAFB] border-b-4 border-[#059669]">
                      <td colSpan={7} className="p-0">
                        <QuoteDetail 
                          quote={quote} 
                          onAdvance={(status, note) => updateStatus(quote.id, status, note)}
                          onRevert={(status, note) => updateStatus(quote.id, status, note)}
                          onClone={async () => {
                            const newQ = await cloneQuote(quote.id);
                            if (newQ) onCloneQuote(newQ);
                          }}
                          onEdit={() => onEdit && onEdit(quote)}
                          onUpdateNotes={(n) => updateNotes(quote.id, n)}
                          onArchive={() => handleArchive({ stopPropagation:()=>{} } as any, quote)}
                          onDelete={() => handleDelete({ stopPropagation:()=>{} } as any, quote)}
                          onPrint={onPrint}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// -- Quote Detail Accordion Subcomponent --

const QuoteDetail: React.FC<{
  quote: Quote;
  onAdvance: (s: QuoteStatus, n?: string) => void;
  onRevert: (s: QuoteStatus, n?: string) => void;
  onClone: () => void;
  onEdit?: () => void;
  onUpdateNotes: (n: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onPrint?: (quote: Quote) => void;
}> = ({ quote, onAdvance, onRevert, onClone, onEdit, onUpdateNotes, onArchive, onDelete, onPrint }) => {
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState(quote.notes);
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceNote, setAdvanceNote] = useState('');
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  const currentIndex = STATUS_ORDER.indexOf(quote.status);
  const nextStatus = currentIndex >= 0 && currentIndex < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIndex + 1] : null;
  const prevStatus = currentIndex > 0 ? STATUS_ORDER[currentIndex - 1] : null;

  const isCancelled = quote.status === 'cancelada';

  const handleGeneratePDF = () => {
    exportQuoteToPDF(quote);
  };

  const handleCopyLink = () => {
    const payload = JSON.stringify({ items: quote.items, operatorName: quote.operatorName });
    const encoded = btoa(payload);
    const url = new URL(window.location.href);
    url.searchParams.set('q', encoded);
    navigator.clipboard.writeText(url.toString());
  };

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8 animate-in slide-in-from-top-4 duration-300">
      
      {/* 4a. Pipeline visual */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide shrink-0">
        {!isCancelled ? STATUS_ORDER.map((s, i) => {
           const isPast = currentIndex >= i;
           const isCurrent = currentIndex === i;
           const badgeClass = isCurrent 
             ? 'bg-[#059669] text-white border-[#059669]' 
             : isPast 
               ? 'bg-[#0d2a1a] text-[#3dcc7e] border-[#1a4a2e]' 
               : 'bg-white text-[#555] border-[#2a2a2a]';
               
           return (
             <React.Fragment key={s}>
               {i > 0 && <span className="text-[#333] font-black mx-1">›</span>}
               <div className={`px-4 py-1.5 rounded-full border text-[10px] uppercase font-mono font-bold whitespace-nowrap transition-colors ${badgeClass}`}>
                 {s}
               </div>
             </React.Fragment>
           );
        }) : (
           <div className="flex items-center gap-2 w-full">
             {STATUS_ORDER.map(s => <div key={s} className="px-4 py-1.5 rounded-full border border-[#2a2a2a] bg-white text-[#333] text-[10px] uppercase font-mono font-bold whitespace-nowrap opacity-50">{s}</div>)}
             <span className="text-[#333] font-black mx-2">›</span>
             <div className="px-4 py-1.5 rounded-full border bg-[#1a0000] text-[#cc3333] border-[#3a1111] text-[10px] uppercase font-mono font-bold whitespace-nowrap">CANCELADA</div>
           </div>
        )}
      </div>

      {/* 4b. Tabla de items */}
      <div className="border border-[#E5E7EB] bg-white overflow-hidden relative">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-white border-b border-[#E5E7EB] font-mono text-[10px] uppercase text-[#6B7280]">
              <th className="py-2 pl-4 pr-2">Tipo</th>
              <th className="py-2 px-2">Nombre</th>
              <th className="py-2 px-2">Perfil</th>
              <th className="py-2 px-2">Cant</th>
              <th className="py-2 px-2">Espec.</th>
              <th className="py-2 px-2 text-right">P/u</th>
              <th className="py-2 pr-4 pl-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {quote.items.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-[#F3F4F6]' : 'bg-[#F9FAFB]'}>
                <td className="py-3 pl-4 pr-2">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${item.itemType==='hardware' ? 'bg-gray-800 text-[#374151]' : 'bg-[#059669]/20 text-emerald-800'}`}>
                    {item.itemType==='hardware' ? 'HW' : '3D'}
                  </span>
                </td>
                <td className="py-3 px-2 font-bold">{item.itemName}</td>
                <td className="py-3 px-2 text-[#4B5563] text-xs">{item.profileName}</td>
                <td className="py-3 px-2 font-mono">{item.quantity}x</td>
                <td className="py-3 px-2 text-[#6B7280] text-xs font-mono">{item.itemType === 'hardware' ? '—' : `${item.weightInfo}g / ${item.timeInfo}h`}</td>
                <td className="py-3 px-2 text-right font-mono text-[#4B5563]">{formatMXN(item.unitPrice)}</td>
                <td className="py-3 pr-4 pl-2 text-right font-mono font-bold text-[#111827]">{formatMXN(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* 4c. Tarjetas resumen y 4e. Notas */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-[#E5E7EB] bg-white p-4 flex flex-col">
              <span className="text-[10px] uppercase font-mono text-[#6B7280]">Piezas 3D</span>
              <span className="text-xl font-bold font-mono mt-1">{quote.items.filter(i=>i.itemType!=='hardware').reduce((a,b)=>a+b.quantity, 0)}</span>
            </div>
            <div className="border border-[#E5E7EB] bg-white p-4 flex flex-col">
              <span className="text-[10px] uppercase font-mono text-[#6B7280]">Hardware</span>
              <span className="text-xl font-bold font-mono mt-1 text-[#4B5563]">{formatMXN(quote.items.filter(i=>i.itemType==='hardware').reduce((a,b)=>a+b.totalPrice, 0))}</span>
            </div>
            <div className="border-b-4 border-[#059669] bg-white p-4 flex flex-col">
              <span className="text-[10px] uppercase font-mono text-[#6B7280]">Total Cotización</span>
              <span className="text-2xl font-black font-mono mt-1 text-emerald-800">{formatMXN(quote.total)}</span>
            </div>
          </div>

          <div className="border border-[#E5E7EB] bg-[#F9FAFB] p-4">
             {editingNotes ? (
               <div className="flex flex-col gap-2">
                 <textarea 
                   className="w-full bg-white border border-[#D1D5DB] p-3 text-sm font-sans outline-none focus:border-[#059669] resize-none h-24"
                   value={draftNotes}
                   onChange={e => setDraftNotes(e.target.value)}
                   autoFocus
                   placeholder="Notas internas..."
                 />
                 <div className="flex justify-end gap-2">
                   <button onClick={() => {setEditingNotes(false); setDraftNotes(quote.notes);}} className="text-xs uppercase font-mono px-3 py-1.5 text-[#4B5563] hover:text-[#111827] transition-colors">Cancelar</button>
                   <button onClick={() => {onUpdateNotes(draftNotes); setEditingNotes(false);}} className="text-xs uppercase font-mono px-3 py-1.5 bg-[#059669] text-white font-bold hover:bg-orange-600 transition-colors">Guardar Nota</button>
                 </div>
               </div>
             ) : quote.notes ? (
               <div className="flex items-start gap-3 group">
                 <MessageSquare size={16} className="text-[#6B7280] mt-0.5 shrink-0" />
                 <p className="text-sm text-[#374151] font-sans leading-relaxed whitespace-pre-wrap flex-1">{quote.notes}</p>
                 <button onClick={() => setEditingNotes(true)} className="opacity-0 group-hover:opacity-100 text-[10px] uppercase font-mono text-emerald-800 hover:underline underline-offset-2">Editar</button>
               </div>
             ) : (
               <button onClick={() => setEditingNotes(true)} className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors">
                 <Plus size={16} /> Añadir nota interna...
               </button>
             )}
          </div>
        </div>

        {/* 4d. Log Eventos */}
        {quote.statusHistory && quote.statusHistory.length > 0 && (
          <div className="w-full md:w-80 border border-[#E5E7EB] bg-white p-4 flex flex-col h-full max-h-64 overflow-y-auto scrollbar-hide">
             <span className="text-[10px] uppercase font-mono text-[#6B7280] mb-4 sticky top-0 bg-white pb-2 border-b border-[#E5E7EB]">Historial de cambios</span>
             <div className="flex flex-col gap-4 relative">
               <div className="absolute left-1.5 top-2 bottom-2 w-px bg-[#333] z-0"></div>
               {quote.statusHistory.map((ev, i) => (
                 <div key={i} className="flex gap-3 relative z-10">
                   <div className="w-3 h-3 rounded-full bg-white border-2 border-[#555] shrink-0 mt-1"></div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-mono text-[#6B7280]">{format(new Date(ev.changedAt), "dd/MMM HH:mm")} por {ev.changedBy}</span>
                     <span className="text-xs font-bold text-[#374151] mt-0.5">
                       {ev.from ? `${ev.from} → ` : ''}{ev.to}
                     </span>
                     {ev.note && <span className="text-xs text-[#6B7280] font-serif italic mt-1 border-l-2 border-[#555] pl-2">{ev.note}</span>}
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>

      {/* 4f. Barra de acciones */}
      {showAdvanceModal ? (
        <div className="flex flex-col gap-4 p-4 border-2 border-[#059669] bg-white animate-in fade-in zoom-in-95 duration-200">
           <h4 className="font-bold text-sm">Avanzar cotización a: <span className="text-emerald-800 uppercase font-mono">{nextStatus}</span></h4>
           <input 
             type="text" 
             placeholder="Motivo del cambio (opcional)..." 
             value={advanceNote}
             onChange={e => setAdvanceNote(e.target.value)}
             className="w-full bg-white border border-[#D1D5DB] p-3 text-sm outline-none focus:border-[#059669]"
           />
           <div className="flex justify-end gap-3 mt-2">
             <button onClick={() => {setShowAdvanceModal(false); setAdvanceNote('');}} className="px-4 py-2 border border-[#D1D5DB] text-[#374151] text-xs font-bold uppercase font-mono hover:bg-[#E5E7EB]">Cancelar</button>
             <button onClick={() => {onAdvance(nextStatus!, advanceNote); setShowAdvanceModal(false); setAdvanceNote('');}} className="px-4 py-2 bg-[#059669] text-white text-xs font-bold uppercase font-mono hover:bg-orange-600">Confirmar Avance</button>
           </div>
        </div>
      ) : showDeletionConfirm ? (
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-2 border-red-900 bg-[#1a0505] animate-in fade-in zoom-in-95 duration-200">
           <span className="text-red-400 text-sm font-bold flex items-center gap-2"><AlertTriangle size={16}/> ¿Eliminar {quote.folio}? Esta acción no se puede deshacer.</span>
           <div className="flex gap-3 mt-4 sm:mt-0">
             <button onClick={() => setShowDeletionConfirm(false)} className="px-4 py-2 border border-red-900/50 text-red-300 text-xs font-bold uppercase font-mono hover:bg-red-900/20">Cancelar</button>
             <button onClick={() => {onDelete(); setShowDeletionConfirm(false);}} className="px-4 py-2 bg-red-600 text-[#111827] text-xs font-bold uppercase font-mono hover:bg-red-500">Sí, eliminar</button>
           </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#D1D5DB]">
          
          <div className="flex flex-wrap gap-2">
            {!isCancelled && nextStatus && (
              <button onClick={() => setShowAdvanceModal(true)} className="bg-[#059669] text-white px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:bg-orange-600 transition-colors">
                Avanzar Estado <ArrowRight size={14} />
              </button>
            )}
            {!isCancelled && prevStatus && (
              <button onClick={() => onRevert(prevStatus)} className="bg-[#F3F4F6] border border-[#D1D5DB] text-[#374151] px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:border-gray-500 transition-colors">
                <RotateCcw size={14} /> Revertir a {prevStatus}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {quote.status === 'borrador' && onEdit && (
              <button onClick={onEdit} className="bg-transparent border border-[#059669] text-emerald-800 px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:bg-[#059669] hover:text-white transition-colors">
                <Settings size={14} /> Editar
              </button>
            )}
            <button onClick={onClone} className="bg-transparent border border-[#D1D5DB] text-[#374151] px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-colors">
              <Copy size={14} /> Clonar
            </button>
            <button onClick={handleGeneratePDF} className="bg-transparent border border-[#D1D5DB] text-[#374151] px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-colors">
              <Download size={14} /> PDF
            </button>
            <button 
              onClick={() => onPrint && onPrint(quote)}
              disabled={!onPrint}
              className="bg-transparent border border-[#D1D5DB] text-[#374151] px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:bg-[#059669] hover:text-white hover:border-[#059669] transition-colors disabled:opacity-40"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button 
              onClick={() => setIsPresetsOpen(true)}
              className="bg-transparent border border-[#D1D5DB] text-[#374151] px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:bg-[#059669] hover:text-white hover:border-[#059669] transition-colors"
            >
              <MessageCircle size={14} /> Presets Chat
            </button>
            <button onClick={handleCopyLink} className="bg-transparent border border-[#D1D5DB] text-[#374151] px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:bg-slate-800 hover:text-white transition-colors" title="Copiar Link">
              <LinkIcon size={14} /> Link
            </button>
          </div>

          <div className="flex gap-2 ml-auto">
            <button onClick={onArchive} className={`px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-colors border ${quote.isArchived ? 'bg-[#2a2200] border-[#3a3200] text-[#ccaa00] hover:bg-[#3a3200]' : 'border-[#D1D5DB] text-[#4B5563] hover:text-yellow-500 hover:border-yellow-500'}`}>
              <Archive size={14} /> {quote.isArchived ? 'Desarchivar' : 'Archivar'}
            </button>
            <button onClick={() => setShowDeletionConfirm(true)} className="border-transparent text-[#6B7280] px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:bg-red-900/20 hover:text-red-500 transition-colors">
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
          
        </div>
      )}
      <MessagePresetsModal 
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        clientName={quote.clientName}
        operatorName={quote.operatorName || ''}
        folio={quote.folio}
        items={quote.items}
        total={quote.total}
      />
    </div>
  );
};
