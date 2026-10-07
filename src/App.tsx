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
  Check, 
  X,
  History,
  Share2,
  Clock,
  MessageSquare,
  Minus,
  AlertTriangle,
  Truck,
  Zap,
  Receipt,
  Sliders,
  PieChart
} from 'lucide-react';
import { useQuoteHistory, TicketItem, Quote, QuoteNotFoundError } from './hooks/useQuoteHistory';
import { useTallerConfig } from './hooks/useTallerConfig';
import { QuoteHistory } from './components/QuoteHistory';
import { MessagePresetsModal } from './components/MessagePresetsModal';
import { AjustesCostos } from './components/AjustesCostos';
import { DonaDesglose } from './components/DonaDesglose';
import { exportQuoteToPDF } from './lib/pdfHelper';
import { useToast } from './hooks/useToast';
import { 
  calcularLinea, 
  validarLinea, 
  margenToMarkup, 
  redondearAlPaso, 
  LineaInput 
} from './lib/pricing';
import { buildContext, TallerConfig } from './lib/tallerConfig';
import { calcularTicket } from './lib/ticket';

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
  const [savedQuotePricingVersion, setSavedQuotePricingVersion] = useState<number>(2);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showAjustesModal, setShowAjustesModal] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

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
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_OPERATORS;
  });

  const handleAddOperator = () => {
    if (!newOperatorInput.trim()) return;
    const updated = [...presetOperators, newOperatorInput.trim()];
    setPresetOperators(updated);
    localStorage.setItem('cubeup3-custom-operators', JSON.stringify(updated));
    setOperatorName(newOperatorInput.trim());
    setNewOperatorInput('');
    setIsAddingOperator(false);
  };

  // Selector de impresora y material
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(() => {
    return config.impresoras[0]?.id || '';
  });

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(() => {
    return config.materiales[0]?.id || '';
  });

  // Asegurar impresora válida
  useEffect(() => {
    if (config.impresoras.length > 0) {
      if (!selectedPrinterId || !config.impresoras.some(p => p.id === selectedPrinterId)) {
        setSelectedPrinterId(config.impresoras[0].id);
      }
    }
  }, [config.impresoras, selectedPrinterId]);

  const currentPrinter = useMemo(() => {
    return config.impresoras.find(p => p.id === selectedPrinterId) || config.impresoras[0];
  }, [config.impresoras, selectedPrinterId]);

  // Materiales compatibles con la tecnología de la impresora seleccionada
  const compatibleMaterials = useMemo(() => {
    if (!currentPrinter) return config.materiales;
    return config.materiales.filter(m => m.tecnologia === currentPrinter.tecnologia);
  }, [config.materiales, currentPrinter]);

  // Asegurar material compatible seleccionado
  useEffect(() => {
    if (compatibleMaterials.length > 0) {
      if (!selectedMaterialId || !compatibleMaterials.some(m => m.id === selectedMaterialId)) {
        setSelectedMaterialId(compatibleMaterials[0].id);
      }
    }
  }, [compatibleMaterials, selectedMaterialId]);

  const currentMaterial = useMemo(() => {
    return compatibleMaterials.find(m => m.id === selectedMaterialId) || compatibleMaterials[0] || config.materiales[0];
  }, [compatibleMaterials, selectedMaterialId, config.materiales]);

  // Formulario de pieza 3D
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [weight, setWeight] = useState<number | ''>(''); // Gramos (FDM) o ml (MSLA)
  const [hours, setHours] = useState<number | ''>('');   // Horas de impresión del lote completo
  const [minutosSetup, setMinutosSetup] = useState<number | ''>(''); // Preparación por lote
  const [minutosPostproceso, setMinutosPostproceso] = useState<number | ''>(''); // Postproceso por pieza
  const [extrasDirectos, setExtrasDirectos] = useState<number | ''>(''); // Insumos directos en MXN

  // Hardware independiente
  const [hwName, setHwName] = useState('');
  const [hwQuantity, setHwQuantity] = useState<number>(1);
  const [hwPrice, setHwPrice] = useState<number | ''>('');
  const [editItemId, setEditItemId] = useState<string | null>(null);

  // Línea de entrada reactiva para validar y cotizar
  const currentLineaInput = useMemo<LineaInput>(() => {
    const tec = currentPrinter?.tecnologia || 'FDM';
    const qty = Math.max(1, itemQuantity || 1);
    const h = hours === '' ? 0 : Number(hours);
    const w = weight === '' ? 0 : Number(weight);
    const setup = minutosSetup === '' ? 0 : Number(minutosSetup);
    const post = minutosPostproceso === '' ? 0 : Number(minutosPostproceso);
    const ext = extrasDirectos === '' ? 0 : Number(extrasDirectos);
    const m = Math.max(0, Math.min(0.90, globalMargin / 100));

    return {
      id: editItemId || 'draft',
      nombrePieza: itemName.trim() || 'Pieza',
      tecnologia: tec,
      cantidad: qty,
      horasImpresion: h,
      pesoGramos: tec === 'FDM' ? w : undefined,
      volumenMl: tec === 'MSLA' ? w : undefined,
      minutosSetup: setup,
      minutosPostproceso: post,
      extrasDirectos: ext,
      margen: m
    };
  }, [currentPrinter, itemQuantity, hours, weight, minutosSetup, minutosPostproceso, extrasDirectos, globalMargin, itemName, editItemId]);

  const currentPricingContext = useMemo(() => {
    if (!currentPrinter || !currentMaterial) return null;
    return buildContext(config, currentPrinter.id, currentMaterial.id, {
      urgente,
      envio: Math.max(0, Number(envio) || 0),
      cobrarIva,
      margen: Math.max(0, Math.min(0.90, globalMargin / 100))
    });
  }, [config, currentPrinter, currentMaterial, urgente, envio, cobrarIva, globalMargin]);

  // Advertencias y errores de validarLinea()
  const validationProblems = useMemo(() => {
    if (!currentPricingContext) return [];
    if (weight === '' && hours === '') return [];
    return validarLinea(currentLineaInput, currentPricingContext);
  }, [currentLineaInput, currentPricingContext, weight, hours]);

  // Cálculo en vivo de la pieza con calcularLinea()
  const liveCalculation = useMemo(() => {
    if (!currentPricingContext) return null;
    if (weight === '' || hours === '') return null;
    if (Number(weight) <= 0 || Number(hours) <= 0) return null;
    return calcularLinea(currentLineaInput, currentPricingContext);
  }, [currentLineaInput, currentPricingContext, weight, hours]);

  const livePiecePrice = liveCalculation ? liveCalculation.precioUnitario : 0;
  const livePieceSubtotal = liveCalculation ? liveCalculation.precioTotal : 0;

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
          minutosSetup: item.calc.minutosSetup,
          minutosPostproceso: item.calc.minutosPostproceso,
          extrasDirectos: item.calc.extrasDirectos,
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
          operatorName, 
          clientName, 
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
        
        lastSavedStateRef.current = currentStateStr;
        if (q?.id && q.id !== savedQuoteIdRef.current) {
          setSavedQuoteId(q.id);
          savedQuoteIdRef.current = q.id;
        }
      } catch (err: unknown) {
        if (err instanceof QuoteNotFoundError || (err instanceof Error && 'code' in err && (err as { code: string }).code === 'QUOTE_NOT_FOUND')) {
          setSavedQuoteId(null);
          savedQuoteIdRef.current = null;
          lastSavedStateRef.current = '';
          warning("El borrador ya no existe; se creará uno nuevo al siguiente cambio");
          return;
        }
        console.error("Autosave falló:", err);
      } finally {
        inFlightSignatureRef.current = null;
        isSavingRef.current = false;
        setIsSavingDraft(false);
      }
    }, 1500);

    return () => clearTimeout(timeoutMsg);
  }, [ticketItems, operatorName, clientName, globalMargin, urgente, envio, cobrarIva, config, warning]);

  const handleGenerateLocalPDF = () => {
    if (ticketItems.length === 0) return;
    const finalTotal = cobrarIva ? ticketTotals.totalConIva : ticketTotals.total;
    exportQuoteToPDF({
      folio: savedQuoteId ? (quotes.find(q => q.id === savedQuoteId)?.folio || 'BORRADOR') : 'CUB-NUEVO',
      clientName: clientName || 'Cliente',
      operatorName: operatorName || 'Asesor Técnico',
      createdAt: new Date(),
      items: ticketItems,
      total: finalTotal
    });
  };

  const handleAddPiece = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || weight === '' || hours === '') return;
    if (!currentPrinter || !currentMaterial || !currentPricingContext) return;

    const res = calcularLinea(currentLineaInput, currentPricingContext);
    const qty = Math.max(1, itemQuantity || 1);
    const tec = currentPrinter.tecnologia;
    const w = Number(weight);
    const h = Number(hours);
    const setup = minutosSetup === '' ? 0 : Number(minutosSetup);
    const post = minutosPostproceso === '' ? 0 : Number(minutosPostproceso);
    const ext = extrasDirectos === '' ? 0 : Number(extrasDirectos);

    const calcData = {
      impresoraId: currentPrinter.id,
      materialId: currentMaterial.id,
      pesoGramos: tec === 'FDM' ? w : undefined,
      volumenMl: tec === 'MSLA' ? w : undefined,
      horasImpresion: h,
      minutosSetup: setup,
      minutosPostproceso: post,
      extrasDirectos: ext,
      desglose: res.desgloseLote
    };

    if (editItemId) {
      setTicketItems(ticketItems.map(item => {
        if (item.id === editItemId) {
          return {
            ...item,
            itemName: itemName.trim(),
            quantity: qty,
            profileName: `${currentMaterial.nombre} · ${currentPrinter.nombre}`,
            profileId: currentMaterial.id,
            weightInfo: w,
            timeInfo: h,
            laborInfo: post,
            unitCost: res.costoUnitario,
            totalCost: res.costoTotal,
            unitPrice: res.precioUnitario,
            totalPrice: res.precioTotal,
            itemType: 'print',
            calc: calcData
          };
        }
        return item;
      }));
      setEditItemId(null);
    } else {
      const newItem: TicketItem = {
        id: Math.random().toString(36).substring(2, 11),
        itemName: itemName.trim(),
        quantity: qty,
        profileName: `${currentMaterial.nombre} · ${currentPrinter.nombre}`,
        profileId: currentMaterial.id,
        weightInfo: w,
        timeInfo: h,
        laborInfo: post,
        unitCost: res.costoUnitario,
        totalCost: res.costoTotal,
        unitPrice: res.precioUnitario,
        totalPrice: res.precioTotal,
        itemType: 'print',
        calc: calcData
      };
      setTicketItems([...ticketItems, newItem]);
    }

    setItemName('');
    setItemQuantity(1);
    setWeight('');
    setHours('');
    setMinutosSetup('');
    setMinutosPostproceso('');
    setExtrasDirectos('');
  };

  const handleAddHardware = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwName.trim() || hwPrice === '') return;

    const qty = Math.max(1, hwQuantity || 1);
    const baseCost = Math.max(0, Number(hwPrice));
    const m = Math.max(0, Math.min(0.90, globalMargin / 100));
    const unitPrice = redondearAlPaso(m < 1 ? baseCost / (1 - m) : baseCost, config.pasoRedondeo);
    const totalPrice = unitPrice * qty;
    const totalCost = baseCost * qty;

    if (editItemId) {
      setTicketItems(ticketItems.map(item => {
        if (item.id === editItemId) {
          return {
            ...item,
            itemName: hwName.trim(),
            quantity: qty,
            profileName: 'Hardware / Herrajes',
            unitCost: baseCost,
            totalCost,
            unitPrice,
            totalPrice,
            itemType: 'hardware',
            calc: undefined
          };
        }
        return item;
      }));
      setEditItemId(null);
    } else {
      const newItem: TicketItem = {
        id: Math.random().toString(36).substring(2, 11),
        itemName: hwName.trim(),
        quantity: qty,
        profileName: 'Hardware / Herrajes',
        weightInfo: 0,
        timeInfo: 0,
        unitCost: baseCost,
        totalCost,
        unitPrice,
        totalPrice,
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
            minutosSetup: item.calc.minutosSetup,
            minutosPostproceso: item.calc.minutosPostproceso,
            extrasDirectos: item.calc.extrasDirectos,
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

  const cancelEdit = () => {
    setEditItemId(null);
    setItemName('');
    setItemQuantity(1);
    setWeight('');
    setHours('');
    setMinutosSetup('');
    setMinutosPostproceso('');
    setExtrasDirectos('');
    setHwName('');
    setHwQuantity(1);
    setHwPrice('');
  };

  const handleEditItemInfo = (item: TicketItem) => {
    setEditItemId(item.id);
    if (item.itemType === 'hardware') {
      setHwName(item.itemName);
      setHwQuantity(item.quantity || 1);
      setHwPrice(item.unitCost);
    } else {
      setItemName(item.itemName);
      setItemQuantity(item.quantity || 1);
      setWeight(
        item.calc?.pesoGramos !== undefined 
          ? item.calc.pesoGramos 
          : item.calc?.volumenMl !== undefined 
            ? item.calc.volumenMl 
            : (item.weightInfo || '')
      );
      setHours(item.calc?.horasImpresion !== undefined ? item.calc.horasImpresion : (item.timeInfo || ''));
      setMinutosSetup(item.calc?.minutosSetup !== undefined ? item.calc.minutosSetup : '');
      setMinutosPostproceso(item.calc?.minutosPostproceso !== undefined ? item.calc.minutosPostproceso : (item.laborInfo !== undefined ? item.laborInfo : ''));
      setExtrasDirectos(item.calc?.extrasDirectos !== undefined ? item.calc.extrasDirectos : '');

      if (item.calc?.impresoraId && config.impresoras.some(p => p.id === item.calc!.impresoraId)) {
        setSelectedPrinterId(item.calc.impresoraId);
      }
      if (item.calc?.materialId && config.materiales.some(m => m.id === item.calc!.materialId)) {
        setSelectedMaterialId(item.calc.materialId);
      } else if (item.profileId && config.materiales.some(m => m.id === item.profileId)) {
        setSelectedMaterialId(item.profileId);
      }
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
      if (q?.id && q.id !== savedQuoteIdRef.current) {
        setSavedQuoteId(q.id);
        savedQuoteIdRef.current = q.id;
      }
      setSavedQuotePricingVersion(2);
      lastSavedStateRef.current = currentStateStr;
      success("Cotización guardada exitosamente");
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
    
    setActiveTab('calculator');
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
    cancelEdit();
  };

  // Cálculo de markup equivalente para visualización en el control de margen
  const currentMarginFraction = Math.max(0, Math.min(0.90, globalMargin / 100));
  const markupMultiplier = currentMarginFraction < 1 ? 1 / (1 - currentMarginFraction) : 1;
  const markupPercent = Math.round(margenToMarkup(currentMarginFraction) * 100);

  // Detección de si esta cotización o partidas provienen de la versión anterior
  const hasLegacyItems = useMemo(() => {
    return savedQuotePricingVersion !== 2 || ticketItems.some(i => i.itemType !== 'hardware' && !i.calc);
  }, [savedQuotePricingVersion, ticketItems]);

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
            onClick={() => setShowAjustesModal(true)}
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
                <form onSubmit={handleAddPiece} className="bg-white p-5 rounded-2xl border border-[#82C69E]/60 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-bold text-[#1B4D3E] flex items-center gap-2">
                      <Printer size={15}/> Dictamen de Impresión 3D
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAjustesModal(true)}
                      className="text-[10px] bg-[#F7F5F0] hover:bg-[#82C69E]/20 text-[#2E7D32] px-2 py-0.5 rounded font-mono font-bold border border-[#82C69E]/50 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Configurar tarifas del taller"
                    >
                      <Settings size={10} /> Ajustes de costos
                    </button>
                  </div>
                  
                  {/* Nombre y Cantidad de Piezas */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Descripción de la Pieza</label>
                      <input 
                        type="text" 
                        value={itemName} 
                        onChange={e => setItemName(e.target.value)} 
                        placeholder="Ej. Carcasa frontal V2..." 
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

                  {/* Selector de Impresora y Selector de Material filtrado por tecnología */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Impresora</label>
                      <select
                        value={selectedPrinterId}
                        onChange={e => setSelectedPrinterId(e.target.value)}
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                      >
                        {config.impresoras.map(imp => (
                          <option key={imp.id} value={imp.id}>
                            {imp.nombre} ({imp.tecnologia})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Material ({currentPrinter?.tecnologia})</label>
                      <select
                        value={selectedMaterialId}
                        onChange={e => setSelectedMaterialId(e.target.value)}
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                      >
                        {compatibleMaterials.map(mat => (
                          <option key={mat.id} value={mat.id}>
                            {mat.nombre} (${mat.costoPorUnidad}/{mat.tecnologia === 'FDM' ? 'kg' : 'L'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {/* Gramos / ml y Horas (del LOTE completo) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">
                        {currentPrinter?.tecnologia === 'MSLA' ? 'Volumen Lote (ml)' : 'Masa Lote (g)'}
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.1" 
                        value={weight} 
                        onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder={currentPrinter?.tecnologia === 'MSLA' ? 'Ej. 85 ml' : 'Ej. 120 g'} 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-sm font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                      {validationProblems.filter(p => p.campo === 'pesoGramos' || p.campo === 'volumenMl').map((p, idx) => (
                        <p key={idx} className="text-[10px] text-amber-700 flex items-start gap-1 font-medium leading-tight mt-0.5">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          <span>{p.mensaje}</span>
                        </p>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">
                        Tiempo Impresión Lote (H)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.1" 
                        value={hours} 
                        onChange={e => setHours(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ej. 6.5" 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-sm font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                      {validationProblems.filter(p => p.campo === 'horasImpresion').map((p, idx) => (
                        <p key={idx} className="text-[10px] text-amber-700 flex items-start gap-1 font-medium leading-tight mt-0.5">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                          <span>{p.mensaje}</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Texto de ayuda sobre lote completo */}
                  <p className="text-[10px] text-gray-500 font-mono -mt-2">
                    ℹ {currentPrinter?.tecnologia === 'MSLA' ? 'Mililitros' : 'Gramos'} y horas corresponden al lote completo de {itemQuantity} {itemQuantity === 1 ? 'pieza' : 'piezas'}.
                  </p>

                  {/* Preparación, Postproceso y Extras Directos */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase font-mono text-[#1B4D3E] font-bold" title="Minutos de preparación aplicados una sola vez por lote">
                        Prep. (min/lote)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="1" 
                        value={minutosSetup} 
                        onChange={e => setMinutosSetup(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ej. 15" 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase font-mono text-[#1B4D3E] font-bold" title="Minutos de postproceso por cada pieza terminada">
                        Post. (min/pz)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="1" 
                        value={minutosPostproceso} 
                        onChange={e => setMinutosPostproceso(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ej. 5" 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase font-mono text-[#1B4D3E] font-bold" title="Costos directos adicionales en pesos (insertos, tornillos, etc.)">
                        Extras ($ MXN)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.5" 
                        value={extrasDirectos} 
                        onChange={e => setExtrasDirectos(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ej. 25" 
                        className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]" 
                      />
                    </div>
                  </div>

                  {/* Resumen dinámico en vivo calculado con calcularLinea() */}
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
                        {livePieceSubtotal > 0 ? formatMXN(livePieceSubtotal) : '$ 0.00'}
                      </span>
                    </div>
                  </div>

                  {editItemId && ticketItems.find(i => i.id === editItemId)?.itemType !== 'hardware' ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button 
                        type="submit" 
                        disabled={!itemName.trim() || weight === '' || hours === ''} 
                        className="w-full bg-[#1B4D3E] text-white py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Check size={15}/> Guardar Cambios
                      </button>
                      <button 
                        type="button" 
                        onClick={cancelEdit} 
                        className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#F7F5F0] transition-all cursor-pointer"
                      >
                        <X size={15}/> Cancelar
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="submit" 
                      disabled={!itemName.trim() || weight === '' || hours === ''} 
                      className="mt-1 w-full bg-[#1B4D3E] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                    >
                      <Plus size={16}/> Añadir {itemQuantity > 1 ? `${itemQuantity} Piezas` : 'al Ticket'}
                    </button>
                  )}
                </form>

                {/* Accesorios / Hardware (Insumos Adicionales) */}
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
                      placeholder="Ej. Tornillos M3..." 
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
                        disabled={!hwName.trim() || hwPrice === ''} 
                        className="w-full bg-[#1B4D3E] text-white py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-1 hover:bg-[#2E7D32] cursor-pointer"
                      >
                        <Check size={14}/> Guardar
                      </button>
                      <button 
                        type="button" 
                        onClick={cancelEdit} 
                        className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X size={14}/> Cancelar
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="submit" 
                      disabled={!hwName.trim() || hwPrice === ''} 
                      className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#F0FDF4] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Plus size={14}/> Añadir Insumo
                    </button>
                  )}
                </form>

              </div>

              {/* Right Col: Ticket / En Curso */}
              <div className="md:col-span-7 xl:col-span-8 flex flex-col bg-white border border-[#82C69E]/70 rounded-2xl shadow-sm overflow-hidden relative pb-4">
                
                {/* Header del Ticket */}
                <div className="bg-[#1B4D3E] text-white p-4 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText size={16}/>
                    <h2 className="font-bold text-sm tracking-widest uppercase">Cotización en Curso</h2>
                    {hasLegacyItems && (
                      <span className="text-[9px] bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                        Calculada con fórmula anterior
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {ticketItems.length > 0 && (
                      <button
                        onClick={handleClear}
                        className="text-xs text-red-200 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                        title="Limpiar ticket actual"
                      >
                        <RotateCcw size={12} /> Limpiar
                      </button>
                    )}
                    {isSavingDraft ? (
                      <span className="bg-yellow-400 text-yellow-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono animate-pulse">
                        Sincronizando...
                      </span>
                    ) : savedQuoteId ? (
                      <span className="bg-[#82C69E] text-[#1B4D3E] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                        Borrador Sincronizado
                      </span>
                    ) : null}
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
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#1B4D3E] text-sm sm:text-base">{item.itemName}</span>
                              {!item.calc && item.itemType !== 'hardware' && (
                                <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold px-1.5 py-0.2 rounded">
                                  Fórmula anterior
                                </span>
                              )}
                            </div>
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
                              className="w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 hover:bg-[#82C69E]/20 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
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
                              className="w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 hover:bg-[#82C69E]/20 cursor-pointer"
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
                              className="text-gray-400 hover:text-[#1B4D3E] p-1.5 hover:bg-[#F7F5F0] rounded transition-colors cursor-pointer" 
                              title="Editar especificaciones"
                            >
                              <Settings size={15} />
                            </button>
                            <button 
                              onClick={() => setTicketItems(ticketItems.filter(i => i.id !== item.id))} 
                              className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors cursor-pointer" 
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

                {/* Footer del Ticket: Parámetros del Pedido, Totales y Acciones */}
                <div className="shrink-0 p-4 lg:p-6 bg-white border-t border-[#82C69E]/40 flex flex-col gap-4">
                  
                  {/* Parámetros del Ticket: Urgencia, Envío, IVA */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#F7F5F0] rounded-xl border border-gray-200 text-xs">
                    
                    {/* Switch Urgente */}
                    <label className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-[#1B4D3E] transition-colors">
                      <div className="flex items-center gap-1.5 text-[#1B4D3E] font-bold">
                        <Zap size={14} className={urgente ? "text-amber-500 fill-amber-500" : "text-gray-400"} />
                        <span>Urgente (+{Math.round(config.recargoUrgencia * 100)}%)</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={urgente}
                        onChange={e => setUrgente(e.target.checked)}
                        className="accent-[#1B4D3E] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    {/* Envío */}
                    <div className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center gap-1.5 text-[#1B4D3E] font-bold">
                        <Truck size={14} className={envio > 0 ? "text-[#2E7D32]" : "text-gray-400"} />
                        <span>Envío (MXN):</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-mono">$</span>
                        <input 
                          type="number" 
                          min="0"
                          step="10"
                          value={envio}
                          onChange={e => setEnvio(Math.max(0, Number(e.target.value) || 0))}
                          className="w-16 text-right font-mono font-bold text-[#1B4D3E] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Switch IVA */}
                    <label className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-[#1B4D3E] transition-colors">
                      <div className="flex items-center gap-1.5 text-[#1B4D3E] font-bold">
                        <Receipt size={14} className={cobrarIva ? "text-[#2E7D32]" : "text-gray-400"} />
                        <span>Cobrar IVA ({Math.round(config.ivaTasa * 100)}%)</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={cobrarIva}
                        onChange={e => setCobrarIva(e.target.checked)}
                        className="accent-[#1B4D3E] w-4 h-4 cursor-pointer"
                      />
                    </label>

                  </div>

                  {/* Desglose de Inversión vs Margen Real */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex justify-between items-center bg-[#F7F5F0] p-2.5 px-3 rounded-xl border border-gray-200">
                      <span className="uppercase font-mono text-[10px] font-bold text-gray-500 tracking-wider">
                        Inversión Taller (Costo)
                      </span>
                      <span className="font-mono text-sm font-bold text-gray-700">
                        {formatMXN(ticketTotals.desgloseAgregado.costoRealTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-[#F0FDF4] p-2.5 px-3 rounded-xl border border-[#82C69E]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="uppercase font-mono text-[10px] font-bold text-[#1B4D3E] tracking-wider">
                            Margen Real
                          </span>
                          <div className="flex items-center bg-white border border-[#2E7D32] rounded px-1.5 py-0.5">
                            <input 
                              type="number" 
                              min="0" 
                              max="90"
                              step="1" 
                              value={globalMargin} 
                              onChange={e => setGlobalMargin(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} 
                              className="w-10 text-center text-xs font-bold text-[#1B4D3E] focus:outline-none" 
                            />
                            <span className="text-xs text-[#2E7D32] font-bold">%</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-gray-500 mt-0.5">
                          equivale a costo × {markupMultiplier.toFixed(2)} ({markupPercent}% markup)
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#2E7D32]">
                        +{formatMXN(ticketTotals.utilidadNeta)}
                      </span>
                    </div>
                  </div>

                  {/* Resumen de Partidas y Recargos */}
                  {(urgente || envio > 0 || cobrarIva) && (
                    <div className="flex flex-col gap-1 px-1 text-xs font-mono text-gray-600 border-t border-gray-100 pt-2">
                      <div className="flex justify-between">
                        <span>Subtotal de partidas:</span>
                        <span>{formatMXN(ticketTotals.subtotal)}</span>
                      </div>
                      {urgente && ticketTotals.recargoUrgenciaMonto > 0 && (
                        <div className="flex justify-between text-amber-700 font-bold">
                          <span>Recargo urgencia ({Math.round(config.recargoUrgencia * 100)}%):</span>
                          <span>+{formatMXN(ticketTotals.recargoUrgenciaMonto)}</span>
                        </div>
                      )}
                      {envio > 0 && (
                        <div className="flex justify-between">
                          <span>Envío / Mensajería:</span>
                          <span>+{formatMXN(ticketTotals.costoEnvio)}</span>
                        </div>
                      )}
                      {cobrarIva && ticketTotals.ivaMonto > 0 && (
                        <div className="flex justify-between text-[#1B4D3E] font-bold">
                          <span>IVA ({Math.round(config.ivaTasa * 100)}%):</span>
                          <span>+{formatMXN(ticketTotals.ivaMonto)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Total de Venta */}
                  <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
                    <span className="uppercase font-mono text-xs font-bold text-gray-500 tracking-wider">
                      {cobrarIva ? 'Importe Total con IVA' : 'Importe Total de Venta'}
                    </span>
                    <span className="text-3xl lg:text-4xl font-extrabold text-[#1B4D3E] tracking-tight">
                      {formatMXN(cobrarIva ? ticketTotals.totalConIva : ticketTotals.total)}{' '}
                      <span className="text-xs font-mono font-normal text-gray-400">MXN</span>
                    </span>
                  </div>

                  {/* Gráfica de Dona del Desglose Interno del Ticket */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-[#1B4D3E]">
                        <PieChart size={14} className="text-[#2E7D32]" />
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
                          Desglose de Costos
                        </span>
                      </div>
                      {cobrarIva && ticketTotals.ivaMonto > 0 && (
                        <label className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-gray-600 cursor-pointer">
                          <span>Incluir IVA</span>
                          <input 
                            type="checkbox" 
                            checked={mostrarIvaEnDona}
                            onChange={e => setMostrarIvaEnDona(e.target.checked)}
                            className="accent-[#1B4D3E] w-3.5 h-3.5 cursor-pointer"
                          />
                        </label>
                      )}
                    </div>
                    
                    <DonaDesglose 
                      desglose={ticketTotals.desgloseAgregado}
                      total={ticketTotals.total}
                      totalConIva={ticketTotals.totalConIva}
                      mostrarIva={cobrarIva && mostrarIvaEnDona}
                      tamaño={180}
                      gananciaRedondeoMinimos={ticketTotals.total - ticketTotals.subtotal - ticketTotals.recargoUrgenciaMonto - ticketTotals.costoEnvio > 0.01 ? (ticketTotals.total - ticketTotals.subtotal - ticketTotals.recargoUrgenciaMonto - ticketTotals.costoEnvio) : 0}
                    />
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleSave} 
                      disabled={ticketItems.length === 0 || isSavingDraft} 
                      className="w-full bg-[#1B4D3E] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
                    >
                      <Save size={15}/> {isSavingDraft ? 'Guardando...' : 'Guardar Cotización'}
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
                          className="bg-white border border-[#1B4D3E] text-[#1B4D3E] py-1.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#F0FDF4] transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <FileText size={13} /> PDF
                        </button>

                        <button 
                          type="button" 
                          onClick={() => setShowPresetsModal(true)}
                          disabled={ticketItems.length === 0}
                          className="bg-[#2E7D32] text-white py-1.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#1B4D3E] transition-colors disabled:opacity-40 cursor-pointer"
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
        />
      )}

    </div>
  );
}

export default App;
