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
  { id: 'pla', name: 'PLA Estándar', materialCost: 0.5, machineHour: 15, defaultMargin: 30 },
  { id: 'petg', name: 'PETG Industrial', materialCost: 0.8, machineHour: 20, defaultMargin: 40 },
  { id: 'abs', name: 'ABS / ASA', materialCost: 1.0, machineHour: 30, defaultMargin: 45 },
  { id: 'tpu', name: 'TPU Flexible', materialCost: 1.2, machineHour: 25, defaultMargin: 50 },
];

export const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

function MainApp({ user }: { user: any }) {
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
    if (saved) return JSON.parse(saved);
    return DEFAULT_PROFILES;
  });
  const [isEditingProfiles, setIsEditingProfiles] = useState(false);
  const [newProfileInput, setNewProfileInput] = useState({ name: '', materialCost: '', machineHour: '', defaultMargin: '' });

  const handleAddProfile = () => {
    if (!newProfileInput.name.trim() || !newProfileInput.materialCost || !newProfileInput.machineHour || !newProfileInput.defaultMargin) return;
    const p = {
      id: Math.random().toString(),
      name: newProfileInput.name.trim(),
      materialCost: Number(newProfileInput.materialCost),
      machineHour: Number(newProfileInput.machineHour),
      defaultMargin: Number(newProfileInput.defaultMargin),
    };
    const updated = [...profiles, p];
    setProfiles(updated);
    localStorage.setItem('cubeup3-custom-profiles', JSON.stringify(updated));
    setProfileId(p.id);
    setNewProfileInput({ name: '', materialCost: '', machineHour: '', defaultMargin: '' });
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
    if (saved) return JSON.parse(saved)[0].id;
    return DEFAULT_PROFILES[0].id;
  });
  const [weight, setWeight] = useState<number | ''>('');
  const [hours, setHours] = useState<number | ''>('');
  const [pieceMargin, setPieceMargin] = useState<number | ''>('');
  const [pieceLabor, setPieceLabor] = useState<number | ''>('');
  
  // Hardware form
  const [hwName, setHwName] = useState('');
  const [hwPrice, setHwPrice] = useState<number | ''>('');

  const { saveQuote, quotes } = useQuoteHistory();

  // Real-time autosave for drafts (debounced 1.5s)
  useEffect(() => {
    if (!savedQuoteId || ticketItems.length === 0) return;
    const currentQuote = quotes.find(q => q.id === savedQuoteId);
    if (currentQuote && currentQuote.status !== 'borrador') return;

    const timeoutMsg = setTimeout(() => {
       saveQuote(ticketItems, operatorName, clientName, currentQuote?.notes || '', savedQuoteId).catch(console.error);
    }, 1500);
    return () => clearTimeout(timeoutMsg);
  }, [ticketItems, operatorName, clientName, savedQuoteId, saveQuote, quotes]);

  const handleAddPiece = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || weight === '' || hours === '') return;
    const profile = profiles.find(p => p.id === profileId)!;
    
    const w = Number(weight);
    const h = Number(hours);
    const materialCost = w * profile.materialCost;
    const machineCost = h * profile.machineHour;
    const labor = Number(pieceLabor) || 0;
    const margin = pieceMargin !== '' ? Number(pieceMargin) : profile.defaultMargin;
    
    const base = materialCost + machineCost + labor;
    const withMargin = base * (1 + (margin / 100));

    setTicketItems([...ticketItems, {
      id: Math.random().toString(),
      itemName: itemName,
      quantity: 1,
      profileName: profile.name,
      weightInfo: w,
      timeInfo: h,
      unitPrice: withMargin,
      totalPrice: withMargin,
      itemType: 'print'
    }]);
    
    setItemName('');
    setWeight('');
    setHours('');
    setPieceMargin('');
    setPieceLabor('');
  };

  const handleAddHardware = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwName || hwPrice === '') return;
    const price = Number(hwPrice);
    setTicketItems([...ticketItems, {
      id: Math.random().toString(),
      itemName: hwName,
      quantity: 1,
      profileName: 'Hardware Adicional',
      weightInfo: 0,
      timeInfo: 0,
      unitPrice: price,
      totalPrice: price,
      itemType: 'hardware'
    }]);
    setHwName('');
    setHwPrice('');
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

  const lgTotals = ticketItems.reduce((acc, i) => acc + i.totalPrice, 0);

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
            <p className="text-xs font-bold text-gray-900">{user.displayName || 'Usuario'}</p>
            <p className="text-[10px] text-emerald-800">{user.email}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 text-emerald-800 hover:bg-[#D1FAE5] rounded-lg transition-colors border border-transparent hover:border-[#A7F3D0]">
            <LogOut size={16} />
          </button>
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
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold leading-tight" title="Tiempo Operativo Máquina (Horas)">T. Máquina (H)</label>
                      <input type="number" min="0" step="0.1" value={hours} onChange={e=>setHours(Number(e.target.value))} placeholder="Ej. 5.5" className="w-full bg-[#F0FDF4] border border-[#059669] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold leading-tight" title="Mano de obra o costos fijos para esta pieza">Mano de obra ($)</label>
                      <input type="number" min="0" step="1" value={pieceLabor} onChange={e=>setPieceLabor(Number(e.target.value))} placeholder="Ej. 50" className="w-full bg-[#F0FDF4] border border-[#059669] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-emerald-800 font-bold leading-tight" title={`Margen de ganancia, por defecto ${profiles.find(p=>p.id===profileId)?.defaultMargin}%`}>Margen (%)</label>
                      <input type="number" min="0" step="1" value={pieceMargin} onChange={e=>setPieceMargin(Number(e.target.value))} placeholder={`Perfil: ${profiles.find(p=>p.id===profileId)?.defaultMargin}%`} className="w-full bg-[#F0FDF4] border border-[#059669] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                    </div>
                  </div>

                  <button type="submit" disabled={!itemName || weight==='' || hours===''} className="mt-2 w-full bg-[#059669] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-md">
                    <Plus size={16}/> Añadir al Ticket
                  </button>
                </form>

                {/* Accesorios / Hardware */}
                <form onSubmit={handleAddHardware} className="bg-[#F0FDF4] p-5 rounded-2xl border border-[#A7F3D0] shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs uppercase font-bold text-gray-900 flex items-center gap-2 mb-1"><Cpu size={14}/> Insumos Extra (Hardware)</h3>
                  <p className="text-[10px] leading-tight text-emerald-800/70">Tornillería, insertos térmicos, rodamientos, o cualquier elemento no impreso.</p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <input type="text" value={hwName} onChange={e=>setHwName(e.target.value)} placeholder="Tornillos M3..." className="col-span-2 bg-white border border-[#A7F3D0] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                    <input type="number" min="0" step="1" value={hwPrice} onChange={e=>setHwPrice(Number(e.target.value))} placeholder="$ 0.00" className="bg-white border border-[#A7F3D0] rounded-lg p-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#059669]" />
                  </div>
                  
                  <button type="submit" disabled={!hwName || hwPrice===''} className="w-full bg-white border-2 border-[#059669] text-emerald-800 py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#D1FAE5] active:scale-[0.98] transition-all disabled:opacity-50">
                    <Plus size={16}/> Añadir Insumo
                  </button>
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

                              <div className="flex items-center gap-4 lg:gap-6">
                                 <div className="text-right flex flex-col">
                                   <span className="text-[9px] uppercase font-mono text-[#064e3b] opacity-50">Precio Final</span>
                                   <span className="font-black text-lg text-emerald-800">{formatMXN(item.totalPrice)}</span>
                                 </div>
                                 <button onClick={() => setTicketItems(ticketItems.filter((_, idx)=>idx!==i))} className="text-red-400 opacity-20 group-hover:opacity-100 p-2 hover:bg-red-50 rounded transition-all">
                                   <Trash2 size={16} />
                                 </button>
                              </div>
                           </div>
                         ))}
                      </div>
                   )}
                </div>

                <div className="shrink-0 p-4 lg:p-6 bg-white border-t border-[#A7F3D0]">
                   <div className="flex justify-between items-end mb-4">
                     <span className="uppercase font-mono text-xs font-bold text-[#064e3b] opacity-50 tracking-widest">Inversión Final</span>
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
                    <div key={p.id} className="flex justify-between items-center text-sm font-bold text-gray-700 bg-gray-50 border border-gray-200 p-3 rounded-xl shadow-sm hover:border-[#A7F3D0] transition-colors">
                      <div className="flex flex-col">
                        <span className="text-gray-900">{p.name}</span>
                        <span className="text-[10px] font-mono font-normal opacity-70 mt-1">
                           ${p.materialCost}/g | ${p.machineHour}/h | {p.defaultMargin}% mg
                        </span>
                      </div>
                      <button type="button" onClick={() => handleRemoveProfile(p.id)} className="text-red-500 bg-red-50 p-2 rounded opacity-80 hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
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
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    return auth.onAuthStateChanged((u) => setUser(u));
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F0FDF4] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border-t-4 border-[#059669]">
          <div className="flex justify-center mb-6">
            <div className="bg-[#ECFDF5] text-emerald-800 p-4 rounded-2xl"><Target size={48} /></div>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">CubeUp³</h1>
          <p className="text-sm text-emerald-800 mb-8 font-mono uppercase tracking-wider font-bold">SO de Manufactura</p>
          <button onClick={() => signInWithPopup(auth, provider)} className="w-full bg-[#059669] text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-[#064E3B] transform active:scale-95 transition-all text-sm tracking-wider flex justify-center items-center gap-3">
             <User size={18}/> Iniciar Sesión con Google
          </button>
        </div>
      </div>
    );
  }

  return <MainApp user={user} />;
}
