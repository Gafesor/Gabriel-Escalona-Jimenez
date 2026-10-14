import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Printer, 
  Sliders, 
  History 
} from 'lucide-react';
import { useQuoteHistory, TicketItem, Quote, QuoteNotFoundError } from './hooks/useQuoteHistory';
import { useTallerConfig } from './hooks/useTallerConfig';
import { QuoteHistory } from './components/QuoteHistory';
import { MessagePresetsModal } from './components/MessagePresetsModal';
import { AjustesCostos, TabKey } from './components/AjustesCostos';
import { CalculadoraPieza } from './components/CalculadoraPieza';
import { FormHardware } from './components/FormHardware';
import { TicketEnCurso } from './components/TicketEnCurso';
import { exportQuoteToPDF } from './lib/pdfHelper';
import { useToast } from './hooks/useToast';
import { calcularLinea, redondearAlPaso, LineaInput } from './lib/pricing';
import { buildContext, Preset } from './lib/tallerConfig';
import { calcularTicket } from './lib/ticket';

const DEFAULT_OPERATORS: string[] = ['Gabriel', 'Andrea', 'Carlos'];

export function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'history'>('calculator');
  const [operatorName, setOperatorName] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [isAddingOperator, setIsAddingOperator] = useState<boolean>(false);
  const [newOperatorInput, setNewOperatorInput] = useState<string>('');
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [savedQuotePricingVersion, setSavedQuotePricingVersion] = useState<number>(2);
  const [showPresetsModal, setShowPresetsModal] = useState<boolean>(false);
  const [showAjustesModal, setShowAjustesModal] = useState<boolean>(false);
  const [ajustesTab, setAjustesTab] = useState<TabKey>('taller');
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<TicketItem | null>(null);

  // Hook central de configuración del taller (persistido en Firestore / localStorage)
  const { config, guardar: guardarConfig, restaurarDefaults } = useTallerConfig();
  const { warning, success, error } = useToast();

  // Estados comerciales del ticket
  const [globalMargin, setGlobalMargin] = useState<number>(() => Math.round(config.margenPorDefecto * 100));
  const [urgente, setUrgente] = useState<boolean>(false);
  const [envio, setEnvio] = useState<number>(0);
  const [cobrarIva, setCobrarIva] = useState<boolean>(() => config.cobrarIvaPorDefecto);
  const [mostrarIvaEnDona, setMostrarIvaEnDona] = useState<boolean>(() => config.cobrarIvaPorDefecto);

  // Autosave references para prevenir ciclos y condiciones de carrera
  const lastSavedStateRef = useRef<string>('');
  const savedQuoteIdRef = useRef<string | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const inFlightSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    savedQuoteIdRef.current = savedQuoteId;
  }, [savedQuoteId]);

  // Operadores técnicos guardados
  const [presetOperators, setPresetOperators] = useState<string[]>(() => {
    const saved = localStorage.getItem('cubeup3-custom-operators');
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          return parsed;
        }
      } catch (e: unknown) {
        console.error('Error al analizar operadores en localStorage:', e);
      }
    }
    return DEFAULT_OPERATORS;
  });

  const handleAddOperator = () => {
    const trimmed = newOperatorInput.trim();
    if (!trimmed) return;
    const updated = [...presetOperators, trimmed];
    setPresetOperators(updated);
    localStorage.setItem('cubeup3-custom-operators', JSON.stringify(updated));
    setOperatorName(trimmed);
    setNewOperatorInput('');
    setIsAddingOperator(false);
  };

  const { saveQuote, quotes } = useQuoteHistory();
  const saveQuoteRef = useRef(saveQuote);
  useEffect(() => {
    saveQuoteRef.current = saveQuote;
  }, [saveQuote]);

  // Recálculo reactivo de partidas con calc (v2) y hardware cuando cambia la configuración o márgenes
  useEffect(() => {
    const m = Math.max(0, Math.min(0.90, globalMargin / 100));
    setTicketItems(prev => {
      let changed = false;
      const next = prev.map(item => {
        if (item.itemType === 'hardware') {
          const unitPrice = redondearAlPaso(m < 1 ? item.unitCost / (1 - m) : item.unitCost, config.pasoRedondeo);
          const totalPrice = unitPrice * item.quantity;
          if (unitPrice !== item.unitPrice || totalPrice !== item.totalPrice) {
            changed = true;
            return { ...item, unitPrice, totalPrice };
          }
          return item;
        }

        // Partidas históricas sin calc: nunca se recalculan automáticamente
        if (!item.calc) {
          return item;
        }

        const printer = config.impresoras.find(i => i.id === item.calc!.impresoraId) || config.impresoras[0];
        const mat = config.materiales.find(m => m.id === item.calc!.materialId) || config.materiales[0];
        const ctx = buildContext(config, printer.id, mat.id, {
          urgente,
          envio: Math.max(0, Number(envio) || 0),
          cobrarIva,
          margen: m
        });

        const input: LineaInput = {
          id: item.id,
          nombrePieza: item.itemName,
          tecnologia: mat.tecnologia,
          cantidad: item.quantity,
          horasImpresion: item.calc.horasImpresion,
          pesoGramos: item.calc.pesoGramos,
          volumenMl: item.calc.volumenMl,
          minutosModelado: item.calc.minutosModelado !== undefined ? item.calc.minutosModelado : 0,
          minutosAlistado: item.calc.minutosSetup !== undefined ? item.calc.minutosSetup : 0,
          minutosPostproceso: item.calc.minutosPostproceso !== undefined ? item.calc.minutosPostproceso : (item.laborInfo ?? 0),
          extrasDirectos: item.calc.extrasDirectos !== undefined ? item.calc.extrasDirectos : 0,
          margen: m
        };

        const res = calcularLinea(input, ctx);
        if (
          res.costoUnitario !== item.unitCost ||
          res.costoTotal !== item.totalCost ||
          res.precioUnitario !== item.unitPrice ||
          res.precioTotal !== item.totalPrice
        ) {
          changed = true;
          return {
            ...item,
            unitCost: res.costoUnitario,
            totalCost: res.costoTotal,
            unitPrice: res.precioUnitario,
            totalPrice: res.precioTotal,
            calc: {
              ...item.calc,
              desglose: res.desgloseLote
            }
          };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [config, globalMargin, urgente, envio, cobrarIva]);

  // Totales completos del ticket calculados 100% con calcularTicket()
  const ticketTotals = useMemo(() => {
    return calcularTicket(ticketItems, config, {
      urgente,
      envio: Math.max(0, Number(envio) || 0),
      cobrarIva,
      margenSobrescrito: Math.max(0, Math.min(0.90, globalMargin / 100))
    });
  }, [ticketItems, config, urgente, envio, cobrarIva, globalMargin]);

  // Autosave en tiempo real con debounce
  useEffect(() => {
    if (ticketItems.length === 0) return;

    const currentStateStr = JSON.stringify({
      ticketItems,
      operatorName: operatorName.trim(),
      clientName: clientName.trim(),
      globalMargin,
      urgente,
      envio,
      cobrarIva
    });

    if (currentStateStr === lastSavedStateRef.current || currentStateStr === inFlightSignatureRef.current) {
      return;
    }

    const timeoutMsg = setTimeout(async () => {
      if (isSavingRef.current || currentStateStr === lastSavedStateRef.current || currentStateStr === inFlightSignatureRef.current) {
        return;
      }
      isSavingRef.current = true;
      inFlightSignatureRef.current = currentStateStr;
      setIsSavingDraft(true);

      try {
        const currentTargetId = savedQuoteIdRef.current;
        const q = await saveQuoteRef.current(
          ticketItems,
          operatorName.trim(),
          clientName.trim(),
          '',
          globalMargin,
          currentTargetId || undefined,
          {
            pricingVersion: 2,
            configSnapshot: config,
            urgente,
            envio: Math.max(0, Number(envio) || 0),
            cobrarIva
          }
        );
        if (q && q.id) {
          setSavedQuoteId(q.id);
          savedQuoteIdRef.current = q.id;
          lastSavedStateRef.current = currentStateStr;
        }
      } catch (err: unknown) {
        if (err instanceof QuoteNotFoundError || (err instanceof Error && 'code' in err && (err as { code: string }).code === 'QUOTE_NOT_FOUND')) {
          setSavedQuoteId(null);
          savedQuoteIdRef.current = null;
          lastSavedStateRef.current = '';
          warning("El borrador ya no existe; se creará uno nuevo al siguiente cambio");
          return;
        }
        console.error(err);
      } finally {
        inFlightSignatureRef.current = null;
        isSavingRef.current = false;
        setIsSavingDraft(false);
      }
    }, 1500);

    return () => clearTimeout(timeoutMsg);
  }, [ticketItems, operatorName, clientName, globalMargin, urgente, envio, cobrarIva, config, warning]);

  const handleAddOrUpdateItem = (item: TicketItem) => {
    if (editingItem) {
      setTicketItems(prev => prev.map(i => (i.id === item.id ? item : i)));
      setEditingItem(null);
    } else {
      setTicketItems(prev => [...prev, item]);
    }
  };

  const updateItemQuantity = (id: string, newQty: number) => {
    const validQty = Math.max(1, newQty);
    setTicketItems(prev => prev.map(item => {
      if (item.id === id) {
        if (item.calc) {
          const printer = config.impresoras.find(i => i.id === item.calc!.impresoraId) || config.impresoras[0];
          const mat = config.materiales.find(m => m.id === item.calc!.materialId) || config.materiales[0];
          const ctx = buildContext(config, printer.id, mat.id, {
            urgente,
            envio: Math.max(0, Number(envio) || 0),
            cobrarIva,
            margen: Math.max(0, Math.min(0.90, globalMargin / 100))
          });

          const input: LineaInput = {
            id: item.id,
            nombrePieza: item.itemName,
            tecnologia: mat.tecnologia,
            cantidad: validQty,
            horasImpresion: item.calc.horasImpresion,
            pesoGramos: item.calc.pesoGramos,
            volumenMl: item.calc.volumenMl,
            minutosModelado: item.calc.minutosModelado !== undefined ? item.calc.minutosModelado : 0,
            minutosAlistado: item.calc.minutosSetup !== undefined ? item.calc.minutosSetup : 0,
            minutosPostproceso: item.calc.minutosPostproceso !== undefined ? item.calc.minutosPostproceso : (item.laborInfo ?? 0),
            extrasDirectos: item.calc.extrasDirectos !== undefined ? item.calc.extrasDirectos : 0,
            margen: Math.max(0, Math.min(0.90, globalMargin / 100))
          };

          const res = calcularLinea(input, ctx);
          return {
            ...item,
            quantity: validQty,
            unitCost: res.costoUnitario,
            totalCost: res.costoTotal,
            unitPrice: res.precioUnitario,
            totalPrice: res.precioTotal,
            calc: {
              ...item.calc,
              desglose: res.desgloseLote
            }
          };
        }

        // Partidas históricas o hardware
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

  const handleRemoveItem = (id: string) => {
    setTicketItems(prev => prev.filter(i => i.id !== id));
    if (editingItem?.id === id) {
      setEditingItem(null);
    }
  };

  const handleSave = async () => {
    if (ticketItems.length === 0 || isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSavingDraft(true);
    const currentStateStr = JSON.stringify({
      ticketItems,
      operatorName: operatorName.trim(),
      clientName: clientName.trim(),
      globalMargin,
      urgente,
      envio,
      cobrarIva
    });
    inFlightSignatureRef.current = currentStateStr;

    try {
      const q = await saveQuote(
        ticketItems, 
        operatorName, 
        clientName, 
        '', 
        globalMargin, 
        savedQuoteId || undefined,
        {
          pricingVersion: 2,
          configSnapshot: config,
          urgente,
          envio: Math.max(0, Number(envio) || 0),
          cobrarIva
        }
      );
      if (q && q.id) {
        setSavedQuoteId(q.id);
        savedQuoteIdRef.current = q.id;
        lastSavedStateRef.current = currentStateStr;
        success(`Cotización guardada exitosamente (${q.folio})`);
      }
    } catch (err: unknown) {
      if (err instanceof QuoteNotFoundError || (err instanceof Error && 'code' in err && (err as { code: string }).code === 'QUOTE_NOT_FOUND')) {
        setSavedQuoteId(null);
        savedQuoteIdRef.current = null;
        lastSavedStateRef.current = '';
        warning("El borrador ya no existe; se creará uno nuevo al siguiente cambio");
        return;
      }
      console.error(err);
      error("Error al guardar la cotización");
    } finally {
      inFlightSignatureRef.current = null;
      isSavingRef.current = false;
      setIsSavingDraft(false);
    }
  };

  const handleEditDraft = (quote: Quote) => {
    const defaultMargin = typeof quote.globalMargin === 'number' && Number.isFinite(quote.globalMargin)
      ? quote.globalMargin 
      : Math.round(config.margenPorDefecto * 100);

    setTicketItems(quote.items);
    setClientName(quote.clientName || '');
    setOperatorName(quote.operatorName || '');
    setGlobalMargin(defaultMargin);
    setUrgente(Boolean(quote.urgente));
    setEnvio(quote.envio !== undefined ? quote.envio : 0);
    setCobrarIva(quote.cobrarIva !== undefined ? quote.cobrarIva : config.cobrarIvaPorDefecto);
    setSavedQuoteId(quote.id);
    savedQuoteIdRef.current = quote.id;
    setSavedQuotePricingVersion(quote.pricingVersion || 1);
    
    lastSavedStateRef.current = JSON.stringify({
      ticketItems: quote.items,
      operatorName: (quote.operatorName || '').trim(),
      clientName: (quote.clientName || '').trim(),
      globalMargin: defaultMargin,
      urgente: Boolean(quote.urgente),
      envio: quote.envio !== undefined ? quote.envio : 0,
      cobrarIva: quote.cobrarIva !== undefined ? quote.cobrarIva : config.cobrarIvaPorDefecto
    });
    
    setEditingItem(null);
    setActiveTab('calculator');
  };

  const handleClear = () => {
    setTicketItems([]);
    setSavedQuoteId(null);
    savedQuoteIdRef.current = null;
    setSavedQuotePricingVersion(2);
    setClientName('');
    setUrgente(false);
    setEnvio(0);
    setCobrarIva(config.cobrarIvaPorDefecto);
    setGlobalMargin(Math.round(config.margenPorDefecto * 100));
    lastSavedStateRef.current = '';
    setEditingItem(null);
  };

  const handleNewQuote = () => {
    handleClear();
    setActiveTab('calculator');
  };

  const handleCloneQuote = (cloned: Quote) => {
    handleEditDraft(cloned);
  };

  const handlePrintQuote = (quote: Quote) => {
    exportQuoteToPDF({
      folio: quote.folio,
      clientName: quote.clientName || 'Cliente',
      operatorName: quote.operatorName || 'Asesor Técnico',
      createdAt: new Date(quote.createdAt),
      items: quote.items,
      total: quote.total
    });
  };

  const handleGenerateLocalPDF = () => {
    if (ticketItems.length === 0) return;
    const finalTotal = cobrarIva ? ticketTotals.totalConIva : ticketTotals.total;
    const currentFolio = savedQuoteId 
      ? (quotes.find(q => q.id === savedQuoteId)?.folio || 'CUB-TEMP') 
      : 'CUB-BORRADOR';

    exportQuoteToPDF({
      folio: currentFolio,
      clientName: clientName.trim() || 'Cliente Mostrador',
      operatorName: operatorName.trim() || 'Asesor Técnico',
      createdAt: new Date(),
      items: ticketItems,
      total: finalTotal
    });
  };

  const handleOpenAjustes = (tab?: TabKey) => {
    setAjustesTab(tab || 'taller');
    setShowAjustesModal(true);
  };

  const handleSavePreset = async (newPreset: Preset) => {
    const currentPresets = config.presets || [];
    const updatedPresets = [...currentPresets, newPreset];
    await guardarConfig({
      ...config,
      presets: updatedPresets
    });
    success(`Prestablecido "${newPreset.nombre}" guardado.`);
  };

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
            <p className="text-[11px] text-gray-300 font-mono">Cotizador Técnico con Motor Dinámico de Manufactura</p>
          </div>
        </div>

        {/* Global Nav Toggles & Ajustes Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleOpenAjustes('taller')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#2E7D32] hover:bg-[#82C69E] hover:text-[#1B4D3E] transition-all border border-[#82C69E]/40 shadow-sm cursor-pointer"
            title="Abrir menú de configuración de costos, impresoras y materiales"
          >
            <Sliders size={14} /> Ajustes de Costos
          </button>

          <div className="bg-[#153e32] p-1 rounded-xl flex items-center border border-[#2E7D32]">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'calculator' 
                  ? 'bg-[#2E7D32] text-white shadow-sm' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Printer size={14} /> Cotizador
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            onNewQuote={handleNewQuote}
            onCloneQuote={handleCloneQuote}
            onPrint={handlePrintQuote}
          />
        ) : (
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
                      className="text-[10px] text-[#2E7D32] hover:underline font-bold flex items-center gap-1 cursor-pointer"
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
                        className="bg-[#1B4D3E] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#2E7D32] cursor-pointer"
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

              {/* Calculadora (Piezas FDM / MSLA conectadas a calcularLinea) */}
              <CalculadoraPieza
                config={config}
                globalMargin={globalMargin}
                onUpdateGlobalMargin={setGlobalMargin}
                urgente={urgente}
                envio={envio}
                cobrarIva={cobrarIva}
                editingItem={editingItem}
                onAddOrUpdateItem={handleAddOrUpdateItem}
                onCancelEdit={() => setEditingItem(null)}
                onOpenAjustes={handleOpenAjustes}
                onSaveConfig={guardarConfig}
              />

              {/* Accesorios / Hardware (Insumos Adicionales) */}
              <FormHardware
                config={config}
                globalMargin={globalMargin}
                editingItem={editingItem}
                onAddOrUpdateItem={handleAddOrUpdateItem}
                onCancelEdit={() => setEditingItem(null)}
              />
            </div>

            {/* Right Col: Ticket / En Curso */}
            <TicketEnCurso
              ticketItems={ticketItems}
              config={config}
              globalMargin={globalMargin}
              setGlobalMargin={setGlobalMargin}
              urgente={urgente}
              setUrgente={setUrgente}
              envio={envio}
              setEnvio={setEnvio}
              cobrarIva={cobrarIva}
              setCobrarIva={setCobrarIva}
              mostrarIvaEnDona={mostrarIvaEnDona}
              setMostrarIvaEnDona={setMostrarIvaEnDona}
              isSavingDraft={isSavingDraft}
              savedQuoteId={savedQuoteId}
              savedQuotePricingVersion={savedQuotePricingVersion}
              ticketTotals={ticketTotals}
              onClearTicket={handleClear}
              onUpdateItemQuantity={updateItemQuantity}
              onEditItem={(item) => setEditingItem(item)}
              onRemoveItem={handleRemoveItem}
              onSaveQuote={handleSave}
              onGeneratePDF={handleGenerateLocalPDF}
              onOpenWhatsApp={() => setShowPresetsModal(true)}
              onSavePreset={handleSavePreset}
              onSaveConfig={guardarConfig}
            />
          </div>
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
            total: cobrarIva ? ticketTotals.totalConIva : ticketTotals.total,
            items: ticketItems,
            globalMargin,
            notes: '',
            isArchived: false,
            pricingVersion: 2,
            configSnapshot: config,
            urgente,
            envio,
            cobrarIva
          }}
        />
      )}

      {/* Modal de Ajustes de Costos, Impresoras y Materiales */}
      {showAjustesModal && (
        <AjustesCostos
          isOpen={showAjustesModal}
          onClose={() => setShowAjustesModal(false)}
          config={config}
          onSaveConfig={guardarConfig}
          onRestoreDefaults={restaurarDefaults}
          initialTab={ajustesTab}
        />
      )}
    </div>
  );
}

export default App;
