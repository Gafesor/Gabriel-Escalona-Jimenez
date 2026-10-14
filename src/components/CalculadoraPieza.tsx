import React, { useState, useMemo, useEffect } from 'react';
import { 
  Printer, 
  Settings, 
  AlertTriangle, 
  Plus, 
  Check, 
  X, 
  Pencil, 
  Sparkles, 
  Bookmark, 
  Zap, 
  Shield, 
  Layers, 
  Crown, 
  Box, 
  Hammer, 
  Heart, 
  Wrench, 
  Package, 
  Rocket, 
  Star,
  Save
} from 'lucide-react';
import { 
  TallerConfig, 
  buildContext, 
  Preset, 
  DEFAULT_PRESETS 
} from '../lib/tallerConfig';
import { 
  calcularLinea, 
  validarLinea, 
  LineaInput, 
  MaterialConfig, 
  ImpresoraConfig 
} from '../lib/pricing';
import { TicketItem } from '../hooks/useQuoteHistory';
import { PopoverEdicionContexto } from './popovers/PopoverEdicionContexto';

export interface CalculadoraPiezaProps {
  config: TallerConfig;
  globalMargin: number;
  onUpdateGlobalMargin?: (newMarginPercent: number) => void;
  urgente: boolean;
  envio: number;
  cobrarIva: boolean;
  editingItem: TicketItem | null;
  onAddOrUpdateItem: (item: TicketItem) => void;
  onCancelEdit: () => void;
  onOpenAjustes: (initialTab?: 'taller' | 'gastosFijos' | 'impresoras' | 'materiales' | 'presets') => void;
  onSaveConfig?: (newConfig: TallerConfig) => Promise<void> | void;
}

const formatMXN = (val: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
};

const renderIconoPreset = (iconoNombre: string) => {
  const props = { size: 12, className: "shrink-0" };
  switch (iconoNombre) {
    case 'Zap': return <Zap {...props} />;
    case 'Shield': return <Shield {...props} />;
    case 'Sparkles': return <Sparkles {...props} />;
    case 'Layers': return <Layers {...props} />;
    case 'Crown': return <Crown {...props} />;
    case 'Box': return <Box {...props} />;
    case 'Hammer': return <Hammer {...props} />;
    case 'Heart': return <Heart {...props} />;
    case 'Wrench': return <Wrench {...props} />;
    case 'Package': return <Package {...props} />;
    case 'Rocket': return <Rocket {...props} />;
    case 'Star': return <Star {...props} />;
    default: return <Bookmark {...props} />;
  }
};

export const CalculadoraPieza: React.FC<CalculadoraPiezaProps> = ({
  config,
  globalMargin,
  onUpdateGlobalMargin,
  urgente,
  envio,
  cobrarIva,
  editingItem,
  onAddOrUpdateItem,
  onCancelEdit,
  onOpenAjustes,
  onSaveConfig
}) => {
  // Selector de impresora
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(() => {
    return config.impresoras[0]?.id || '';
  });

  // Selector de material
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(() => {
    return config.materiales[0]?.id || '';
  });

  // Campos de captura del formulario
  const [itemName, setItemName] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [weight, setWeight] = useState<number | ''>(''); // Gramos (FDM) o ml (MSLA)
  const [hours, setHours] = useState<number | ''>(''); // Horas de impresión del lote completo
  const [minutosDiseno, setMinutosDiseno] = useState<number | ''>(''); // Diseño CAD (una vez por lote)
  const [minutosSetup, setMinutosSetup] = useState<number | ''>(''); // Preparación / alistado por lote
  const [minutosPostproceso, setMinutosPostproceso] = useState<number | ''>(''); // Postproceso por pieza
  const [extrasDirectos, setExtrasDirectos] = useState<number | ''>(''); // Insumos directos en MXN

  // Control de prestablecidos activos
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activePresetSnapshot, setActivePresetSnapshot] = useState<Preset | null>(null);
  const [showSavePresetModal, setShowSavePresetModal] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Control de popovers anclados de edición contextual
  const [popoverMaterialOpen, setPopoverMaterialOpen] = useState<boolean>(false);
  const [popoverImpresoraOpen, setPopoverImpresoraOpen] = useState<boolean>(false);

  // Lista de prestablecidos activos disponibles
  const presetsDisponibles: Preset[] = useMemo(() => {
    const list = config.presets && config.presets.length > 0 ? config.presets : DEFAULT_PRESETS;
    return list.filter(p => !p.archivado);
  }, [config.presets]);

  // Sincronizar selección de impresora válida si cambia la configuración
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

  // Filtrar materiales compatibles con la tecnología de la impresora seleccionada
  const compatibleMaterials = useMemo(() => {
    if (!currentPrinter) return config.materiales;
    return config.materiales.filter(m => m.tecnologia === currentPrinter.tecnologia);
  }, [config.materiales, currentPrinter]);

  // Sincronizar selección de material compatible si cambia la impresora o catálogo
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

  // Detección de modificación respecto al prestablecido activo
  const isPresetModified = useMemo<boolean>(() => {
    if (!activePresetSnapshot) return false;
    const snap = activePresetSnapshot;
    const currentSetup = minutosSetup === '' ? 0 : Number(minutosSetup);
    const currentPost = minutosPostproceso === '' ? 0 : Number(minutosPostproceso);
    const currentDiseno = minutosDiseno === '' ? 0 : Number(minutosDiseno);

    return (
      selectedPrinterId !== snap.impresoraId ||
      selectedMaterialId !== snap.materialId ||
      currentSetup !== snap.minutosAlistado ||
      currentPost !== snap.minutosPostproceso ||
      currentDiseno !== snap.minutosModelado
    );
  }, [
    activePresetSnapshot,
    selectedPrinterId,
    selectedMaterialId,
    minutosSetup,
    minutosPostproceso,
    minutosDiseno
  ]);

  // Aplicar un prestablecido en 1 clic
  const handleApplyPreset = (preset: Preset) => {
    setActivePresetId(preset.id);
    setActivePresetSnapshot(preset);

    // Seleccionar impresora si existe
    if (config.impresoras.some(p => p.id === preset.impresoraId)) {
      setSelectedPrinterId(preset.impresoraId);
    }
    // Seleccionar material si existe
    if (config.materiales.some(m => m.id === preset.materialId)) {
      setSelectedMaterialId(preset.materialId);
    }

    setMinutosSetup(preset.minutosAlistado > 0 ? preset.minutosAlistado : '');
    setMinutosPostproceso(preset.minutosPostproceso > 0 ? preset.minutosPostproceso : '');
    setMinutosDiseno(preset.minutosModelado > 0 ? preset.minutosModelado : '');

    // Actualizar el margen general de la cotización al sugerido por el preset
    if (onUpdateGlobalMargin) {
      onUpdateGlobalMargin(Math.round(preset.margenSugerido * 1000) / 10);
    }
  };

  // Guardar estado actual como un nuevo prestablecido
  const handleSaveAsNewPreset = async () => {
    const name = newPresetName.trim() || 'Nuevo Prestablecido';
    if (!currentPrinter || !currentMaterial || !onSaveConfig) return;

    const nuevoPreset: Preset = {
      id: `preset-${Date.now()}`,
      nombre: name,
      icono: 'Bookmark',
      descripcion: `${currentMaterial.nombre} · ${currentPrinter.nombre}`,
      materialId: currentMaterial.id,
      impresoraId: currentPrinter.id,
      mermaPorcentaje: currentMaterial.mermaPorcentaje,
      tasaFalla: config.tasaFallaPorDefecto,
      minutosModelado: minutosDiseno === '' ? 0 : Number(minutosDiseno),
      minutosAlistado: minutosSetup === '' ? 0 : Number(minutosSetup),
      minutosPostproceso: minutosPostproceso === '' ? 0 : Number(minutosPostproceso),
      margenSugerido: Math.max(0, Math.min(0.90, globalMargin / 100)),
      archivado: false,
      orden: presetsDisponibles.length
    };

    const newPresetsList = [...(config.presets || DEFAULT_PRESETS), nuevoPreset];
    await onSaveConfig({
      ...config,
      presets: newPresetsList
    });

    setActivePresetId(nuevoPreset.id);
    setActivePresetSnapshot(nuevoPreset);
    setShowSavePresetModal(false);
    setNewPresetName('');
  };

  // Guardar edición rápida de material desde el popover
  const handleGuardarMaterialContexto = async (matActualizado: MaterialConfig) => {
    if (!onSaveConfig) return;
    const nuevosMateriales = config.materiales.map(m =>
      m.id === matActualizado.id ? matActualizado : m
    );
    await onSaveConfig({
      ...config,
      materiales: nuevosMateriales
    });
  };

  // Guardar edición rápida de impresora desde el popover
  const handleGuardarImpresoraContexto = async (impActualizada: ImpresoraConfig) => {
    if (!onSaveConfig) return;
    const nuevasImpresoras = config.impresoras.map(i =>
      i.id === impActualizada.id ? impActualizada : i
    );
    await onSaveConfig({
      ...config,
      impresoras: nuevasImpresoras
    });
  };

  // Poblado reactivo cuando se entra o sale del modo edición de una pieza
  useEffect(() => {
    if (editingItem && editingItem.itemType !== 'hardware') {
      setItemName(editingItem.itemName);
      setItemQuantity(editingItem.quantity || 1);
      setWeight(
        editingItem.calc?.pesoGramos !== undefined
          ? editingItem.calc.pesoGramos
          : editingItem.calc?.volumenMl !== undefined
            ? editingItem.calc.volumenMl
            : (editingItem.weightInfo !== undefined ? editingItem.weightInfo : '')
      );
      setHours(
        editingItem.calc?.horasImpresion !== undefined
          ? editingItem.calc.horasImpresion
          : (editingItem.timeInfo !== undefined ? editingItem.timeInfo : '')
      );
      setMinutosDiseno(
        editingItem.calc?.minutosModelado !== undefined
          ? editingItem.calc.minutosModelado
          : ''
      );
      setMinutosSetup(
        editingItem.calc?.minutosAlistado !== undefined
          ? editingItem.calc.minutosAlistado
          : editingItem.calc?.minutosSetup !== undefined
            ? editingItem.calc.minutosSetup
            : ''
      );
      setMinutosPostproceso(
        editingItem.calc?.minutosPostproceso !== undefined
          ? editingItem.calc.minutosPostproceso
          : (editingItem.laborInfo !== undefined ? editingItem.laborInfo : '')
      );
      setExtrasDirectos(editingItem.calc?.extrasDirectos !== undefined ? editingItem.calc.extrasDirectos : '');

      if (editingItem.calc?.impresoraId && config.impresoras.some(p => p.id === editingItem.calc!.impresoraId)) {
        setSelectedPrinterId(editingItem.calc.impresoraId);
      }
      if (editingItem.calc?.materialId && config.materiales.some(m => m.id === editingItem.calc!.materialId)) {
        setSelectedMaterialId(editingItem.calc.materialId);
      } else if (editingItem.profileId && config.materiales.some(m => m.id === editingItem.profileId)) {
        setSelectedMaterialId(editingItem.profileId);
      }
    } else if (!editingItem) {
      setItemName('');
      setItemQuantity(1);
      setWeight('');
      setHours('');
      setMinutosDiseno('');
      setMinutosSetup('');
      setMinutosPostproceso('');
      setExtrasDirectos('');
      setActivePresetId(null);
      setActivePresetSnapshot(null);
    }
  }, [editingItem, config.impresoras, config.materiales]);

  const isEditing = Boolean(editingItem && editingItem.itemType !== 'hardware');

  // Entrada de la línea para pricing.ts
  const currentLineaInput = useMemo<LineaInput>(() => {
    const tec = currentPrinter?.tecnologia || 'FDM';
    const qty = Math.max(1, itemQuantity || 1);
    const h = hours === '' ? 0 : Number(hours);
    const w = weight === '' ? 0 : Number(weight);
    const diseno = minutosDiseno === '' ? 0 : Number(minutosDiseno);
    const setup = minutosSetup === '' ? 0 : Number(minutosSetup);
    const post = minutosPostproceso === '' ? 0 : Number(minutosPostproceso);
    const ext = extrasDirectos === '' ? 0 : Number(extrasDirectos);
    const m = Math.max(0, Math.min(0.90, globalMargin / 100));

    return {
      id: editingItem?.id || 'draft',
      nombrePieza: itemName.trim() || 'Pieza',
      tecnologia: tec,
      cantidad: qty,
      horasImpresion: h,
      pesoGramos: tec === 'FDM' ? w : undefined,
      volumenMl: tec === 'MSLA' ? w : undefined,
      minutosModelado: diseno,
      minutosAlistado: setup,
      minutosSetup: setup,
      minutosPostproceso: post,
      extrasDirectos: ext,
      margen: m
    };
  }, [
    currentPrinter,
    itemQuantity,
    hours,
    weight,
    minutosDiseno,
    minutosSetup,
    minutosPostproceso,
    extrasDirectos,
    globalMargin,
    itemName,
    editingItem
  ]);

  // Contexto de tarifas para el motor de pricing
  const currentPricingContext = useMemo(() => {
    if (!currentPrinter || !currentMaterial) return null;
    return buildContext(config, currentPrinter.id, currentMaterial.id, {
      urgente,
      envio: Math.max(0, Number(envio) || 0),
      cobrarIva,
      margen: Math.max(0, Math.min(0.90, globalMargin / 100))
    });
  }, [config, currentPrinter, currentMaterial, urgente, envio, cobrarIva, globalMargin]);

  // Problemas de validación en tiempo real con validarLinea()
  const validationProblems = useMemo(() => {
    if (!currentPricingContext) return [];
    if (weight === '' && hours === '') return [];
    return validarLinea(currentLineaInput, currentPricingContext);
  }, [currentLineaInput, currentPricingContext, weight, hours]);

  // Cálculo en vivo con calcularLinea()
  const liveCalculation = useMemo(() => {
    if (!currentPricingContext) return null;
    if (weight === '' || hours === '') return null;
    if (Number(weight) <= 0 || Number(hours) <= 0) return null;
    return calcularLinea(currentLineaInput, currentPricingContext);
  }, [currentLineaInput, currentPricingContext, weight, hours]);

  const livePiecePrice = liveCalculation ? liveCalculation.precioUnitario : 0;
  const livePieceSubtotal = liveCalculation ? liveCalculation.precioTotal : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || weight === '' || hours === '') return;
    if (!currentPrinter || !currentMaterial || !currentPricingContext) return;

    const res = calcularLinea(currentLineaInput, currentPricingContext);
    const qty = Math.max(1, itemQuantity || 1);
    const tec = currentPrinter.tecnologia;
    const w = Number(weight);
    const h = Number(hours);
    const diseno = minutosDiseno === '' ? 0 : Number(minutosDiseno);
    const setup = minutosSetup === '' ? 0 : Number(minutosSetup);
    const post = minutosPostproceso === '' ? 0 : Number(minutosPostproceso);
    const ext = extrasDirectos === '' ? 0 : Number(extrasDirectos);

    const calcData = {
      impresoraId: currentPrinter.id,
      materialId: currentMaterial.id,
      pesoGramos: tec === 'FDM' ? w : undefined,
      volumenMl: tec === 'MSLA' ? w : undefined,
      horasImpresion: h,
      minutosModelado: diseno,
      minutosAlistado: setup,
      minutosSetup: setup,
      minutosPostproceso: post,
      extrasDirectos: ext,
      desglose: res.desgloseLote
    };

    const targetItem: TicketItem = {
      id: editingItem ? editingItem.id : Math.random().toString(36).substring(2, 11),
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

    onAddOrUpdateItem(targetItem);

    if (!editingItem) {
      setItemName('');
      setItemQuantity(1);
      setWeight('');
      setHours('');
      setMinutosDiseno('');
      setMinutosSetup('');
      setMinutosPostproceso('');
      setExtrasDirectos('');
      setActivePresetId(null);
      setActivePresetSnapshot(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-[#82C69E]/60 shadow-sm flex flex-col gap-4">
      
      {/* 1. FILA DE CHIPS DE PRESTABLECIDOS (Arriba del formulario) */}
      <div className="flex flex-col gap-2 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1B4D3E] flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#2E7D32]" /> Prestablecidos Rápidos (1 Clic)
          </span>

          <div className="flex items-center gap-2">
            {/* Botón Guardar como nuevo prestablecido si hay modificaciones */}
            {isPresetModified && activePresetSnapshot && (
              <button
                type="button"
                onClick={() => {
                  setNewPresetName(`${activePresetSnapshot.nombre} (Copia)`);
                  setShowSavePresetModal(true);
                }}
                className="text-[10px] font-mono font-bold text-[#1B4D3E] bg-[#82C69E]/25 hover:bg-[#82C69E]/40 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                title="Guardar combinación actual como nuevo prestablecido"
              >
                <Save size={11} /> Guardar como nuevo prestablecido
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenAjustes('presets')}
              className="text-[10px] text-gray-400 hover:text-[#1B4D3E] font-mono hover:underline cursor-pointer"
              title="Gestionar prestablecidos en Ajustes"
            >
              Gestionar →
            </button>
          </div>
        </div>

        {/* Chips horizontales */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {presetsDisponibles.map(p => {
            const isActive = activePresetId === p.id;
            const isThisModified = isActive && isPresetModified;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                  isActive
                    ? isThisModified
                      ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                      : 'bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-xs'
                    : 'bg-[#F7F5F0] text-gray-700 border-gray-200 hover:border-[#82C69E] hover:bg-white'
                }`}
                title={p.descripcion || p.nombre}
              >
                {renderIconoPreset(p.icono)}
                <span>
                  {p.nombre}
                  {isThisModified && <span className="ml-1 text-[10px] font-normal italic">(modificado)</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal / Diálogo inline para guardar como nuevo prestablecido */}
      {showSavePresetModal && (
        <div className="p-3 bg-[#F7F5F0] border border-[#82C69E] rounded-xl flex flex-col gap-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#1B4D3E] uppercase font-mono">
              Nuevo Prestablecido
            </span>
            <button
              type="button"
              onClick={() => setShowSavePresetModal(false)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              placeholder="Nombre del prestablecido..."
              className="flex-1 bg-white border border-gray-300 rounded-lg p-1.5 text-xs font-bold text-[#1B4D3E] focus:outline-none focus:border-[#1B4D3E]"
            />
            <button
              type="button"
              onClick={handleSaveAsNewPreset}
              className="bg-[#1B4D3E] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#2E7D32] transition-colors cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Encabezado del Formulario */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase font-bold text-[#1B4D3E] flex items-center gap-2">
          <Printer size={15} /> Dictamen de Impresión 3D
        </h3>
        <button
          type="button"
          onClick={() => onOpenAjustes('taller')}
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
            onChange={e => setItemQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full bg-[#F7F5F0] border border-[#1B4D3E] rounded-lg p-2 text-sm font-extrabold text-[#1B4D3E] text-center focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
          />
        </div>
      </div>

      {/* Selector de Impresora y Selector de Material con Edición en Contexto */}
      <div className="grid grid-cols-2 gap-2">
        
        {/* Selector de Impresora + Botón de Edición Rápida */}
        <div className="flex flex-col gap-1 relative">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">Impresora</label>
            <button
              type="button"
              onClick={() => {
                setPopoverImpresoraOpen(!popoverImpresoraOpen);
                setPopoverMaterialOpen(false);
              }}
              className="text-[#2E7D32] hover:text-[#1B4D3E] p-0.5 rounded hover:bg-gray-100 transition-colors cursor-pointer"
              title="Ajustar parámetros de esta impresora (potencia, amortización, mantenimiento)"
            >
              <Pencil size={12} />
            </button>
          </div>

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

          {/* Popover anclado de impresora */}
          <PopoverEdicionContexto
            tipo="impresora"
            isOpen={popoverImpresoraOpen}
            onClose={() => setPopoverImpresoraOpen(false)}
            impresora={currentPrinter}
            onGuardarImpresora={handleGuardarImpresoraContexto}
            onAbrirAjustesCompletos={pestana => {
              setPopoverImpresoraOpen(false);
              onOpenAjustes(pestana);
            }}
          />
        </div>

        {/* Selector de Material + Botón de Edición Rápida */}
        <div className="flex flex-col gap-1 relative">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-mono text-[#1B4D3E] font-bold">
              Material ({currentPrinter?.tecnologia})
            </label>
            <button
              type="button"
              onClick={() => {
                setPopoverMaterialOpen(!popoverMaterialOpen);
                setPopoverImpresoraOpen(false);
              }}
              className="text-[#2E7D32] hover:text-[#1B4D3E] p-0.5 rounded hover:bg-gray-100 transition-colors cursor-pointer"
              title="Ajustar costo por kg/L o merma de este material"
            >
              <Pencil size={12} />
            </button>
          </div>

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

          {/* Popover anclado de material */}
          <PopoverEdicionContexto
            tipo="material"
            isOpen={popoverMaterialOpen}
            onClose={() => setPopoverMaterialOpen(false)}
            material={currentMaterial}
            onGuardarMaterial={handleGuardarMaterialContexto}
            onAbrirAjustesCompletos={pestana => {
              setPopoverMaterialOpen(false);
              onOpenAjustes(pestana);
            }}
          />
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
          {validationProblems
            .filter(p => p.campo === 'pesoGramos' || p.campo === 'volumenMl')
            .map((p, idx) => (
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
          {validationProblems
            .filter(p => p.campo === 'horasImpresion')
            .map((p, idx) => (
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

      {/* Mano de obra (Diseño CAD, Prep/Alistado, Postproceso) y Extras Directos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase font-mono text-[#1B4D3E] font-bold" title="Minutos de modelado o diseño CAD cobrados una vez por lote">
            Diseño CAD (min)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={minutosDiseno}
            onChange={e => setMinutosDiseno(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ej. 0"
            className="w-full bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase font-mono text-[#1B4D3E] font-bold" title="Minutos de preparación o alistado aplicados una sola vez por lote">
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

      {isEditing ? (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            type="submit"
            disabled={!itemName.trim() || weight === '' || hours === ''}
            className="w-full bg-[#1B4D3E] text-white py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check size={15} /> Guardar Cambios
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#F7F5F0] transition-all cursor-pointer"
          >
            <X size={15} /> Cancelar
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={!itemName.trim() || weight === '' || hours === ''}
          className="mt-1 w-full bg-[#1B4D3E] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
        >
          <Plus size={16} /> Añadir {itemQuantity > 1 ? `${itemQuantity} Piezas` : 'al Ticket'}
        </button>
      )}
    </form>
  );
};

export default CalculadoraPieza;
