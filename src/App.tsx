import React, { useState, useEffect, useMemo } from 'react';
import { QuoteHistory } from './components/QuoteHistory';
import { useQuoteHistory, Quote, TicketItem } from './hooks/useQuoteHistory';
import { auth, provider } from './lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { 
  Calculator, History, Cpu, DollarSign, Target, Settings, Copy, Save, Share2, LogOut, Check, FileText, User, Printer, Plus, Trash2, X 
} from 'lucide-react';

const PRESET_OPERATORS = [
  "Ing. Carlos Pérez - Lead 3D",
  "Dis. Ana Lilia - Diseño Industrial",
  "Tech. José Gutiérrez - Op Máquinas",
  "Ing. Marcos - Producción FFF"
];

const DEFAULT_PROFILES = [
  { id: 'pla', name: 'PLA Estándar', spoolCost: 500, machineHour: 15 },
  { id: 'petg', name: 'PETG Industrial', spoolCost: 800, machineHour: 20 },
  { id: 'abs', name: 'ABS / ASA', spoolCost: 1000, machineHour: 30 },
  { id: 'tpu', name: 'TPU Flexible', spoolCost: 1200, machineHour: 25 },
];

export const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

function MainApp() {
  const [currentTab, setCurrentTab] = useState<'calculator' | 'history'>('calculator');
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  
  // Header Details
  const [operatorName, setOperatorName] = useState('');
  const [clientName, setClientName] = useState('');
  
  // Custom operators
  const [presetOperators, setPresetOperators] = useState<string[]>(() => {
    const saved = localStorage.getItem('cubeup3-custom-operators');
    if (saved) return JSON.parse(saved);
    return PRESET_OPERATORS;
  });
  const [isEditingOperators, setIsEditingOperators] = useState(false);
  const [newOperatorInput, setNewOperatorInput] = useState('');

  // Custom profiles
  const [profiles, setProfiles] = useState<any[]>(() => {
    const saved = localStorage.getItem('cubeup3-custom-profiles');
    if (saved) {
       const parsed = JSON.parse(saved);
       return parsed.map((p: any) => ({
         ...p,
         spoolCost: p.spoolCost !== undefined ? p.spoolCost : (p.materialCost ? p.materialCost * 1000 : 500),
         machineHour: p.machineHour !== undefined ? p.machineHour : 15
       }));
    }
    return DEFAULT_PROFILES;
  });
  const [isEditingProfiles, setIsEditingProfiles] = useState(false);
  const [newProfileInput, setNewProfileInput] = useState({ name: '', spoolCost: '', machineHour: '' });
  
  const [profileEditingId, setProfileEditingId] = useState<string | null>(null);
  const [editProfileInput, setEditProfileInput] = useState({ name: '', spoolCost: '', machineHour: '' });

  const startEditProfile = (p: any) => {
    setProfileEditingId(p.id);
    setEditProfileInput({
      name: p.name,
      spoolCost: p.spoolCost.toString(),
      machineHour: p.machineHour.toString()
    });
  };

  const handleUpdateProfile = () => {
    if (!editProfileInput.name.trim() || !editProfileInput.spoolCost || !editProfileInput.machineHour) return;
    
    const updated = profiles.map(p => {
      if (p.id === profileEditingId) {
        return {
          ...p,
          name: editProfileInput.name.trim(),
          spoolCost: Number(editProfileInput.spoolCost),
          machineHour: Number(editProfileInput.machineHour),
        };
      }
      return p;
    });
    
    setProfiles(updated);
    localStorage.setItem('cubeup3-custom-profiles', JSON.stringify(updated));
    setProfileEditingId(null);
  };

  const handleAddProfile = () => {
    if (!newProfileInput.name.trim() || !newProfileInput.spoolCost || !newProfileInput.machineHour) return;
    const p = {
      id: Math.random().toString(),
      name: newProfileInput.name.trim(),
      spoolCost: Number(newProfileInput.spoolCost),
      machineHour: Number(newProfileInput.machineHour),
    };
    const updated = [...profiles, p];
    setProfiles(updated);
    localStorage.setItem('cubeup3-custom-profiles', JSON.stringify(updated));
    setProfileId(p.id);
    setNewProfileInput({ name: '', spoolCost: '', machineHour: '' });
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
  };

  const handleRemoveOperator = (op: string) => {
    const updated = presetOperators.filter(o => o !== op);
    setPresetOperators(updated);
    localStorage.setItem('cubeup3-custom-operators', JSON.stringify(updated));
    if (operatorName === op) setOperatorName('');
  };

  
  // Calculate Item form
  const [itemName, setItemName] = useState('');
  const [profileId, setProfileId] = useState(() => {
    const saved = localStorage.getItem('cubeup3-custom-profiles');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed[0].id;
    }
    return 'pla';
  });
  const [weight, setWeight] = useState<number | ''>('');
  const [hours, setHours] = useState<number | ''>('');
  const [pieceLabor, setPieceLabor] = useState<number | ''>('');
  
  // Global attributes
  const [globalMargin, setGlobalMargin] = useState<number>(30);
  
  // Hardware form
  const [hwName, setHwName] = useState('');
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

  // Real-time autosave for drafts (debounced 1.5s)
  useEffect(() => {
    if (!savedQuoteId || ticketItems.length === 0) return;
    const currentQuote = quotes.find(q => q.id === savedQuoteId);
    if (currentQuote && currentQuote.status !== 'borrador') return;

    const timeoutMsg = setTimeout(() => {
       saveQuote(ticketItems, operatorName, clientName, currentQuote?.notes || '', globalMargin, savedQuoteId).catch(console.error);
    }, 1500);
    return () => clearTimeout(timeoutMsg);
  }, [ticketItems, operatorName, clientName, globalMargin, savedQuoteId, saveQuote, quotes]);

  const handleAddPiece = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || weight === '' || hours === '') return;
    const profile = profiles.find(p => p.id === profileId)!;
    
    const w = Number(weight);
    const h = Number(hours);
    const materialCost = (w / 1000) * (profile.spoolCost || 500);
    const machineCost = h * profile.machineHour;
    const labor = Number(pieceLabor) || 0;
    
    const unitCost = materialCost + machineCost + labor;
    const unitPrice = unitCost * (1 + globalMargin / 100);

    const newItem = {
      id: editItemId || Math.random().toString(),
      itemName: itemName,
      quantity: 1,
      profileName: profile.name,
      weightInfo: w,
      timeInfo: h,
      unitCost: unitCost,
      totalCost: unitCost,
      unitPrice: unitPrice,
      totalPrice: unitPrice,
      itemType: 'print' as const,
      profileId: profile.id,
      laborInfo: labor
    };

    if (editItemId) {
      setTicketItems(ticketItems.map(item => item.id === editItemId ? newItem : item));
      setEditItemId(null);
    } else {
      setTicketItems([...ticketItems, newItem]);
    }
    
    setItemName('');
    setWeight('');
    setHours('');
    setPieceLabor('');
  };

  const handleAddHardware = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwName || hwPrice === '') return;
    const cost = Number(hwPrice);
    const price = cost * (1 + globalMargin / 100);
    const newItem = {
      id: editItemId || Math.random().toString(),
      itemName: hwName,
      quantity: 1,
      profileName: 'Hardware Adicional',
      weightInfo: 0,
      timeInfo: 0,
      unitCost: cost,
      totalCost: cost,
      unitPrice: price,
      totalPrice: price,
      itemType: 'hardware' as const
    };

    if (editItemId) {
      setTicketItems(ticketItems.map(item => item.id === editItemId ? newItem : item));
      setEditItemId(null);
    } else {
      setTicketItems([...ticketItems, newItem]);
    }
    setHwName('');
    setHwPrice('');
  };

  const cancelEdit = () => {
    setEditItemId(null);
    setItemName('');
    setWeight('');
    setHours('');
    setPieceLabor('');
    setHwName('');
    setHwPrice('');
  };

  const handleEditItemInfo = (item: TicketItem) => {
    setEditItemId(item.id);
    if (item.itemType === 'hardware') {
      setHwName(item.itemName);
      setHwPrice(item.unitCost.toString() as any);
      // scroll to hardware form
    } else {
      setItemName(item.itemName);
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
      const q = await saveQuote(ticketItems, operatorName, clientName, '', savedQuoteId || undefined);
      setSavedQuoteId(q.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditDraft = (quote: Quote) => {
    setTicketItems(quote.items);
    setClientName(quote.clientName || '');
    setOperatorName(quote.operatorName || '');
    setSavedQuoteId(quote.id);
    setCurrentTab('calculator');
  };

  const lgTotals = ticketItems.reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  const lgCosts = ticketItems.reduce((acc, i) => acc + (i.totalCost || 0), 0);
  const lgProfit = lgTotals - lgCosts;

  return (
    <div className="min-h-screen bg-[#F0FDF4] flex flex-col font-sans text-stone-900 border-t-4 border-[#065F46]">
      {/* Header Compacto */}
      <header className="bg-white border-b border-[#A7F3D0] shadow-sm px-6 py-3 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3 w-1/4">
          <div className="bg-[#059669] text-white p-2 rounded-lg shadow-inner"><Target size={20} /></div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight tracking-tight">CubeUp³</h1>
            <p className="text-[9px] uppercase font-mono text-emerald-800 font-bold tracking-widest hidden lg:block">Inteligencia Compartida</p>
          </div>
        </div>

        <div className="flex bg-[#ECFDF5] p-1 rounded-xl shadow-inner border border-[#D1FAE5]">
          <button 
             onClick={() => setCurrentTab('calculator')}
             className={`px-6 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${currentTab === 'calculator' ? 'bg-white shadow text-[#065F46]' : 'text-emerald-800 hover:bg-[#D1FAE5]'}`}
          >
            <Calculator size={14} /> Taller
          </button>
          <button 
             onClick={() => setCurrentTab('history')}
             className={`px-6 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${currentTab === 'history' ? 'bg-white shadow text-[#065F46]' : 'text-emerald-800 hover:bg-[#D1FAE5]'}`}
          >
            <History size={14} /> Historial
          </button>
        </div>

        <div className="flex items-center gap-4 w-1/4 justify-end">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-gray-900">Usuario Público</p>
            <p className="text-[10px] text-emerald-800">Acceso Compartido</p>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 overflow-hidden flex flex-col">
        {currentTab === 'history' ? (
          <QuoteHistory 
             onNewQuote={() => {
               setTicketItems([]);
               setClientName('');
               setSavedQuoteId(null);
               setCurrentTab('calculator');
             }}
             onEdit={handleEditDraft}
             onCloneQuote={(quote) => {
               const newItems = quote.items.map(it => ({ ...it, id: Math.random().toString() }));
               setTicketItems(newItems);
               setClientName(quote.clientName);
               setOperatorName(quote.operatorName);
               setSavedQuoteId(quote.id);
               setCurrentTab('calculator');
             }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 h-full flex-1 min-h-0">
             
             {/* Left Col: Config & Add */}
             <div className="md:col-span-5 xl:col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 pb-10">
                
                {/* Metadatos del ticket */}
                <div className="bg-white p-5 rounded-2xl border border-[#A7F3D0] shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs uppercase font-bold text-gray-900 flex items-center gap-2 mb-1"><User size={14}/> Datos Solicitud</h3>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold">Asesor Responsable</label>
                      <button type="button" onClick={() => setIsEditingOperators(!isEditingOperators)} className="text-[10px] uppercase font-mono text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer">
                        <Settings size={10} /> Editar Opciones
                      </button>
                    </div>
                    {isEditingOperators ? (
                      <div className="flex flex-col gap-2 p-2 bg-[#F0FDF4] border border-[#A7F3D0] rounded-lg mt-1">
                        {presetOperators.map(op => (
                          <div key={op} className="flex justify-between items-center text-xs font-bold text-gray-900 bg-white p-2 rounded shadow-sm">
                            {op}
                            <button type="button" onClick={() => handleRemoveOperator(op)} className="text-red-500 opacity-60 hover:opacity-100"><Trash2 size={14}/></button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                           <input type="text" value={newOperatorInput} onChange={e => setNewOperatorInput(e.target.value)} placeholder="Nuevo asesor..." className="flex-1 bg-white border border-[#A7F3D0] rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#059669]" />
                           <button type="button" onClick={handleAddOperator} className="bg-[#059669] text-white p-1.5 rounded-lg hover:bg-[#064E3B] flex-shrink-0 cursor-pointer"><Plus size={14}/></button>
                        </div>
                      </div>
                    ) : (
                      <select 
                        value={operatorName} onChange={e => setOperatorName(e.target.value)}
                        className="w-full bg-[#F0FDF4] border border-[#A7F3D0] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669] cursor-pointer"
                      >
                        <option value="">Seleccione o escriba...</option>
                        {presetOperators.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold">Cliente / Proyecto (Opcional)</label>
                    <input 
                      type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                      placeholder="Nombre de la empresa o proyecto..."
                      className="w-full bg-[#F0FDF4] border border-[#A7F3D0] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]"
                    />
                  </div>
                </div>

                {/* Calculadora (Piezas) */}
                <form onSubmit={handleAddPiece} className="bg-white p-5 rounded-2xl border border-[#A7F3D0] shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs uppercase font-bold text-gray-900 flex items-center gap-2 mb-1"><Printer size={14}/> Dictamen de Impresión</h3>
                  
                  <input type="text" value={itemName} onChange={e=>setItemName(e.target.value)} placeholder="Nombre de la pieza (Ej. Engranaje V2)" className="w-full bg-[#F0FDF4] border border-[#A7F3D0] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669] placeholder-[#059669]/50" />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center bg-[#F0FDF4] p-1 rounded">
                        <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold ml-1">Perfil / Material</label>
                        <button type="button" onClick={() => setIsEditingProfiles(true)} className="bg-[#059669] text-white px-2 py-1 rounded text-[9px] uppercase font-mono font-bold hover:bg-emerald-800 transition-colors cursor-pointer">
                          <Settings size={10} className="inline mr-1" /> Editar
                        </button>
                      </div>
                      
                      <select value={profileId} onChange={e=>setProfileId(e.target.value)} className="w-full bg-[#F0FDF4] border border-[#059669] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]">
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold">Masa (g)</label>
                      <input type="number" min="0" step="0.1" value={weight} onChange={e=>setWeight(Number(e.target.value))} placeholder="Ej. 150" className="w-full bg-[#F0FDF4] border border-[#059669] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold leading-tight" title="Tiempo Operativo Máquina (Horas)">T. Máquina (H)</label>
                      <input type="number" min="0" step="0.1" value={hours} onChange={e=>setHours(Number(e.target.value))} placeholder="Ej. 5.5" className="w-full bg-[#F0FDF4] border border-[#059669] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold leading-tight" title="Mano de obra o costos fijos para esta pieza">Mano de obra ($)</label>
                      <input type="number" min="0" step="1" value={pieceLabor} onChange={e=>setPieceLabor(Number(e.target.value))} placeholder="Ej. 50" className="w-full bg-[#F0FDF4] border border-[#059669] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg border border-[#A7F3D0] mt-1 shadow-sm">
                    <span className="uppercase tracking-widest font-mono text-[9px] opacity-70">Costo Base</span>
                    <span className="font-mono text-base">{livePiecePrice > 0 ? formatMXN(livePiecePrice / (1 + globalMargin / 100)) : '$ 0.00'}</span>
                  </div>

                  {editItemId && ticketItems.find(i => i.id === editItemId)?.itemType !== 'hardware' ? (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button type="submit" disabled={!itemName || weight==='' || hours===''} className="w-full bg-[#059669] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-800 active:scale-[0.98] transition-all disabled:opacity-50">
                        <Check size={16}/> Guardar Cambios
                      </button>
                      <button type="button" onClick={cancelEdit} className="w-full bg-white border border-[#059669] text-[#059669] py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#F0FDF4] active:scale-[0.98] transition-all">
                        <X size={16}/> Cancelar
                      </button>
                    </div>
                  ) : (
                    <button type="submit" disabled={!itemName || weight==='' || hours===''} className="mt-2 w-full bg-[#059669] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-md">
                      <Plus size={16}/> Añadir al Ticket
                    </button>
                  )}
                </form>

                {/* Accesorios / Hardware */}
                <form onSubmit={handleAddHardware} className="bg-[#F0FDF4] p-5 rounded-2xl border border-[#A7F3D0] shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs uppercase font-bold text-gray-900 flex items-center gap-2 mb-1"><Cpu size={14}/> Insumos Extra (Hardware)</h3>
                  <p className="text-[10px] leading-tight text-emerald-800/70">Tornillería, insertos térmicos, rodamientos, o cualquier elemento no impreso.</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" value={hwName} onChange={e=>setHwName(e.target.value)} placeholder="Tornillos M3..." className="col-span-2 bg-white border border-[#A7F3D0] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                    <input type="number" min="0" step="1" value={hwPrice} onChange={e=>setHwPrice(Number(e.target.value))} placeholder="$ 0.00" className="bg-white border border-[#A7F3D0] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg border border-[#A7F3D0] mt-1 shadow-sm">
                    <span className="uppercase tracking-widest font-mono text-[9px] opacity-70">Precio Insumo</span>
                    <span className="font-mono text-base">{Number(hwPrice) > 0 ? formatMXN(Number(hwPrice)) : '$ 0.00'}</span>
                  </div>
                  
                  {editItemId && ticketItems.find(i => i.id === editItemId)?.itemType === 'hardware' ? (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                       <button type="submit" disabled={!hwName || hwPrice===''} className="w-full bg-[#059669] text-white py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-800 active:scale-[0.98] transition-all disabled:opacity-50">
                          <Check size={16}/> Guardar Cambios
                       </button>
                       <button type="button" onClick={cancelEdit} className="w-full bg-white border border-[#059669] text-[#059669] py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#F0FDF4] active:scale-[0.98] transition-all">
                          <X size={16}/> Cancelar
                       </button>
                    </div>
                  ) : (
                    <button type="submit" disabled={!hwName || hwPrice===''} className="w-full bg-white border-2 border-[#059669] text-emerald-800 py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#D1FAE5] active:scale-[0.98] transition-all disabled:opacity-50">
                      <Plus size={16}/> Añadir Insumo
                    </button>
                  )}
                </form>

             </div>

             {/* Right Col: Ticket / View */}
             <div className="md:col-span-7 xl:col-span-8 flex flex-col bg-white border-2 border-[#A7F3D0] rounded-2xl shadow-xl overflow-hidden relative pb-4">
                <div className="bg-[#059669] text-white p-4 flex justify-between items-center shrink-0">
                  <h2 className="font-bold text-sm tracking-widest uppercase flex items-center gap-2"><FileText size={16}/> Cotización en curso</h2>
                  {savedQuoteId && <span className="bg-[#064e3b] text-[10px] px-3 py-1 rounded-full uppercase tracking-wider font-mono shadow-inner shadow-black/20">Borrador Guardado</span>}
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#F0FDF4] bg-opacity-30">
                   {ticketItems.length === 0 ? (
                      <div className="h-full flex flex-col justify-center items-center opacity-30 gap-4 text-[#064e3b]">
                        <FileText size={48} strokeWidth={1} />
                        <span className="font-mono uppercase tracking-widest text-xs text-center leading-relaxed">El ticket está vacío<br/>Comienza a añadir piezas.</span>
                      </div>
                   ) : (
                      <div className="flex flex-col gap-3">
                         {ticketItems.map((item, i) => (
                           <div key={item.id} className="bg-white/90 backdrop-blur-sm border border-[#A7F3D0] rounded-xl p-4 flex items-center justify-between shadow-sm group hover:border-[#059669] transition-colors relative overflow-hidden">
                              <div className={`absolute top-0 left-0 bottom-0 w-1 ${item.itemType === 'hardware' ? 'bg-[#064e3b]' : 'bg-[#10B981]'}`}></div>
                              
                              <div className="flex flex-col pl-3">
                                 <span className="font-bold text-[#064e3b] text-base">{item.itemName}</span>
                                 <span className="text-[10px] font-mono text-emerald-800 uppercase font-bold mt-0.5">
                                    {item.itemType === 'hardware' ? 'Hardware Adicional' : `${item.profileName} — ${item.weightInfo}g / ${item.timeInfo}h`}
                                 </span>
                              </div>

                              <div className="flex items-center gap-2 lg:gap-4">
                                 <div className="text-right flex flex-col mr-2">
                                   <span className="text-[9px] uppercase font-mono text-[#064e3b] opacity-50">Precio Final</span>
                                   <span className="font-black text-lg text-emerald-800">{formatMXN(item.totalPrice)}</span>
                                 </div>
                                 <button onClick={() => handleEditItemInfo(item)} className="text-emerald-600 opacity-20 group-hover:opacity-100 p-2 hover:bg-emerald-50 rounded transition-all" title="Editar">
                                   <Settings size={16} />
                                 </button>
                                 <button onClick={() => setTicketItems(ticketItems.filter((_, idx)=>idx!==i))} className="text-red-400 opacity-20 group-hover:opacity-100 p-2 hover:bg-red-50 rounded transition-all" title="Eliminar">
                                   <Trash2 size={16} />
                                 </button>
                              </div>
                           </div>
                         ))}
                      </div>
                   )}
                </div>

                <div className="shrink-0 p-4 lg:p-6 bg-white border-t border-[#A7F3D0]">
                   
                   <div className="flex flex-col gap-2 mb-6">
                     <div className="flex justify-between items-center bg-gray-50 p-2 px-3 rounded-lg border border-gray-100">
                       <span className="uppercase font-mono text-[10px] font-bold text-gray-500 tracking-widest">Inversión (Costo Base)</span>
                       <span className="font-mono text-sm font-bold text-gray-800">{formatMXN(lgCosts)}</span>
                     </div>
                     <div className="flex justify-between items-center bg-emerald-50 p-2 px-3 rounded-lg border border-[#A7F3D0]">
                       <div className="flex items-center gap-2">
                         <span className="uppercase font-mono text-[10px] font-bold text-emerald-800 tracking-widest opacity-80">Margen Global</span>
                         <div className="flex items-center bg-white border border-[#34D399] rounded px-1">
                           <input type="number" min="0" step="1" value={globalMargin} onChange={e=>setGlobalMargin(Number(e.target.value))} className="w-12 text-center text-xs font-bold text-emerald-900 focus:outline-none" />
                           <span className="text-xs text-emerald-800 font-bold">%</span>
                         </div>
                       </div>
                       <span className="font-mono text-sm font-bold text-emerald-700">+{formatMXN(lgProfit)}</span>
                     </div>
                   </div>

                   <div className="flex justify-between items-end mb-4">
                     <span className="uppercase font-mono text-xs font-bold text-[#064e3b] opacity-50 tracking-widest">Precio de Venta</span>
                     <span className="text-3xl lg:text-5xl font-black text-[#064e3b] tracking-tighter">{formatMXN(lgTotals)}</span>
                   </div>
                   
                   <div className="flex gap-2">
                     <button onClick={handleSave} disabled={ticketItems.length === 0} className="flex-1 bg-[#064e3b] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#059669] transition-colors disabled:opacity-50">
                        <Save size={16}/> Guardar Ticket
                     </button>
                   </div>
                </div>
             </div>

          </div>
        )}
      </main>
      {/* Modal para Editar Perfiles */}
      {isEditingProfiles && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[999] flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border-t-4 border-[#059669] overflow-hidden flex flex-col max-h-full">
            <div className="p-4 bg-[#F0FDF4] border-b border-[#A7F3D0] flex justify-between items-center shrink-0">
               <h3 className="font-bold text-gray-900 uppercase tracking-wider text-sm flex items-center gap-2">
                 <Settings size={18} className="text-[#059669]"/> Editar Perfiles de Material
               </h3>
               <button onClick={() => setIsEditingProfiles(false)} className="text-gray-500 hover:text-red-500 p-1"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-widest opacity-60">Perfiles Registrados</span>
                <div className="flex flex-col gap-2">
                  {profiles.map(p => (
                    <div key={p.id} className={`flex flex-col gap-2 ${profileEditingId === p.id ? 'bg-[#ECFDF5] border-[#059669]' : 'bg-gray-50 border-gray-200'} border p-3 rounded-xl shadow-sm hover:border-[#A7F3D0] transition-colors`}>
                      {profileEditingId === p.id ? (
                        <div className="flex flex-col gap-3">
                           <input type="text" value={editProfileInput.name} onChange={e => setEditProfileInput({...editProfileInput, name: e.target.value})} placeholder="Nombre" className="bg-white border border-[#A7F3D0] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] font-bold text-gray-900" />
                           <div className="grid grid-cols-3 gap-2">
                             <div className="flex flex-col gap-1">
                               <label className="text-[9px] uppercase font-bold text-emerald-800">Material (g)</label>
                               <input type="number" step="0.01" value={editProfileInput.materialCost} onChange={e => setEditProfileInput({...editProfileInput, materialCost: e.target.value})} className="bg-white border border-[#A7F3D0] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                             </div>
                             <div className="flex flex-col gap-1">
                               <label className="text-[9px] uppercase font-bold text-emerald-800">Máquina (h)</label>
                               <input type="number" step="0.1" value={editProfileInput.machineHour} onChange={e => setEditProfileInput({...editProfileInput, machineHour: e.target.value})} className="bg-white border border-[#A7F3D0] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                             </div>
                             <div className="flex flex-col gap-1">
                               <label className="text-[9px] uppercase font-bold text-emerald-800">Margen (%)</label>
                               <input type="number" step="1" value={editProfileInput.defaultMargin} onChange={e => setEditProfileInput({...editProfileInput, defaultMargin: e.target.value})} className="bg-white border border-[#A7F3D0] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                             </div>
                           </div>
                           <div className="flex items-center gap-2 mt-1">
                              <button type="button" onClick={handleUpdateProfile} className="flex-1 bg-[#059669] text-white p-2 text-xs rounded-lg uppercase font-bold hover:bg-emerald-800 transition-colors flex justify-center items-center gap-2">
                                <Check size={14} /> Guardar
                              </button>
                              <button type="button" onClick={() => setProfileEditingId(null)} className="flex-1 bg-white border border-[#059669] text-emerald-800 p-2 text-xs rounded-lg uppercase font-bold hover:bg-[#F0FDF4] transition-colors flex justify-center items-center gap-2">
                                <X size={14} /> Cancelar
                              </button>
                           </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{p.name}</span>
                            <span className="text-[10px] font-mono font-normal opacity-70 mt-1">
                               ${p.spoolCost}/kg | ${p.machineHour}/h
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => startEditProfile(p)} className="text-emerald-600 bg-emerald-50 p-2 rounded opacity-80 hover:opacity-100 transition-opacity" title="Editar"><Settings size={16}/></button>
                            <button type="button" onClick={() => handleRemoveProfile(p.id)} className="text-red-500 bg-red-50 p-2 rounded opacity-80 hover:opacity-100 transition-opacity" title="Eliminar"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <hr className="my-2 border-gray-200" />
                
                <span className="text-xs font-bold text-gray-800 uppercase tracking-widest opacity-60">Crear Nuevo Perfil</span>
                <div className="flex flex-col gap-3 bg-[#F0FDF4] p-4 rounded-xl border border-[#A7F3D0]">
                   <input type="text" value={newProfileInput.name} onChange={e => setNewProfileInput({...newProfileInput, name: e.target.value})} placeholder="Nombre (Ej. ABS Industrial)" className="bg-white border border-[#A7F3D0] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] font-bold text-gray-900" />
                   <div className="grid grid-cols-3 gap-2">
                     <div className="flex flex-col gap-1">
                       <label className="text-[9px] uppercase font-bold text-emerald-800">Costo Material (g)</label>
                       <input type="number" step="0.01" value={newProfileInput.materialCost} onChange={e => setNewProfileInput({...newProfileInput, materialCost: e.target.value})} placeholder="$ / gramo" className="bg-white border border-[#A7F3D0] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                     </div>
                     <div className="flex flex-col gap-1">
                       <label className="text-[9px] uppercase font-bold text-emerald-800">Costo Máquina (h)</label>
                       <input type="number" step="0.1" value={newProfileInput.machineHour} onChange={e => setNewProfileInput({...newProfileInput, machineHour: e.target.value})} placeholder="$ / hr" className="bg-white border border-[#A7F3D0] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                     </div>
                     <div className="flex flex-col gap-1">
                       <label className="text-[9px] uppercase font-bold text-emerald-800">Margen Defecto (%)</label>
                       <input type="number" step="1" value={newProfileInput.defaultMargin} onChange={e => setNewProfileInput({...newProfileInput, defaultMargin: e.target.value})} placeholder="% Margen" className="bg-white border border-[#A7F3D0] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                     </div>
                   </div>
                   <button type="button" onClick={handleAddProfile} className="mt-2 bg-[#059669] text-white p-2 text-sm rounded-lg uppercase tracking-wider font-bold hover:bg-[#064E3B] flex items-center justify-center gap-2 cursor-pointer shadow">
                      <Plus size={16}/> Guardar Perfil
                   </button>
                </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return <MainApp />;
}
