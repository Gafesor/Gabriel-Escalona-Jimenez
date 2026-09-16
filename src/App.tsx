import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Printer, 
  Cpu, 
  Plus, 
  Trash2, 
  Settings, 
  FileText, 
  Save, 
  RotateCcw, 
  ExternalLink, 
  Check, 
  X,
  History,
  Share2,
  Clock,
  Sparkles,
  Send,
  MessageSquare,
  Minus
} from 'lucide-react';
import { useQuoteHistory, TicketItem, Quote } from './hooks/useQuoteHistory';
import { QuoteHistory } from './components/QuoteHistory';
import { MessagePresetsModal } from './components/MessagePresetsModal';
import { exportQuoteToPDF } from './lib/pdfHelper';

interface Profile {
  id: string;
  name: string;
  spoolCost: number;     // $/kg
  machineHour: number;   // $/hour
}

const DEFAULT_PROFILES: Profile[] = [
  { id: '1', name: 'PLA Estándar (CubeUp)', spoolCost: 450, machineHour: 25 },
  { id: '2', name: 'PETG Resistencia', spoolCost: 550, machineHour: 30 },
  { id: '3', name: 'ABS / ASA Técnico', spoolCost: 650, machineHour: 35 },
  { id: '4', name: 'TPU Flexible', spoolCost: 750, machineHour: 40 },
  { id: '5', name: 'Resina Estándar 4K', spoolCost: 800, machineHour: 45 },
];

const DEFAULT_OPERATORS: string[] = ['Gabriel', 'Andrea', 'Carlos'];

const formatMXN = (val: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
};

export function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'history'>('calculator');
  const [operatorName, setOperatorName] = useState('');
  const [clientName, setClientName] = useState('');
  const [isAddingOperator, setIsAddingOperator] = useState(false);
  const [newOperatorInput, setNewOperatorInput] = useState('');
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [showPresetsModal, setShowPresetsModal] = useState(false);

  // Autosave reference to prevent infinite loops
  const lastSavedStateRef = useRef<string>('');

  // Operator Profiles
  const [presetOperators, setPresetOperators] = useState<string[]>(() => {
    const saved = localStorage.getItem('cubeup3-custom-operators');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_OPERATORS;
  });

  // Profiles
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('cubeup3-custom-profiles');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_PROFILES;
  });

  // Modal Settings
  const [isEditingProfiles, setIsEditingProfiles] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileSpool, setNewProfileSpool] = useState<number | ''>('');
  const [newProfileHour, setNewProfileHour] = useState<number | ''>('');

  const handleAddProfile = () => {
    if (!newProfileName || newProfileSpool === '' || newProfileHour === '') return;
    const newP: Profile = {
      id: Math.random().toString(),
      name: newProfileName,
      spoolCost: Number(newProfileSpool),
      machineHour: Number(newProfileHour)
    };
    const updated = [...profiles, newP];
    setProfiles(updated);
    localStorage.setItem('cubeup3-custom-profiles', JSON.stringify(updated));
    setNewProfileName('');
    setNewProfileSpool('');
    setNewProfileHour('');
  };

  const handleRemoveProfile = (idStr: string) => {
    if (profiles.length <= 1) return;
    const updated = profiles.filter(p => p.id !== idStr);
    setProfiles(updated);
    localStorage.setItem('cubeup3-custom-profiles', JSON.stringify(updated));
    if (profileId === idStr) setProfileId(updated[0].id);
  };

  const handleAddOperator = () => {
    if (!newOperatorInput.trim()) return;
    const updated = [...presetOperators, newOperatorInput.trim()];
    setPresetOperators(updated);
    localStorage.setItem('cubeup3-custom-operators', JSON.stringify(updated));
    setOperatorName(newOperatorInput.trim());
    setNewOperatorInput('');
    setIsAddingOperator(false);
  };

  const handleRemoveOperator = (op: string) => {
    const updated = presetOperators.filter(o => o !== op);
    setPresetOperators(updated);
    localStorage.setItem('cubeup3-custom-operators', JSON.stringify(updated));
    if (operatorName === op) setOperatorName('');
  };

  // Calculate Item form
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [profileId, setProfileId] = useState(() => {
    const saved = localStorage.getItem('cubeup3-custom-profiles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed[0].id;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_PROFILES[0].id;
  });
  const [weight, setWeight] = useState<number | ''>('');
  const [hours, setHours] = useState<number | ''>('');
  const [pieceLabor, setPieceLabor] = useState<number | ''>('');
  
  // Global attributes
  const [globalMargin, setGlobalMargin] = useState<number>(30);
  
  // Hardware form
  const [hwName, setHwName] = useState('');
  const [hwQuantity, setHwQuantity] = useState<number>(1);
  const [hwPrice, setHwPrice] = useState<number | ''>('');
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const livePiecePrice = useMemo(() => {
    if (weight === '' && hours === '') return 0;
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return 0;
    
    const w = Number(weight) || 0;
    const h = Number(hours) || 0;
    const materialCost = (w / 1000) * (profile.spoolCost || 500);
    const machineCost = h * profile.machineHour;
    const labor = Number(pieceLabor) || 0;
    
    const base = materialCost + machineCost + labor;
    return base * (1 + (globalMargin / 100));
  }, [weight, hours, pieceLabor, profileId, profiles, globalMargin]);

  const { saveQuote, quotes } = useQuoteHistory();

  // Re-calculate prices whenever global margin changes
  useEffect(() => {
    setTicketItems(prev => prev.map(item => ({
      ...item,
      unitPrice: item.unitCost * (1 + globalMargin / 100),
      totalPrice: (item.unitCost * item.quantity) * (1 + globalMargin / 100)
    })));
  }, [globalMargin]);

  // Real-time autosave (debounced 1.5s) with dirtiness protection
  useEffect(() => {
    if (ticketItems.length === 0) return;

    const currentStateStr = JSON.stringify({
      ticketItems,
      operatorName: operatorName.trim(),
      clientName: clientName.trim(),
      globalMargin
    });

    if (currentStateStr === lastSavedStateRef.current) return;

    if (savedQuoteId) {
      const currentQuote = quotes.find(q => q.id === savedQuoteId);
      if (currentQuote && currentQuote.status !== 'borrador') return;
    }

    const timeoutMsg = setTimeout(async () => {
      try {
        const currentQuote = savedQuoteId ? quotes.find(q => q.id === savedQuoteId) : null;
        const q = await saveQuote(
          ticketItems, 
          operatorName, 
          clientName, 
          currentQuote?.notes || '', 
          globalMargin, 
          savedQuoteId || undefined
        );
        lastSavedStateRef.current = currentStateStr;
        if (!savedQuoteId && q?.id) {
          setSavedQuoteId(q.id);
        }
      } catch (e) {
        console.error("Autosave falló:", e);
      }
    }, 1500);

    return () => clearTimeout(timeoutMsg);
  }, [ticketItems, operatorName, clientName, globalMargin, savedQuoteId, saveQuote, quotes]);

  const handleGenerateLocalPDF = () => {
    if (ticketItems.length === 0) return;
    exportQuoteToPDF({
      folio: savedQuoteId ? (quotes.find(q => q.id === savedQuoteId)?.folio || 'BORRADOR') : 'CUB-NUEVO',
      clientName: clientName || 'Cliente',
      operatorName: operatorName || 'Asesor Técnico',
      createdAt: new Date(),
      items: ticketItems,
      total: lgTotals
    });
  };

  const handleAddPiece = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || weight === '' || hours === '') return;
    
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    const qty = Math.max(1, itemQuantity || 1);
    const w = Number(weight);
    const h = Number(hours);
    const labor = Number(pieceLabor) || 0;

    const materialCost = (w / 1000) * (profile.spoolCost || 500);
    const machineCost = h * profile.machineHour;
    const baseCost = materialCost + machineCost + labor;
    const finalPrice = baseCost * (1 + (globalMargin / 100));

    if (editItemId) {
      setTicketItems(ticketItems.map(item => {
        if (item.id === editItemId) {
          return {
            ...item,
            itemName,
            quantity: qty,
            profileName: profile.name,
            profileId: profile.id,
            weightInfo: w,
            timeInfo: h,
            laborInfo: labor,
            unitCost: baseCost,
            totalCost: baseCost * qty,
            unitPrice: finalPrice,
            totalPrice: finalPrice * qty,
            itemType: 'print'
          };
        }
        return item;
      }));
      setEditItemId(null);
    } else {
      const newItem: TicketItem = {
        id: Math.random().toString(),
        itemName,
        quantity: qty,
        profileName: profile.name,
        profileId: profile.id,
        weightInfo: w,
        timeInfo: h,
        laborInfo: labor,
        unitCost: baseCost,
        totalCost: baseCost * qty,
        unitPrice: finalPrice,
        totalPrice: finalPrice * qty,
        itemType: 'print'
      };
      setTicketItems([...ticketItems, newItem]);
    }

    setItemName('');
    setItemQuantity(1);
    setWeight('');
    setHours('');
    setPieceLabor('');
  };

  const handleAddHardware = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwName || hwPrice === '') return;

    const qty = Math.max(1, hwQuantity || 1);
    const baseCost = Number(hwPrice);
    const finalPrice = baseCost * (1 + (globalMargin / 100));

    if (editItemId) {
      setTicketItems(ticketItems.map(item => {
        if (item.id === editItemId) {
          return {
            ...item,
            itemName: hwName,
            quantity: qty,
            profileName: 'Hardware / Accesorio',
            unitCost: baseCost,
            totalCost: baseCost * qty,
            unitPrice: finalPrice,
            totalPrice: finalPrice * qty,
            itemType: 'hardware'
          };
        }
        return item;
      }));
      setEditItemId(null);
    } else {
      const newItem: TicketItem = {
        id: Math.random().toString(),
        itemName: hwName,
        quantity: qty,
        profileName: 'Hardware / Accesorio',
        weightInfo: 0,
        timeInfo: 0,
        unitCost: baseCost,
        totalCost: baseCost * qty,
        unitPrice: finalPrice,
        totalPrice: finalPrice * qty,
        itemType: 'hardware'
      };
      setTicketItems([...ticketItems, newItem]);
    }

    setHwName('');
    setHwQuantity(1);
    setHwPrice('');
  };

  const updateItemQuantity = (id: string, newQty: number) => {
    const validQty = Math.max(1, newQty);
    setTicketItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantity: validQty,
          totalCost: item.unitCost * validQty,
          totalPrice: item.unitPrice * validQty
        };
      }
      return item;
    }));
  };

  const cancelEdit = () => {
    setEditItemId(null);
    setItemName('');
    setItemQuantity(1);
    setWeight('');
    setHours('');
    setPieceLabor('');
    setHwName('');
    setHwQuantity(1);
    setHwPrice('');
  };

  const handleEditItemInfo = (item: TicketItem) => {
    setEditItemId(item.id);
    if (item.itemType === 'hardware') {
      setHwName(item.itemName);
      setHwQuantity(item.quantity || 1);
      setHwPrice(item.unitCost.toString() as any);
    } else {
      setItemName(item.itemName);
      setItemQuantity(item.quantity || 1);
      if (item.profileId && profiles.some(p => p.id === item.profileId)) {
        setProfileId(item.profileId);
      }
      setWeight(item.weightInfo.toString() as any);
      setHours(item.timeInfo.toString() as any);
      if (item.laborInfo !== undefined) setPieceLabor(item.laborInfo.toString() as any);
      else setPieceLabor('');
    }
  };

  const handleSave = async () => {
    if (ticketItems.length === 0) return;
    try {
      const q = await saveQuote(ticketItems, operatorName, clientName, '', globalMargin, savedQuoteId || undefined);
      setSavedQuoteId(q.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditDraft = (quote: Quote) => {
    const defaultMargin = typeof quote.globalMargin === 'number' && Number.isFinite(quote.globalMargin)
      ? quote.globalMargin 
      : 30;
    setTicketItems(quote.items);
    setClientName(quote.clientName || '');
    setOperatorName(quote.operatorName || '');
    setGlobalMargin(defaultMargin);
    setSavedQuoteId(quote.id);
    
    lastSavedStateRef.current = JSON.stringify({
      ticketItems: quote.items,
      operatorName: (quote.operatorName || '').trim(),
      clientName: (quote.clientName || '').trim(),
      globalMargin: defaultMargin
    });
    
    setActiveTab('calculator');
  };

  const handleClear = () => {
    setTicketItems([]);
    setSavedQuoteId(null);
    setClientName('');
    lastSavedStateRef.current = '';
  };

  // Totals
  const lgTotals = useMemo(() => {
    return ticketItems.reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  }, [ticketItems]);

  const lgCosts = useMemo(() => {
    return ticketItems.reduce((acc, i) => acc + (i.totalCost || 0), 0);
  }, [ticketItems]);

  const lgProfit = useMemo(() => {
    return lgTotals - lgCosts;
  }, [lgTotals, lgCosts]);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#2B2B2B] flex flex-col font-sans selection:bg-[#82C69E] selection:text-[#1B4D3E]">
      
      {/* Brand Header Bar */}
      <header className="bg-[#1B4D3E] text-white py-3 px-4 lg:px-8 flex justify-between items-center shadow-md border-b border-[#2E7D32]">
        <div className="flex items-center gap-3">
          <div className="bg-[#82C69E] text-[#1B4D3E] p-1.5 rounded-lg font-black text-xl tracking-wider shadow-inner">
            C³
          </div>
          <div>
            <h1 className="font-extrabold text-base lg:text-lg tracking-tight flex items-center gap-2">
              CubeUp³ <span className="text-[#82C69E] text-xs px-2 py-0.5 rounded-full border border-[#82C69E]/40 font-mono">TALLER FDM & MSLA</span>
            </h1>
            <p className="text-[11px] text-gray-300 font-mono">Cotizador Técnico de Manufactura Aditiva</p>
          </div>
        </div>

        {/* Global Nav Toggles */}
        <div className="flex items-center gap-2">
          <div className="bg-[#153e32] p-1 rounded-xl flex items-center border border-[#2E7D32]">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'calculator' 
                  ? 'bg-[#2E7D32] text-white shadow-sm' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Printer size={14} /> Cotizador
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'history' 
                  ? 'bg-[#2E7D32] text-white shadow-sm' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <History size={14} /> Historial
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        
        {activeTab === 'history' ? (
          <QuoteHistory 
            onEditDraft={handleEditDraft}
            onOpenPresetsModal={() => setShowPresetsModal(true)}
          />
        ) : (
          <>
            {/* Top Workspace Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              
              {/* Left Col: Inputs & Add forms */}
              <div className="md:col-span-5 xl:col-span-4 flex flex-col gap-5">
                
                {/* Asesor & Cliente Box */}
                <div className="bg-white p-4 rounded-2xl border border-[#82C69E]/50 shadow-sm flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Asesor Técnico (Operador)</label>
                      <button 
                        type="button" 
                        onClick={() => setIsAddingOperator(!isAddingOperator)}
                        className="text-[10px] text-[#2E7D32] hover:underline font-bold flex items-center gap-1"
                      >
                        {isAddingOperator ? 'Ver lista' : '+ Nuevo asesor'}
                      </button>
                    </div>

                    {isAddingOperator ? (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newOperatorInput} 
                          onChange={e => setNewOperatorInput(e.target.value)}
                          placeholder="Nombre del asesor..."
                          className="flex-1 bg-[#F7F5F0] border border-[#82C69E] rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                        />
                        <button 
                          onClick={handleAddOperator}
                          className="bg-[#1B4D3E] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#2E7D32]"
                        >
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <select 
                        value={operatorName} 
                        onChange={e => setOperatorName(e.target.value)}
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-sm font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                      >
                        <option value="">Seleccione asesor técnico...</option>
                        {presetOperators.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Cliente / Proyecto (Opcional)</label>
                    <input 
                      type="text" 
                      value={clientName} 
                      onChange={e => setClientName(e.target.value)}
                      placeholder="Empresa o contacto..."
                      className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-sm font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                    />
                  </div>
                </div>

                {/* Calculadora (Piezas FDM / Dictamen) */}
                <form onSubmit={handleAddPiece} className="bg-white p-5 rounded-2xl border border-[#82C69E]/60 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-bold text-[#1B4D3E] flex items-center gap-2">
                      <Printer size={15}/> Dictamen de Impresión
                    </h3>
                    <span className="text-[10px] bg-[#F7F5F0] text-[#2E7D32] px-2 py-0.5 rounded font-mono font-bold border border-[#82C69E]/40">
                      Lote Configurable
                    </span>
                  </div>
                  
                  {/* Nombre y Cantidad de Piezas */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Descripción de la Pieza</label>
                      <input 
                        type="text" 
                        value={itemName} 
                        onChange={e => setItemName(e.target.value)} 
                        placeholder="Ej. Carcasa V2, Engrane..." 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-sm font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Piezas (Lote)</label>
                      <input 
                        type="number" 
                        min="1" 
                        step="1" 
                        value={itemQuantity} 
                        onChange={e => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                        className="w-full bg-[#F7F5F0] border border-[#1B4D3E] rounded-lg p-2 text-sm font-extrabold text-[#1B4D3E] text-center focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center bg-[#F7F5F0] p-1 rounded">
                        <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold ml-1">Perfil / Material</label>
                        <button 
                          type="button" 
                          onClick={() => setIsEditingProfiles(true)} 
                          className="bg-[#1B4D3E] text-white px-2 py-0.5 rounded text-[9px] uppercase font-mono font-bold hover:bg-[#2E7D32] transition-colors cursor-pointer"
                        >
                          <Settings size={10} className="inline mr-1" /> Editar
                        </button>
                      </div>
                      
                      <select 
                        value={profileId} 
                        onChange={e => setProfileId(e.target.value)} 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                      >
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Masa Unit. (g)</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.1" 
                        value={weight} 
                        onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ej. 150" 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-sm font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold leading-tight" title="Tiempo de máquina por pieza en horas">
                        T. Máquina Unit. (H)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.1" 
                        value={hours} 
                        onChange={e => setHours(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ej. 5.5" 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-sm font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold leading-tight" title="Mano de obra o preparación para esta pieza">
                        Mano de Obra ($)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="1" 
                        value={pieceLabor} 
                        onChange={e => setPieceLabor(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ej. 50" 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-sm font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                    </div>
                  </div>

                  {/* Resumen dinámico en vivo considerando la cantidad */}
                  <div className="flex items-center justify-between text-xs font-bold text-[#1B4D3E] bg-[#F0FDF4] px-3 py-2 rounded-lg border border-[#82C69E] mt-1">
                    <div className="flex flex-col">
                      <span className="uppercase tracking-widest font-mono text-[9px] text-gray-500">
                        Total {itemQuantity} {itemQuantity === 1 ? 'Pieza' : 'Piezas'}
                      </span>
                      <span className="font-mono text-[11px] text-[#2E7D32]">
                        Unitario: {livePiecePrice > 0 ? formatMXN(livePiecePrice) : '$ 0.00'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="uppercase tracking-widest font-mono text-[9px] text-gray-500 block">Subtotal Lote</span>
                      <span className="font-mono text-base font-black text-[#1B4D3E]">
                        {livePiecePrice > 0 ? formatMXN(livePiecePrice * itemQuantity) : '$ 0.00'}
                      </span>
                    </div>
                  </div>

                  {editItemId && ticketItems.find(i => i.id === editItemId)?.itemType !== 'hardware' ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button 
                        type="submit" 
                        disabled={!itemName || weight === '' || hours === ''} 
                        className="w-full bg-[#1B4D3E] text-white py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] transition-all disabled:opacity-50"
                      >
                        <Check size={15}/> Guardar Cambios
                      </button>
                      <button 
                        type="button" 
                        onClick={cancelEdit} 
                        className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#F7F5F0] transition-all"
                      >
                        <X size={15}/> Cancelar
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="submit" 
                      disabled={!itemName || weight === '' || hours === ''} 
                      className="mt-1 w-full bg-[#1B4D3E] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm"
                    >
                      <Plus size={16}/> Añadir {itemQuantity > 1 ? `${itemQuantity} Piezas` : 'al Ticket'}
                    </button>
                  )}
                </form>

                {/* Accesorios / Hardware con soporte de cantidad */}
                <form onSubmit={handleAddHardware} className="bg-white p-5 rounded-2xl border border-[#82C69E]/60 shadow-sm flex flex-col gap-3">
                  <h3 className="text-xs uppercase font-bold text-[#1B4D3E] flex items-center gap-2">
                    <Cpu size={15}/> Insumos Extra (Hardware)
                  </h3>
                  <p className="text-[10px] leading-tight text-gray-500">
                    Tornillería, insertos térmicos, empaques o componentes no impresos.
                  </p>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <input 
                      type="text" 
                      value={hwName} 
                      onChange={e => setHwName(e.target.value)} 
                      placeholder="Ej. Insertos M3..." 
                      className="col-span-2 bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                    />
                    <input 
                      type="number" 
                      min="1" 
                      step="1" 
                      value={hwQuantity} 
                      onChange={e => setHwQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                      title="Cantidad"
                      placeholder="Cant."
                      className="bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-center text-[#1B4D3E] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                    />
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      value={hwPrice} 
                      onChange={e => setHwPrice(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder="$ Unit." 
                      className="bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                    />
                  </div>

                  {editItemId && ticketItems.find(i => i.id === editItemId)?.itemType === 'hardware' ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button 
                        type="submit" 
                        disabled={!hwName || hwPrice === ''} 
                        className="w-full bg-[#1B4D3E] text-white py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-1 hover:bg-[#2E7D32]"
                      >
                        <Check size={14}/> Guardar
                      </button>
                      <button 
                        type="button" 
                        onClick={cancelEdit} 
                        className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-1"
                      >
                        <X size={14}/> Cancelar
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="submit" 
                      disabled={!hwName || hwPrice === ''} 
                      className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#F0FDF4] transition-all disabled:opacity-50"
                    >
                      <Plus size={14}/> Añadir Insumo
                    </button>
                  )}
                </form>

              </div>

              {/* Right Col: Ticket / En Curso con Selector de Piezas */}
              <div className="md:col-span-7 xl:col-span-8 flex flex-col bg-white border border-[#82C69E]/70 rounded-2xl shadow-sm overflow-hidden relative pb-4">
                
                {/* Header del Ticket */}
                <div className="bg-[#1B4D3E] text-white p-4 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText size={16}/>
                    <h2 className="font-bold text-sm tracking-widest uppercase">Cotización en Curso</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {ticketItems.length > 0 && (
                      <button
                        onClick={handleClear}
                        className="text-xs text-red-200 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors"
                        title="Limpiar ticket actual"
                      >
                        <RotateCcw size={12} /> Limpiar
                      </button>
                    )}
                    {savedQuoteId && (
                      <span className="bg-[#82C69E] text-[#1B4D3E] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                        Borrador Sincronizado
                      </span>
                    )}
                  </div>
                </div>

                {/* Lista de Partidas */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#F7F5F0]/40 min-h-[350px]">
                  {ticketItems.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center opacity-40 gap-3 py-16 text-[#1B4D3E]">
                      <FileText size={48} strokeWidth={1} />
                      <span className="font-mono uppercase tracking-widest text-xs text-center leading-relaxed">
                        El ticket está vacío.<br/>Captura piezas o componentes a la izquierda.
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {ticketItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="bg-white border border-[#82C69E]/40 rounded-xl p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-xs hover:border-[#1B4D3E] transition-colors relative overflow-hidden"
                        >
                          <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${item.itemType === 'hardware' ? 'bg-[#2E7D32]' : 'bg-[#1B4D3E]'}`}></div>
                          
                          {/* Datos de la pieza */}
                          <div className="flex flex-col pl-2 flex-1 min-w-[180px]">
                            <span className="font-bold text-[#1B4D3E] text-sm sm:text-base">{item.itemName}</span>
                            <span className="text-[10px] font-mono text-gray-500 uppercase mt-0.5">
                              {item.itemType === 'hardware' 
                                ? 'Hardware Adicional' 
                                : `${item.profileName} · ${item.weightInfo}g · ${item.timeInfo}h`
                              }
                            </span>
                          </div>

                          {/* Control de Cantidad (Stepper en vivo) */}
                          <div className="flex items-center gap-1.5 bg-[#F7F5F0] px-2 py-1 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-mono text-gray-500 uppercase font-semibold mr-1">Piezas:</span>
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.id, (item.quantity || 1) - 1)}
                              disabled={(item.quantity || 1) <= 1}
                              className="w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 hover:bg-[#82C69E]/20 disabled:opacity-30 disabled:pointer-events-none"
                              title="Restar pieza"
                            >
                              <Minus size={12} />
                            </button>
                            
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity || 1}
                              onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-12 text-center text-xs font-bold text-[#1B4D3E] bg-white border border-gray-300 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                            />

                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.id, (item.quantity || 1) + 1)}
                              className="w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 hover:bg-[#82C69E]/20"
                              title="Sumar pieza"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          {/* Precios e importes */}
                          <div className="flex items-center gap-3">
                            <div className="text-right flex flex-col min-w-[90px]">
                              <span className="text-[9px] uppercase font-mono text-gray-400">
                                {formatMXN(item.unitPrice)} c/u
                              </span>
                              <span className="font-extrabold text-base text-[#1B4D3E]">
                                {formatMXN(item.totalPrice)}
                              </span>
                            </div>

                            <button 
                              onClick={() => handleEditItemInfo(item)} 
                              className="text-gray-400 hover:text-[#1B4D3E] p-1.5 hover:bg-[#F7F5F0] rounded transition-colors" 
                              title="Editar especificaciones"
                            >
                              <Settings size={15} />
                            </button>
                            <button 
                              onClick={() => setTicketItems(ticketItems.filter(i => i.id !== item.id))} 
                              className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors" 
                              title="Eliminar partida"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer del Ticket: Totales y Botones de Acción */}
                <div className="shrink-0 p-4 lg:p-6 bg-white border-t border-[#82C69E]/40">
                  
                  {/* Desglose de Inversión vs Margen */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    <div className="flex justify-between items-center bg-[#F7F5F0] p-2.5 px-3 rounded-xl border border-gray-200">
                      <span className="uppercase font-mono text-[10px] font-bold text-gray-500 tracking-wider">
                        Inversión de Taller (Costo)
                      </span>
                      <span className="font-mono text-sm font-bold text-gray-700">{formatMXN(lgCosts)}</span>
                    </div>

                    <div className="flex justify-between items-center bg-[#F0FDF4] p-2.5 px-3 rounded-xl border border-[#82C69E]">
                      <div className="flex items-center gap-2">
                        <span className="uppercase font-mono text-[10px] font-bold text-[#1B4D3E] tracking-wider">
                          Margen de Ganancia
                        </span>
                        <div className="flex items-center bg-white border border-[#2E7D32] rounded px-1.5 py-0.5">
                          <input 
                            type="number" 
                            min="0" 
                            step="1" 
                            value={globalMargin} 
                            onChange={e => setGlobalMargin(Number(e.target.value))} 
                            className="w-10 text-center text-xs font-bold text-[#1B4D3E] focus:outline-none" 
                          />
                          <span className="text-xs text-[#2E7D32] font-bold">%</span>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#2E7D32]">+{formatMXN(lgProfit)}</span>
                    </div>
                  </div>

                  {/* Total de Venta */}
                  <div className="flex justify-between items-baseline mb-5 pb-3 border-b border-gray-100">
                    <span className="uppercase font-mono text-xs font-bold text-gray-500 tracking-wider">
                      Importe Total de Venta
                    </span>
                    <span className="text-3xl lg:text-4xl font-extrabold text-[#1B4D3E] tracking-tight">
                      {formatMXN(lgTotals)} <span className="text-xs font-mono font-normal text-gray-400">MXN</span>
                    </span>
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleSave} 
                      disabled={ticketItems.length === 0} 
                      className="w-full bg-[#1B4D3E] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
                    >
                      <Save size={15}/> Guardar Cotización
                    </button>

                    <div className="p-3 bg-[#F7F5F0] rounded-xl border border-[#82C69E]/50 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[#1B4D3E]">
                        <Share2 size={14} className="text-[#2E7D32]" />
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider">Exportar & Compartir</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={handleGenerateLocalPDF}
                          disabled={ticketItems.length === 0}
                          className="bg-white border border-[#1B4D3E] text-[#1B4D3E] py-1.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#F0FDF4] transition-colors disabled:opacity-40"
                        >
                          <FileText size={13} /> PDF
                        </button>

                        <button 
                          type="button"
                          onClick={() => setShowPresetsModal(true)}
                          disabled={ticketItems.length === 0}
                          className="bg-[#2E7D32] text-white py-1.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#1B4D3E] transition-colors disabled:opacity-40"
                        >
                          <MessageSquare size={13} /> WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </>
        )}

      </main>

      {/* Modal de Presets de Mensajes de WhatsApp */}
      {showPresetsModal && (
        <MessagePresetsModal 
          isOpen={showPresetsModal}
          onClose={() => setShowPresetsModal(false)}
          quote={{
            id: savedQuoteId || 'BORRADOR',
            folio: savedQuoteId ? (quotes.find(q => q.id === savedQuoteId)?.folio || 'CUB-NUEVO') : 'CUB-NUEVO',
            clientName: clientName || 'Cliente',
            operatorName: operatorName || 'Asesor Técnico',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'borrador',
            statusHistory: [],
            total: lgTotals,
            items: ticketItems,
            globalMargin,
            notes: '',
            isArchived: false
          }}
        />
      )}

      {/* Modal de Edición de Perfiles de Material */}
      {isEditingProfiles && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#82C69E] w-full max-w-lg rounded-2xl shadow-xl p-6 flex flex-col gap-4 text-[#2B2B2B]">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-[#1B4D3E] flex items-center gap-2">
                <Settings size={18} /> Configuración de Materiales y Tarifas
              </h3>
              <button 
                onClick={() => setIsEditingProfiles(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
              {profiles.map(p => (
                <div key={p.id} className="flex justify-between items-center p-2.5 bg-[#F7F5F0] rounded-xl border border-gray-200">
                  <div>
                    <span className="font-bold text-xs text-[#1B4D3E] block">{p.name}</span>
                    <span className="text-[10px] font-mono text-gray-500">
                      Filamento: ${p.spoolCost}/kg · Máquina: ${p.machineHour}/h
                    </span>
                  </div>
                  {profiles.length > 1 && (
                    <button 
                      onClick={() => handleRemoveProfile(p.id)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded"
                      title="Eliminar perfil"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-[#F0FDF4] p-3.5 rounded-xl border border-[#82C69E]/50 flex flex-col gap-2">
              <span className="text-xs font-bold text-[#1B4D3E]">Agregar Nuevo Perfil</span>
              <input 
                type="text" 
                placeholder="Nombre (ej. Nylon Fibra de Carbono)" 
                value={newProfileName} 
                onChange={e => setNewProfileName(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg p-2 text-xs font-medium focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="number" 
                  placeholder="Costo Bobina ($/kg)" 
                  value={newProfileSpool} 
                  onChange={e => setNewProfileSpool(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-gray-300 rounded-lg p-2 text-xs font-medium focus:outline-none"
                />
                <input 
                  type="number" 
                  placeholder="Costo Hora ($/h)" 
                  value={newProfileHour} 
                  onChange={e => setNewProfileHour(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-white border border-gray-300 rounded-lg p-2 text-xs font-medium focus:outline-none"
                />
              </div>
              <button 
                onClick={handleAddProfile}
                className="bg-[#1B4D3E] hover:bg-[#2E7D32] text-white py-2 rounded-lg text-xs font-bold transition-colors mt-1"
              >
                Guardar Perfil
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
export default App;
