import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Plus, Save, Copy, Check, Printer, Scale, Clock, DollarSign, Trash2, X, Download, Minus, Receipt, FileText, ShoppingCart, User, Cpu, Sparkles, Microchip, Link, Magnet, ChevronDown, ChevronUp, BarChart } from 'lucide-react';

interface PrintProfile {
  id: string;
  name: string;
  materialCostPerKg: number;
  machineCostPerHour: number;
  failureRate: number;
  setupCost: number;
  defaultMargin: number;
}

interface TicketItem {
  id: string;
  itemName: string;
  quantity: number;
  profileName: string;
  weightInfo: number;
  timeInfo: number;
  unitPrice: number;
  totalPrice: number;
  itemType?: 'print' | 'hardware';
}

const formatMXN = (value: number, minDecimals = 2, maxDecimals = 2) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals
  }).format(value);
};

const getSmartInsights = (items: TicketItem[]) => {
  if (items.length === 0) return [];
  const insights: string[] = [];
  
  const printItems = items.filter(i => i.itemType !== 'hardware');
  const hwItems = items.filter(i => i.itemType === 'hardware');
  
  const totalPrintQty = printItems.reduce((acc, it) => acc + it.quantity, 0);
  const namesJoined = printItems.map(i => i.itemName.toLowerCase()).join(' ');
  const profilesJoined = printItems.map(i => i.profileName.toLowerCase()).join(' ');
  const hwNamesJoined = hwItems.map(i => i.itemName.toLowerCase()).join(' ');

  // 1. Análisis de Volumen FDM
  if (totalPrintQty === 1) {
    insights.push("🎯 **Prototipado / Pieza Única:** Se asignará una máquina en exclusividad para este componente, garantizando tolerancia estricta y atención individual.");
  } else if (totalPrintQty >= 2 && totalPrintQty <= 15) {
    insights.push("📦 **Corrida Corta (Bajo Volumen):** Implementaremos un Aseguramiento de Calidad (QA) iterativo para mantener homogeneidad geométrica y visual entre todas las piezas.");
  } else if (totalPrintQty > 15) {
    insights.push("🏭 **Producción Aditiva en Serie:** Fabricación por lotes detectada. Optimizaremos la topología de la placa para reducir tiempos de viaje (Travel) y agilizar la entrega.");
  }

  // 2. Análisis Semántico de Hardware Integrado
  if (/(nfc|rfid|chip|tag|etiqueta inteligente)/i.test(hwNamesJoined)) {
    insights.push("📡 **Integración IoT / Smart-Tag:** Se prepararán cavidades herméticas o pausas programadas (M600) en el G-Code para embeber los chips NFC/RFID de forma invisible y permanente dentro de la matriz del polímero.");
  }
  if (/(im[aá]n|neodimio|magnet)/i.test(hwNamesJoined)) {
    insights.push("🧲 **Fijación Magnética Encastrada:** Aplicaremos tolerancias micrométricas (offset negativo de -0.15mm) en los sockets de diseño para garantizar un ensamble de interferencia (press-fit) de los imanes o encapsulado en frío.");
  }
  if (/(argolla|llavero|cadena|gancho|mosquet[oó]n)/i.test(hwNamesJoined)) {
    insights.push("🔗 **Refuerzo para Portabilidad:** Se utilizará hardware de suspensión. Alteraremos la densidad de laminado para inflar el relleno (Infill 100%) sistemáticamente en torno a los ojillos y tolerar fricción y tracción diaria sin fracturas.");
  }
  if (/(inserto|rosca|tornillo|tuerca|heat.stake)/i.test(hwNamesJoined)) {
    insights.push("🔩 **Ensamblaje Mecánico Híbrido:** El uso de insertos termofijados exige topologías robustas. Incrementaremos variables como 'Wall loops' alrededor de los anclajes para disipar el estrés de delaminación térmica.");
  }

  // 3. Análisis Semántico del Modelo FDM (Intención)
  if (/(engranaje|soporte|bracket|mecanismo|repuesto|pieza|bisagra|brazo|motor)/i.test(namesJoined)) {
    insights.push("⚙️ **Aplicación Estructurada Mecánica:** Detectamos piezas operativas. Sugerimos un aumento perimetral con patrones Infill tridimensionales (Gyroid/Cubic) para maximizar la resistencia isotrópica a la fatiga.");
  }
  if (/(carcasa|caja|enclosure|case|cubierta|electr[oó]nica|pcb|sensor)/i.test(namesJoined)) {
    insights.push("🔌 **Integración / Ensamblaje Terminal:** Se aplicarán factores de compensación de contracción (0.2% - 0.6% según polímero) para preservar las tolerancias de acoplamiento originales de la caja electrónica.");
  }
  if (/(figura|arte|miniatura|decoraci[oó]n|llavero|juguete|busto|coleccion|d&d|maceta)/i.test(namesJoined)) {
    insights.push("🎨 **Acabado Superficial Estético:** Las geometrías abstractas contarán con secuencias de altura de capa adaptativa para mitigar drásticamente el defecto topográfico escalonado característico del FDM.");
  }

  // 4. Análisis de Material Base
  if (/(tpu|flexible|ninja)/i.test(profilesJoined)) {
    insights.push("🌀 **Dinámica de Elastómeros:** El poliuretano flexible elegido demanda velocidades de extrusión restringidas. La rigurosidad física de sus piezas ya ha sido justificada y compensada en la tarifa volumétrica.");
  }
  if (/(abs|asa|pc|carbon|nylon)/i.test(profilesJoined)) {
    insights.push("🔥 **Polímeros de Ingeniería y Alta Temp:** La orden exige hornos isotérmicos sellados para repeler gradientes ambientales y prevenir la deformación estructural (Warping) propia de termoplásticos industriales.");
  }

  // Fallback
  if (insights.length === 1 && totalPrintQty > 0) {
    insights.push("✅ **Viabilidad Computacional Avalada:** Los ejes matemáticos y mallas reportadas entran en los parámetros estándar del clúster de manufactura sin advertencias.");
  }

  return insights;
};

const SUGGESTED_TEMPLATES: Omit<PrintProfile, 'id'>[] = [
  { name: 'PLA Básico (Estándar)', materialCostPerKg: 350, machineCostPerHour: 5, failureRate: 5, setupCost: 15, defaultMargin: 40 },
  { name: 'PETG Mecánico (Resistente)', materialCostPerKg: 450, machineCostPerHour: 6, failureRate: 8, setupCost: 15, defaultMargin: 50 },
  { name: 'ABS/ASA (Alta Temp)', materialCostPerKg: 550, machineCostPerHour: 10, failureRate: 15, setupCost: 30, defaultMargin: 60 },
  { name: 'TPU Flexible (Lento)', materialCostPerKg: 650, machineCostPerHour: 8, failureRate: 20, setupCost: 20, defaultMargin: 65 },
  { name: 'Fibra de Carbono (PA-CF)', materialCostPerKg: 1800, machineCostPerHour: 15, failureRate: 10, setupCost: 50, defaultMargin: 80 },
];

const DEFAULT_PROFILES: PrintProfile[] = [
  { id: '1', ...SUGGESTED_TEMPLATES[0] },
  { id: '2', ...SUGGESTED_TEMPLATES[1] },
];

export default function App() {
  const [profiles, setProfiles] = useState<PrintProfile[]>(() => {
    const saved = localStorage.getItem('cubeup3-profiles-v2');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILES;
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profiles[0]?.id || '');
  
  const [inputs, setInputs] = useState({
    weight: 0,
    time: 0,
    laborCost: 0,
    margin: profiles[0]?.defaultMargin || 50,
  });
  const [itemName, setItemName] = useState('');

  // Hardware Extras
  const [hwName, setHwName] = useState('');
  const [hwPrice, setHwPrice] = useState<number | ''>('');

  const [ticketItems, setTicketItems] = useState<TicketItem[]>(() => {
    const saved = localStorage.getItem('cubeup3-ticket-v1');
    return saved ? JSON.parse(saved) : [];
  });
  const [operatorName, setOperatorName] = useState(() => {
    return localStorage.getItem('cubeup3-operator-v1') || '';
  });
  const [currentTab, setCurrentTab] = useState<'calculator' | 'ticket'>('calculator');

  const [isManagingProfiles, setIsManagingProfiles] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PrintProfile | null>(null);
  const [showAdvancedProfile, setShowAdvancedProfile] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    localStorage.setItem('cubeup3-profiles-v2', JSON.stringify(profiles));
    if (!profiles.find(p => p.id === selectedProfileId) && profiles.length > 0) {
      setSelectedProfileId(profiles[0].id);
      setInputs(prev => ({ ...prev, margin: profiles[0].defaultMargin }));
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    localStorage.setItem('cubeup3-ticket-v1', JSON.stringify(ticketItems));
  }, [ticketItems]);

  useEffect(() => {
    localStorage.setItem('cubeup3-operator-v1', operatorName);
  }, [operatorName]);

  const activeProfile = profiles.find(p => p.id === selectedProfileId);
  const smartInsights = useMemo(() => getSmartInsights(ticketItems), [ticketItems]);

  const handleProfileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedProfileId(newId);
    const prof = profiles.find(p => p.id === newId);
    if (prof) setInputs(prev => ({ ...prev, margin: prof.defaultMargin }));
  };

  const calc = useMemo(() => {
    if (!activeProfile) return null;
    
    const safeWeight = inputs.weight || 0;
    const safeTime = inputs.time || 0;
    const safeLabor = inputs.laborCost || 0;
    const safeMargin = inputs.margin || 0;
    
    const safeMatCostKg = activeProfile.materialCostPerKg || 0;
    const safeMachCostHr = activeProfile.machineCostPerHour || 0;
    const safeSetupCost = activeProfile.setupCost || 0;
    const safeFailRate = activeProfile.failureRate || 0;

    const materialCost = (safeWeight / 1000) * safeMatCostKg;
    const machineCost = safeTime * safeMachCostHr;
    const baseSubtotal = materialCost + machineCost + safeLabor + safeSetupCost;
    
    const failureAbsCost = baseSubtotal * (safeFailRate / 100);
    const costWithFailure = baseSubtotal + failureAbsCost;
    
    const profitMarginAbs = costWithFailure * (safeMargin / 100);
    const finalPrice = costWithFailure + profitMarginAbs;

    return {
      materialCost,
      machineCost,
      setupCost: safeSetupCost,
      baseSubtotal,
      failureAbsCost,
      costWithFailure,
      profitMarginAbs,
      finalPrice
    };
  }, [inputs, activeProfile]);

  const confirmCopy = (key: string) => {
    setCopiedStates(s => ({ ...s, [key]: true }));
    setTimeout(() => setCopiedStates(s => ({ ...s, [key]: false })), 2000);
  };

  const handleCopyInternal = () => {
    if (!calc || !activeProfile) return;
    const quoteText = `PRESUPUESTO INTERNO - CUBEUP³
----------------------------------------
Perfil: ${activeProfile.name}
Parámetros: ${inputs.weight}g | ${inputs.time} hr
Material: ${formatMXN(calc.materialCost)}
Máquina: ${formatMXN(calc.machineCost)}
Prep Cama: ${formatMXN(calc.setupCost)}
Labor/Post: ${formatMXN(inputs.laborCost)}
Contingencia (${activeProfile.failureRate}%): ${formatMXN(calc.failureAbsCost)}
Margen (${inputs.margin}%): +${formatMXN(calc.profitMarginAbs)}
----------------------------------------
TOTAL INTERNO: ${formatMXN(calc.finalPrice)} MXN`;
    
    navigator.clipboard.writeText(quoteText).then(() => confirmCopy('internal'));
  };

  const handleCopyClientTicket = () => {
    if (ticketItems.length === 0) return;
    const grandTotal = ticketItems.reduce((acc, it) => acc + it.totalPrice, 0);
    
    const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const opName = operatorName.trim() || 'Departamento de Cotizaciones';

    let md = `# 📄 Cotización Oficial de Manufactura Aditiva - CUBEUP³\n\n`;
    md += `**Fecha de Emisión:** ${dateStr}\n`;
    md += `**Asesor / Responsable:** ${opName}\n\n`;
    md += `---\n\n`;
    md += `### 📋 Detalles de la Orden\n\n`;
    
    md += `| Cant. | Concepto / Partida | Especificación (Mat/Hrs) | P. Unitario | Subtotal |\n`;
    md += `| :---: | :--- | :--- | :--- | :--- |\n`;
    
    ticketItems.forEach(item => {
       const badgeType = item.itemType === 'hardware' ? '⚙️ Hardware Extra' : `${item.profileName}`;
       const specsParams = item.itemType === 'hardware' ? '' : ` (${item.weightInfo}g / ${item.timeInfo}h)`;
       md += `| **${item.quantity}x** | **${item.itemName.toUpperCase()}** | ${badgeType}${specsParams} | ${formatMXN(item.unitPrice)} | **${formatMXN(item.totalPrice)}** |\n`;
    });
    
    md += `\n---\n\n`;
    md += `## 💰 Inversión Total Facturable: **${formatMXN(grandTotal)} MXN**\n\n`;
    
    if (smartInsights.length > 0) {
       md += `### 🧠 Evaluación Predictiva y Aseguramiento de Calidad (QA)\n`;
       md += `*Nuestros algoritmos y expertos humanos analizaron la escala técnica de su orden:*\n\n`;
       smartInsights.forEach(insight => {
         md += `> ${insight}\n\n`;
       });
       md += `---\n\n`;
    }

    md += `> 💡 **Nota de Transparencia:** Los valores contemplan el uso de hardware industrial, la masa total de polímeros, el post-procesado manual y mermas por calibración. Esta cotización asume riesgos productivos para garantizar la entrega íntegra del orden tasado.\n\n`;
    md += `*Reporte emitido por Software de Estandarización Aditiva CubeUp³ v4.8.*`;

    navigator.clipboard.writeText(md).then(() => confirmCopy('client'));
  };

  const handleAddToTicket = () => {
    if (!calc || !activeProfile || calc.finalPrice <= 0) return;
    
    const finalItemName = itemName.trim() || `Geometría ${activeProfile.name}`;
    const newItem: TicketItem = {
      id: Date.now().toString(),
      itemName: finalItemName,
      quantity: 1,
      profileName: activeProfile.name,
      weightInfo: inputs.weight,
      timeInfo: inputs.time,
      unitPrice: calc.finalPrice,
      totalPrice: calc.finalPrice,
      itemType: 'print'
    };

    setTicketItems([...ticketItems, newItem]);
    setItemName('');
    setCurrentTab('ticket');
  };

  const handleAddHardwareTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwName.trim() || !hwPrice || hwPrice <= 0) return;

    const newItem: TicketItem = {
      id: Date.now().toString(),
      itemName: hwName.trim(),
      quantity: 1,
      profileName: 'Hardware Adicional',
      weightInfo: 0,
      timeInfo: 0,
      unitPrice: Number(hwPrice),
      totalPrice: Number(hwPrice),
      itemType: 'hardware'
    };

    setTicketItems([...ticketItems, newItem]);
    setHwName('');
    setHwPrice('');
  };

  const updateTicketQuantity = (id: string, delta: number) => {
    setTicketItems(items => items.map(item => {
      if (item.id === id) {
        const newQ = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQ, totalPrice: newQ * item.unitPrice };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };


  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    if (profiles.find(p => p.id === editingProfile.id)) {
      setProfiles(profiles.map(p => p.id === editingProfile.id ? editingProfile : p));
    } else {
      setProfiles([...profiles, { ...editingProfile, id: Date.now().toString() }]);
    }
    setEditingProfile(null);
  };

  return (
    <div className="h-screen bg-[#0A0A0A] text-white font-sans p-4 lg:p-8 flex flex-col gap-6 overflow-hidden">
      <header className="flex justify-between items-baseline border-b-4 border-white pb-4 shrink-0 transition-opacity duration-300">
        <div className="flex items-baseline gap-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white hover:text-[#FF4D00] transition-colors cursor-default">CUBEUP³</h1>
          <span className="text-xs font-mono uppercase opacity-50 hidden md:inline">Arquitectura de Manufactura Aditiva v4.8.2</span>
        </div>
        <div className="flex gap-4 md:gap-6 font-mono text-xs uppercase items-end md:items-center">
          <div className="hidden md:flex flex-col items-end group cursor-default">
            <span className="opacity-40 group-hover:opacity-100 transition-opacity">Sistema Analítico</span>
            <span className="text-green-500 group-hover:text-green-400 font-bold transition-colors">Activo</span>
          </div>
          <button 
            onClick={() => setIsManagingProfiles(!isManagingProfiles)}
            className="px-4 py-2 border-2 border-[#333] hover:border-white hover:bg-white hover:text-black font-bold uppercase transition-all transform active:scale-95 cursor-pointer"
          >
            {isManagingProfiles ? 'Volver al Workbench' : 'Gestor de Perfiles'}
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 flex-grow overflow-y-auto lg:overflow-hidden pb-10 lg:pb-0 scrollbar-hide">
        {isManagingProfiles ? (
          <section className="col-span-1 lg:col-span-12 flex flex-col gap-6 overflow-y-auto animate-in slide-in-from-bottom-5 duration-500 fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
              <div className="flex flex-col gap-8 h-full min-h-[500px]">
                <div className="border-2 border-[#333] bg-[#111] p-6 lg:p-8 flex flex-col gap-4 max-h-[50%] overflow-y-auto shadow-xl">
                  <h2 className="text-xs uppercase tracking-widest font-mono border-b border-white/20 pb-2 text-[#FF4D00]">Perfiles Operativos Locales</h2>
                  <div className="space-y-4 flex-grow overflow-y-auto pr-2">
                    {profiles.map(profile => (
                      <div key={profile.id} className="border-2 border-[#333] p-4 bg-black flex justify-between items-center hover:border-white transition-all group">
                        <div className="flex flex-col cursor-default">
                          <span className="font-bold text-lg group-hover:text-[#FF4D00] transition-colors">{profile.name}</span>
                          <span className="text-[10px] font-mono opacity-50 uppercase mt-1">Mat: {formatMXN(profile.materialCostPerKg || 0)}/kg | Máq: {formatMXN(profile.machineCostPerHour || 0)}/h</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setProfiles([...profiles, { ...profile, id: Date.now().toString(), name: `${profile.name} (Copia)` }])} className="p-2 border border-[#333] hover:text-white transition-colors cursor-pointer"><Copy size={14} /></button>
                          <button onClick={() => setEditingProfile(profile)} className="p-2 border border-[#333] hover:text-[#FF4D00] border-[#FF4D00] transition-colors cursor-pointer"><Settings size={14} /></button>
                          <button onClick={() => setProfiles(profiles.filter(p => p.id !== profile.id))} className="p-2 border border-[#333] hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setEditingProfile({ id: '', name: 'Nuevo Perfil', materialCostPerKg: 0, machineCostPerHour: 0, failureRate: 0, setupCost: 0, defaultMargin: 50 })} className="w-full p-4 border-2 border-dashed border-[#333] hover:border-white transition-colors font-mono uppercase text-xs flex justify-center items-center gap-2 cursor-pointer mt-2 shrink-0">
                    <Plus size={16}/> Añadir Perfil en Blanco
                  </button>
                </div>
                <div className="border-2 border-[#333] bg-[#111]/50 p-6 lg:p-8 flex flex-col gap-4 flex-grow overflow-y-auto">
                  <h2 className="text-xs uppercase tracking-widest font-mono border-b border-white/20 pb-2 opacity-70">Plantillas Sugeridas</h2>
                  <div className="space-y-3 overflow-y-auto pr-2">
                    {SUGGESTED_TEMPLATES.map((tpl, i) => (
                      <div key={i} className="border border-[#222] p-3 bg-black/40 flex justify-between items-center hover:border-[#FF4D00]/50 transition-all">
                        <div className="flex flex-col"><span className="font-bold text-sm opacity-90">{tpl.name}</span><span className="text-[9px] font-mono opacity-40 uppercase">Preconfiguración Básica</span></div>
                        <button onClick={() => setProfiles([...profiles, { ...tpl, id: Date.now().toString() }])} className="px-3 py-2 border border-[#333] hover:bg-[#FF4D00] hover:text-white transition-colors text-[10px] font-mono uppercase flex items-center gap-2 cursor-pointer shrink-0"><Download size={12} /> Instalar</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-full">
                {editingProfile ? (
                  <div className="border-2 border-[#FF4D00] bg-[#0A0A0A] p-6 lg:p-8 flex flex-col gap-6 shadow-[0_0_50px_rgba(255,77,0,0.1)] relative overflow-y-auto h-full animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center border-b border-[#FF4D00]/30 pb-4 shrink-0">
                      <h2 className="text-sm uppercase tracking-widest font-black font-mono text-[#FF4D00] flex items-center gap-2"><Settings size={18} />{editingProfile.id ? 'Ajustes de Perfil' : 'Diseño de Perfil'}</h2>
                      <button onClick={() => setEditingProfile(null)} className="opacity-50 hover:opacity-100 hover:rotate-90 transition-all cursor-pointer"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSaveProfile} className="space-y-4 flex-grow flex flex-col overflow-y-auto pr-2 pb-2">
                      <div className="border-2 border-[#333] p-4 flex flex-col focus-within:border-[#FF4D00] bg-[#111] shrink-0"><label className="text-[10px] uppercase font-mono opacity-60">Identificador Táctico</label><input type="text" required value={editingProfile.name} onChange={e => setEditingProfile({...editingProfile, name: e.target.value})} className="bg-transparent text-2xl md:text-3xl font-black w-full outline-none focus:text-[#FF4D00] mt-2"/></div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                        <div className="border-2 border-[#333] p-4 flex flex-col focus-within:border-[#FF4D00] bg-[#111]"><label className="text-[10px] uppercase font-mono opacity-60">Materia Prima (MXN/Kg)</label><input type="number" step="0.01" required value={editingProfile.materialCostPerKg ?? ''} onChange={e => setEditingProfile({...editingProfile, materialCostPerKg: parseFloat(e.target.value) || 0})} className="bg-transparent text-2xl font-black w-full outline-none mt-2"/></div>
                        <div className="border-2 border-[#333] p-4 flex flex-col focus-within:border-[#FF4D00] bg-[#111]"><label className="text-[10px] uppercase font-mono opacity-60">Uso de Máquina (MXN/Hr)</label><input type="number" step="0.01" required value={editingProfile.machineCostPerHour ?? ''} onChange={e => setEditingProfile({...editingProfile, machineCostPerHour: parseFloat(e.target.value) || 0})} className="bg-transparent text-2xl font-black w-full outline-none mt-2"/></div>
                      </div>

                      <div className="border-t border-dashed border-[#333] pt-4 mt-2">
                        <button type="button" onClick={() => setShowAdvancedProfile(!showAdvancedProfile)} className="flex justify-between items-center w-full text-[10px] uppercase font-mono opacity-70 hover:opacity-100 hover:text-[#FF4D00] transition-colors cursor-pointer">
                          <span>Parámetros Avanzados & Costos Ocultos</span>
                          {showAdvancedProfile ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        </button>
                      </div>

                      {showAdvancedProfile && (
                        <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 fade-in">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                            <div className="border-2 border-[#222] p-4 flex flex-col focus-within:border-[#FF4D00] bg-black"><label className="text-[10px] uppercase font-mono opacity-60">Setup Cama / Preparación (MXN Fijo)</label><input type="number" step="0.01" required value={editingProfile.setupCost ?? ''} onChange={e => setEditingProfile({...editingProfile, setupCost: parseFloat(e.target.value) || 0})} className="bg-transparent text-xl font-bold w-full outline-none mt-2"/></div>
                            <div className="border-2 border-[#222] p-4 flex flex-col focus-within:border-[#FF4D00] bg-black"><label className="text-[10px] uppercase font-mono opacity-60">Tasa de Contingencia Estática (%)</label><input type="number" required value={editingProfile.failureRate ?? ''} onChange={e => setEditingProfile({...editingProfile, failureRate: parseFloat(e.target.value) || 0})} className="bg-transparent text-xl font-bold w-full outline-none mt-2"/></div>
                          </div>
                          <div className="border-2 border-[#FF4D00]/30 p-4 flex flex-col focus-within:border-[#FF4D00] bg-[#FF4D00]/5 shrink-0"><label className="text-[10px] uppercase font-mono opacity-80 text-[#FF4D00]">Margen de Rentabilidad Sugerido (%)</label><input type="number" required value={editingProfile.defaultMargin ?? ''} onChange={e => setEditingProfile({...editingProfile, defaultMargin: parseFloat(e.target.value) || 0})} className="bg-transparent text-2xl font-black w-full outline-none focus:text-white text-[#FF4D00] mt-2"/></div>
                        </div>
                      )}

                      <div className="mt-8 pt-4 border-t border-[#333] shrink-0"><button type="submit" className="w-full bg-[#FF4D00] text-white font-black px-8 py-5 uppercase text-sm border-2 border-[#FF4D00] hover:bg-white hover:text-black transition-all transform active:scale-95 flex justify-center items-center gap-3 cursor-pointer"><Check size={20}/> Guardar Estructura</button></div>
                    </form>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-[#333] h-full flex flex-col items-center justify-center opacity-30 font-mono text-[10px] uppercase text-center p-8 gap-4 min-h-[400px]"><Settings size={48} className="opacity-50" />Selecciona un perfil local para editar</div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Calculadora (Solo Piezas 3D) */}
            <section className="col-span-1 lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 animate-in slide-in-from-left-4 duration-500 fade-in">
              <div className="flex flex-col gap-2 group">
                <label className="text-[10px] uppercase tracking-[0.2em] font-mono opacity-60 group-hover:text-[#FF4D00]">Paso 1: Perfil de Material</label>
                <select className="w-full bg-[#111] border-2 border-[#333] p-4 text-xl md:text-2xl font-bold appearance-none cursor-pointer focus:border-white shadow-md outline-none" value={selectedProfileId} onChange={handleProfileSelect}>
                  {profiles.length > 0 ? profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="" disabled>Selecciona en Gestor</option>}
                </select>
                {activeProfile && (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-[10px] font-mono opacity-40 uppercase">
                    <span>Mat: {formatMXN(activeProfile.materialCostPerKg)}/k</span>
                    <span>Máq: {formatMXN(activeProfile.machineCostPerHour)}/h</span>
                    <span>Setup: {formatMXN(activeProfile.setupCost)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 flex-grow shrink-0">
                <div className="border-2 border-[#333] p-4 flex flex-col focus-within:border-[#FF4D00] bg-[#111]"><label className="text-[10px] uppercase font-mono opacity-60">Masa (g)</label><input type="number" value={inputs.weight || ''} onChange={e => setInputs({...inputs, weight: parseFloat(e.target.value)||0})} className="bg-transparent text-3xl font-black w-full outline-none focus:text-[#FF4D00] mt-2 placeholder:opacity-20" placeholder="0"/></div>
                <div className="border-2 border-[#333] p-4 flex flex-col focus-within:border-[#FF4D00] bg-[#111]"><label className="text-[10px] uppercase font-mono opacity-60">Tiempo (h)</label><input type="number" step="0.1" value={inputs.time || ''} onChange={e => setInputs({...inputs, time: parseFloat(e.target.value)||0})} className="bg-transparent text-3xl font-black w-full outline-none focus:text-[#FF4D00] mt-2 placeholder:opacity-20" placeholder="0.0"/></div>
                <div className="border-2 border-[#333] p-4 flex flex-col focus-within:border-[#FF4D00] bg-[#111]"><label className="text-[10px] uppercase font-mono opacity-60">Post-Proc (MXN)</label><input type="number" step="0.1" value={inputs.laborCost || ''} onChange={e => setInputs({...inputs, laborCost: parseFloat(e.target.value)||0})} className="bg-transparent text-3xl font-black w-full outline-none focus:text-[#FF4D00] mt-2 placeholder:opacity-20" placeholder="0.00"/></div>
                <div className="border-2 border-[#333] p-4 flex flex-col focus-within:border-white bg-[#FF4D00]/5"><label className="text-[10px] uppercase font-mono opacity-60 text-[#FF4D00]">Margen (%)</label><input type="number" value={inputs.margin || ''} onChange={e => setInputs({...inputs, margin: parseFloat(e.target.value)||0})} className="bg-transparent text-3xl font-black w-full outline-none text-[#FF4D00] mt-2 placeholder:opacity-20" placeholder="0"/></div>
              </div>

              {/* BARRA DE PROPORCIONES VISUALES */}
              {calc && calc.finalPrice > 0 && (
                <div className="flex flex-col gap-2 mt-4 shrink-0 animate-in fade-in">
                  <div className="flex justify-between text-[10px] uppercase font-mono opacity-80 mb-1">
                    <span className="flex items-center gap-1"><BarChart size={12}/> Anatomía de Precios</span>
                    <span className="text-[#FF4D00] font-bold">+{inputs.margin}%</span>
                  </div>
                  <div className="h-6 w-full bg-[#111] border-2 border-[#333] flex relative overflow-hidden">
                    <div style={{width: `${(calc.materialCost / calc.finalPrice) * 100}%`}} className="bg-blue-600 border-r border-[#111] transition-all duration-500" title={`Material: ${formatMXN(calc.materialCost)}`}></div>
                    <div style={{width: `${(calc.machineCost / calc.finalPrice) * 100}%`}} className="bg-purple-600 border-r border-[#111] transition-all duration-500" title={`Máquina: ${formatMXN(calc.machineCost)}`}></div>
                    <div style={{width: `${((calc.setupCost + inputs.laborCost) / calc.finalPrice) * 100}%`}} className="bg-gray-500 border-r border-[#111] transition-all duration-500" title={`Operación Fija: ${formatMXN(calc.setupCost + inputs.laborCost)}`}></div>
                    <div style={{width: `${(calc.failureAbsCost / calc.finalPrice) * 100}%`}} className="bg-red-600 border-r border-[#111] transition-all duration-500" title={`Riesgo Estático: ${formatMXN(calc.failureAbsCost)}`}></div>
                    <div style={{width: `${(calc.profitMarginAbs / calc.finalPrice) * 100}%`}} className="bg-[#FF4D00] opacity-80 transition-all duration-500 relative" title={`Margen Brillante: ${formatMXN(calc.profitMarginAbs)}`}>
                       <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.3)_4px,rgba(0,0,0,0.3)_8px)]"></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-start text-[8px] sm:text-[9px] uppercase font-mono opacity-50 mt-1">
                    <div className="flex gap-2 sm:gap-3 flex-wrap">
                       <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-600 inline-block"></span> Mat</span>
                       <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-600 inline-block"></span> Máq</span>
                       <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-500 inline-block"></span> Obr</span>
                       <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-600 inline-block"></span> Riesgo</span>
                    </div>
                    <span className="text-[#FF4D00] font-bold text-right shrink-0 max-w-[40%] leading-tight">Ganancia Neta<br/>{formatMXN(calc.profitMarginAbs)}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4 mt-2 shrink-0 border-t border-[#333] pt-6">
                 <div className="border-2 border-[#333] p-4 flex flex-col focus-within:border-[#FF4D00] bg-[#111]">
                   <label className="text-[10px] uppercase font-mono opacity-80 flex items-center gap-2 mb-2"><Cpu size={14} className="text-[#FF4D00]"/> Diagnóstico (Nombre Pieza)</label>
                   <input type="text" value={itemName} onChange={e=>setItemName(e.target.value)} placeholder="Ej. Engranaje Mecánico V2" className="bg-transparent text-lg font-bold w-full outline-none placeholder:opacity-30 focus:text-white" />
                 </div>
                 <button onClick={handleAddToTicket} className="bg-white text-black font-black uppercase text-xs tracking-widest border-2 border-white hover:bg-[#FF4D00] hover:text-white hover:border-[#FF4D00] transition-colors p-4 flex items-center justify-center gap-2 transform active:scale-95 cursor-pointer shadow-xl hover:shadow-[#FF4D00]/50">
                    <Plus size={18} /> Añadir Pieza a Ticket
                 </button>
              </div>
            </section>

            {/* Vista Central de Pestañas */}
            <section className="col-span-1 lg:col-span-8 border-2 border-[#333] bg-[#111] flex flex-col relative overflow-hidden animate-in slide-in-from-right-4 duration-500 fade-in shadow-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-[0.02] font-black text-8xl lg:text-9xl select-none leading-none pointer-events-none">Q</div>
              
              <div className="flex border-b border-[#333] bg-black shrink-0 relative z-10 w-full overflow-x-auto scrollbar-hide">
                 <button onClick={() => setCurrentTab('calculator')} className={`px-6 py-4 font-mono text-xs uppercase tracking-widest border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${currentTab === 'calculator' ? 'border-[#FF4D00] text-[#FF4D00] bg-[#111]' : 'border-transparent opacity-50 hover:opacity-100 hover:bg-[#222]'}`}>
                    <Scale size={16} /> Evaluación Aditiva
                 </button>
                 <button onClick={() => setCurrentTab('ticket')} className={`px-6 py-4 font-mono text-xs uppercase tracking-widest border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${currentTab === 'ticket' ? 'border-white text-white bg-[#111]' : 'border-transparent opacity-50 hover:opacity-100 hover:bg-[#222]'}`}>
                    <FileText size={16} /> Order & Exportación
                    {ticketItems.length > 0 && <span className="bg-[#FF4D00] text-white px-2 py-0.5 rounded-full text-[10px] ml-1">{ticketItems.length}</span>}
                 </button>
              </div>

              <div className="p-6 lg:p-8 flex flex-col h-full overflow-y-auto relative z-10">
                {currentTab === 'calculator' && (
                  calc ? (
                    <div className="flex-grow font-mono space-y-4 text-sm leading-relaxed flex flex-col animate-in fade-in duration-300 h-full">
                      <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                        <span className="opacity-80">Consumo de Material ({inputs.weight}g)</span>
                        <span className="font-bold">{formatMXN(calc.materialCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                        <span className="opacity-80">Costo Operación Máquina ({inputs.time}h)</span>
                        <span className="font-bold">{formatMXN(calc.machineCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                        <span className="opacity-80">Costo Base de Preparación</span>
                        <span className="font-bold">{formatMXN(calc.setupCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                        <span className="opacity-80">Labor de Post-Procesado</span>
                        <span className="font-bold">{formatMXN(inputs.laborCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[#FF4D00]/80 italic text-xs lg:text-sm hover:translate-x-1 transition-transform">
                        <span>Prima Contingencia Riesgo ({activeProfile!.failureRate}%)</span>
                        <span>+{formatMXN(calc.failureAbsCost)}</span>
                      </div>
                      <div className="pt-4 border-t border-dashed border-white/20 flex justify-between items-center mt-2">
                        <span className="opacity-80 uppercase tracking-widest text-[10px]">Subtotal Acumulado</span>
                        <span className="font-bold">{formatMXN(calc.costWithFailure)}</span>
                      </div>
                      <div className="flex justify-between items-center hover:scale-[1.01] origin-left transition-transform bg-[#FF4D00]/5 p-2 -mx-2 rounded">
                        <span className="opacity-80 uppercase tracking-widest text-[10px]">Margen de Ganancia Dictaminado ({inputs.margin}%)</span>
                        <span className="font-bold text-[#FF4D00]">+{formatMXN(calc.profitMarginAbs)}</span>
                      </div>
                      
                      <div className="pt-8 mt-auto border-t border-[#333]">
                        <div className="flex flex-col mb-6">
                          <span className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Precio Ofertado por Pieza (MXN)</span>
                          <span className="text-6xl lg:text-7xl font-black tracking-tighter text-[#FF4D00] drop-shadow-lg">{formatMXN(calc.finalPrice)}</span>
                        </div>
                        <button onClick={handleCopyInternal} className={`w-full font-black px-6 py-4 uppercase text-xs tracking-widest border border-[#333] transition-colors flex justify-center items-center gap-2 cursor-pointer ${copiedStates['internal'] ? 'bg-green-600 border-green-600 text-white' : 'hover:bg-[#222] hover:text-white'}`}>
                          {copiedStates['internal'] ? <><Check size={16}/> Copiado al portapapeles</> : <><Copy size={16}/> Copiar Desglose Analítico Interno</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-grow flex items-center justify-center opacity-30 text-xs font-mono uppercase text-center h-full">Esperando Configuración o Input de Masa</div>
                  )
                )}

                {currentTab === 'ticket' && (
                  <div className="flex flex-col h-full animate-in fade-in duration-300">
                    
                    <div className="flex items-center gap-4 border-b border-[#333] pb-4 mb-4 shrink-0 focus-within:border-[#FF4D00] transition-colors">
                      <User className="text-[#FF4D00] opacity-80" size={20} />
                      <div className="flex flex-col w-full">
                         <label className="text-[10px] uppercase font-mono opacity-60">Asesor / Responsable de Proyecto</label>
                         <input 
                           type="text" 
                           value={operatorName} 
                           onChange={e => setOperatorName(e.target.value)} 
                           placeholder="Ej. Ing. Carlos Pérez" 
                           className="bg-transparent font-bold text-lg w-full outline-none placeholder:opacity-30 text-white mt-1"
                         />
                      </div>
                    </div>

                    {/* Generador de Hardware / Material Extra */}
                    <form onSubmit={handleAddHardwareTicket} className="border-2 border-[#222] bg-[#0A0A0A] p-4 mb-6 shrink-0 flex flex-col md:flex-row gap-4 items-end">
                      <div className="w-full">
                        <div className="flex gap-2 mb-2 items-center">
                          <span className="text-[10px] uppercase font-mono opacity-60 bg-[#FF4D00]/10 text-[#FF4D00] px-2 py-0.5 rounded flex items-center gap-1"><Cpu size={10}/> Integración Hardware</span>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                          <input type="text" value={hwName} onChange={e=>setHwName(e.target.value)} placeholder="Ej. Etiqueta NFC, Imán, Tuerca..." className="bg-[#111] border border-[#333] px-4 py-3 font-bold text-sm outline-none focus:border-white w-full rounded-none" />
                          <input type="number" step="0.1" value={hwPrice} onChange={e=>setHwPrice(e.target.value ? Number(e.target.value) : '')} placeholder="Precio c/u (MXN)" className="bg-[#111] border border-[#333] px-4 py-3 font-bold text-sm outline-none focus:border-[#FF4D00] w-full md:w-32 rounded-none" />
                        </div>
                      </div>
                      <button type="submit" className="border border-[#333] text-white hover:bg-[#FF4D00] hover:border-[#FF4D00] hover:text-white px-6 py-3 font-bold text-xs uppercase transition-colors shrink-0 whitespace-nowrap flex items-center gap-2 cursor-pointer h-[46px]">
                        <Plus size={16}/> Integrar
                      </button>
                    </form>
                    
                    {/* Botones de sugerencias rápidas */}
                    <div className="flex gap-2 flex-wrap mb-4 shrink-0">
                      <button onClick={() => {setHwName('Etiquetas IoT NFC NTAG215'); setHwPrice(15)}} className="px-3 py-1.5 text-[10px] font-mono border border-[#333] bg-black hover:border-white transition-colors flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer"><Microchip size={12}/> ⚡ NFC Smart-Tag</button>
                      <button onClick={() => {setHwName('Imanes Neodimio N52 (5x2mm)'); setHwPrice(5)}} className="px-3 py-1.5 text-[10px] font-mono border border-[#333] bg-black hover:border-white transition-colors flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer"><Magnet size={12}/> 🧲 Imanes</button>
                      <button onClick={() => {setHwName('Argollas/Accesorios Llavero'); setHwPrice(3.50)}} className="px-3 py-1.5 text-[10px] font-mono border border-[#333] bg-black hover:border-white transition-colors flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer"><Link size={12}/> 🔗 Argollas</button>
                      <button onClick={() => {setHwName('Insertos Roscados de Latón M3'); setHwPrice(2)}} className="px-3 py-1.5 text-[10px] font-mono border border-[#333] bg-black hover:border-white transition-colors flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer"><Settings size={12}/> 🔩 Insertos Roscados</button>
                    </div>

                    {ticketItems.length === 0 ? (
                      <div className="flex-grow flex flex-col items-center justify-center opacity-30 text-xs font-mono uppercase text-center border-2 border-dashed border-[#333] p-8 gap-4 mt-4">
                        <ShoppingCart size={48} className="opacity-50" />
                        Aún no compilas ninguna orden. Añade elementos.
                      </div>
                    ) : (
                      <>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-4 mb-4 mt-2">
                          {ticketItems.map(item => (
                            <div key={item.id} className="border-2 border-[#333] p-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 hover:border-white transition-colors bg-black group" style={{animation: 'fade-in 0.3s ease-out'}}>
                              <div className="flex flex-col flex-grow">
                                <span className="font-bold text-lg text-white">{item.itemName}</span>
                                <span className="text-[10px] font-mono opacity-50 uppercase mt-1">
                                  {item.itemType === 'hardware' ? `⚙️ ${item.profileName}` : `Mat: ${item.profileName} | Carga: ${item.weightInfo}g / ${item.timeInfo}h`}
                                </span>
                                <span className="text-xs font-mono text-[#FF4D00] mt-1 opacity-80">{formatMXN(item.unitPrice)} p/u</span>
                              </div>
                              <div className="flex items-center gap-6 shrink-0 w-full xl:w-auto justify-between xl:justify-end border-t border-[#333] xl:border-0 pt-4 xl:pt-0 mt-2 xl:mt-0">
                                <div className="flex items-center border border-[#333] bg-[#0A0A0A]">
                                  <button onClick={() => updateTicketQuantity(item.id, -1)} className="p-3 hover:bg-[#333] hover:text-[#FF4D00] transition-colors cursor-pointer"><Minus size={14}/></button>
                                  <span className="font-mono w-10 text-center font-bold text-lg">{item.quantity}</span>
                                  <button onClick={() => updateTicketQuantity(item.id, 1)} className="p-3 hover:bg-[#333] hover:text-[#FF4D00] transition-colors cursor-pointer"><Plus size={14}/></button>
                                </div>
                                <span className="font-black text-xl w-32 text-right text-white">{formatMXN(item.totalPrice)}</span>
                              </div>
                            </div>
                          ))}

                          {smartInsights.length > 0 && (
                            <div className="border border-[#FF4D00]/30 bg-[#FF4D00]/5 p-4 mt-6 border-dashed rounded-lg animate-in slide-in-from-bottom-2">
                              <h3 className="text-[#FF4D00] text-[10px] uppercase font-black flex items-center gap-2 mb-3 tracking-widest"><Sparkles size={12}/> AI: Insights de Manufactura & Hardware</h3>
                              <ul className="space-y-2">
                                {smartInsights.map((insight, j) => {
                                  const parts = insight.split('**');
                                  const emojiAndTitle = parts[1];
                                  const iconSplit = insight.split(' ')[0]; 
                                  const remainingText = parts.length > 2 ? parts[2] : insight;

                                  return (
                                    <li key={j} className="text-xs font-mono leading-relaxed opacity-80 flex gap-2">
                                      <span className="shrink-0">{iconSplit}</span>
                                      <span>
                                          {emojiAndTitle ? <strong className="text-white bg-white/10 px-1">{emojiAndTitle.replace(iconSplit, '')}</strong> : null}
                                          {remainingText}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                        </div>
                        
                        <div className="mt-auto pt-6 border-t-2 border-white flex flex-col md:flex-row justify-between items-start md:items-end gap-6 shrink-0 bg-[#111]">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Total Prospectado (MXN)</span>
                            <span className="text-6xl md:text-6xl font-black tracking-tighter text-white drop-shadow-lg">
                              {formatMXN(ticketItems.reduce((acc, it) => acc + it.totalPrice, 0))}
                            </span>
                          </div>
                          <button onClick={handleCopyClientTicket} className={`w-full md:w-auto font-black px-8 py-5 uppercase text-xs tracking-widest border-2 transition-all transform active:scale-95 cursor-pointer flex justify-center items-center gap-3 ${copiedStates['client'] ? 'bg-white text-black border-white' : 'bg-[#FF4D00] text-white border-[#FF4D00] hover:bg-transparent hover:text-[#FF4D00]'}`}>
                            {copiedStates['client'] ? <><Check size={18} /> PORTAPAPELES COMPILADO</> : <><Download size={18}/> EXPORTACIÓN INTELIGENTE (NOTION)</>}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="flex justify-between items-center font-mono text-[10px] uppercase opacity-40 mt-auto pt-2 shrink-0">
        <p className="hidden md:block">©2026 CubeUp³ Inteligencia de Manufactura Aditiva</p>
        <p className="md:hidden">©2026 CubeUp³ SO</p>
        <p className="flex items-center gap-2">Persistencia Criptográfica Local <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse hidden sm:inline-block"></span></p>
      </footer>
    </div>
  );
}
