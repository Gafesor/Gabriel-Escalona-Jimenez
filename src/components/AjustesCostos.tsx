import React, { useState, useMemo } from 'react';
import { 
  X, 
  Settings, 
  Info, 
  RotateCcw, 
  Save, 
  Check, 
  AlertTriangle, 
  Plus, 
  Printer, 
  Layers, 
  Sliders, 
  Archive, 
  RotateCw,
  TrendingUp,
  Percent,
  Zap,
  Clock,
  DollarSign
} from 'lucide-react';
import { 
  TallerConfig, 
  DEFAULT_TALLER_CONFIG, 
  buildContext, 
  sanitizeConfig 
} from '../lib/tallerConfig';
import { 
  ImpresoraConfig, 
  MaterialConfig, 
  TecnologiaImpresion, 
  calcularLinea, 
  LineaInput 
} from '../lib/pricing';
import { DesgloseAgregadoTicket } from '../lib/ticket';
import { DonaDesglose } from './DonaDesglose';

export interface AjustesCostosProps {
  isOpen: boolean;
  onClose: () => void;
  config: TallerConfig;
  onSaveConfig: (newConfig: TallerConfig) => Promise<void>;
  onRestoreDefaults: () => Promise<void>;
}

export type ImpresoraConEstado = ImpresoraConfig & {
  archivado?: boolean;
};

export type MaterialConEstado = MaterialConfig & {
  archivado?: boolean;
};

const formatMXN = (val: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
};

// Conversión de porcentajes: fracción 0.45 <-> 45
const toPercent = (fraction: number): number => {
  return Math.round(fraction * 1000) / 10;
};

const fromPercent = (percent: number): number => {
  return Math.round(percent * 10) / 1000;
};

const HELP_TEXTS = {
  tarifaKwh: 'lo que pagas por cada kWh según tu recibo de CFE. Pesa poco: una impresora FDM gasta ~0.1 kWh por hora.',
  potenciaPromedioW: 'consumo REAL medido imprimiendo, no el que marca la fuente. Si pones el nominal (p. ej. 1000 W), el costo de energía sale hasta 10 veces más alto.',
  precioVidaUtil: 'la impresora se paga sola cobrando una parte en cada hora. $28,000 en 4,000 h = $7 por hora.',
  mantenimientoPorHora: 'boquillas, bandas, lubricante, PEI, FEP, repartidos por hora de uso.',
  costoMaterial: 'lo que pagaste por el carrete o la botella, con envío incluido.',
  mermaPorcentaje: 'material que se tira: purga, soportes, brim, residuos. Se suma al peso de la pieza.',
  tarifaOperadorHora: 'lo que vale una hora de tu trabajo. La preparación se cobra una vez por lote; el postproceso, por cada pieza.',
  tasaFallaPorDefecto: 'de cada 100 impresiones, cuántas salen mal. El costo se divide entre (1 − falla): con 10% cobras 11.1% más, porque las piezas buenas pagan las fallidas.',
  margenPorDefecto: 'qué parte del PRECIO es ganancia. Margen de 45% → precio = costo ÷ 0.55 = costo × 1.82. No es lo mismo que sumar 45% al costo (eso deja solo 31% de margen).',
  minimoPorPieza: 'ninguna pieza se vende por debajo de este precio aunque el cálculo dé menos.',
  minimoPedido: 'si la orden suma menos, se cobra este monto.',
  pasoRedondeo: 'el precio por pieza sube al siguiente múltiplo ($1, $5, $10). La diferencia es ganancia extra.',
  recargoUrgencia: 'se suma al subtotal solo si marcas la cotización como urgente.',
  ivaTasa: 'impuesto que pagas al cliente... no: impuesto que cobras al cliente y entregas al SAT; no es ganancia.'
};

export function AjustesCostos({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onRestoreDefaults
}: AjustesCostosProps) {
  const [activeTab, setActiveTab] = useState<'taller' | 'impresoras' | 'materiales'>('taller');
  const [draft, setDraft] = useState<TallerConfig>(() => JSON.parse(JSON.stringify(config)));
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [openHelpKey, setOpenHelpKey] = useState<string | null>(null);

  // Pieza de referencia editable para pruebas de impacto
  const [refPeso, setRefPeso] = useState<number>(80);
  const [refHoras, setRefHoras] = useState<number>(4);
  const [refCantidad, setRefCantidad] = useState<number>(1);
  const [refSetup, setRefSetup] = useState<number>(15);
  const [refPost, setRefPost] = useState<number>(5);
  const [refPrinterId, setRefPrinterId] = useState<string>(() => {
    const fdm = config.impresoras.find(i => i.tecnologia === 'FDM');
    return fdm ? fdm.id : (config.impresoras[0]?.id || '');
  });
  const [refMaterialId, setRefMaterialId] = useState<string>(() => {
    const fdmMat = config.materiales.find(m => m.tecnologia === 'FDM');
    return fdmMat ? fdmMat.id : (config.materiales[0]?.id || '');
  });

  // Modal para agregar/editar impresora
  const [editingPrinter, setEditingPrinter] = useState<ImpresoraConEstado | null>(null);
  const [isCreatingPrinter, setIsCreatingPrinter] = useState(false);

  // Modal para agregar/editar material
  const [editingMaterial, setEditingMaterial] = useState<MaterialConEstado | null>(null);
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);

  // Sincronizar borrador cuando se abre el modal
  React.useEffect(() => {
    if (isOpen) {
      setDraft(JSON.parse(JSON.stringify(config)));
      setShowConfirmRestore(false);
      setOpenHelpKey(null);
    }
  }, [isOpen, config]);

  // Línea de entrada de la pieza de referencia
  const refLineaInput: LineaInput = useMemo(() => {
    const printer = draft.impresoras.find(i => i.id === refPrinterId) || draft.impresoras[0];
    const tec: TecnologiaImpresion = printer ? printer.tecnologia : 'FDM';
    return {
      id: 'ref-piece',
      nombrePieza: 'Pieza de Referencia',
      tecnologia: tec,
      cantidad: Math.max(1, refCantidad),
      horasImpresion: Math.max(0.1, refHoras),
      pesoGramos: tec === 'FDM' ? Math.max(1, refPeso) : undefined,
      volumenMl: tec === 'MSLA' ? Math.max(1, refPeso) : undefined,
      minutosSetup: Math.max(0, refSetup),
      minutosPostproceso: Math.max(0, refPost),
      extrasDirectos: 0,
      margen: draft.margenPorDefecto
    };
  }, [draft, refPrinterId, refCantidad, refHoras, refPeso, refSetup, refPost]);

  // Resultado y desglose para la configuración guardada oficial
  const resGuardado = useMemo(() => {
    try {
      const pId = refPrinterId || config.impresoras[0]?.id || '';
      const mId = refMaterialId || config.materiales[0]?.id || '';
      const ctx = buildContext(config, pId, mId, {
        urgente: false,
        envio: 0,
        cobrarIva: false,
        margen: config.margenPorDefecto
      });
      return calcularLinea(refLineaInput, ctx);
    } catch {
      return null;
    }
  }, [config, refPrinterId, refMaterialId, refLineaInput]);

  // Resultado y desglose para la configuración en borrador
  const resBorrador = useMemo(() => {
    try {
      const pId = refPrinterId || draft.impresoras[0]?.id || '';
      const mId = refMaterialId || draft.materiales[0]?.id || '';
      const ctx = buildContext(draft, pId, mId, {
        urgente: false,
        envio: 0,
        cobrarIva: false,
        margen: draft.margenPorDefecto
      });
      return calcularLinea(refLineaInput, ctx);
    } catch {
      return null;
    }
  }, [draft, refPrinterId, refMaterialId, refLineaInput]);

  const precioGuardado = resGuardado ? resGuardado.precioTotal : 0;
  const precioBorrador = resBorrador ? resBorrador.precioTotal : 0;

  const diffPesos = precioBorrador - precioGuardado;
  const diffPorcentaje = precioGuardado > 0 ? (diffPesos / precioGuardado) * 100 : 0;

  // Desglose agregado para la dona de "Guardado"
  const desgloseGuardado: DesgloseAgregadoTicket | null = useMemo(() => {
    if (!resGuardado) return null;
    const d = resGuardado.desgloseLote;
    return {
      material: d.material,
      energia: d.energia,
      maquina: d.maquina,
      consumibles: d.consumibles,
      manoDeObra: d.laborSetup + d.laborPost,
      extras: d.extras,
      hardwareCosto: 0,
      reservaFalla: d.reservaFalla,
      costoDirectoTotal: d.costoDirecto,
      costoRealTotal: resGuardado.costoTotal,
      subtotal: resGuardado.precioTotal,
      recargoUrgenciaMonto: 0,
      costoEnvio: 0,
      utilidad: resGuardado.utilidad,
      margenRealizado: resGuardado.margenRealizado,
      ivaMonto: 0,
      total: resGuardado.precioTotal,
      totalConIva: resGuardado.precioTotal
    };
  }, [resGuardado]);

  // Desglose agregado para la dona de "Borrador"
  const desgloseBorrador: DesgloseAgregadoTicket | null = useMemo(() => {
    if (!resBorrador) return null;
    const d = resBorrador.desgloseLote;
    return {
      material: d.material,
      energia: d.energia,
      maquina: d.maquina,
      consumibles: d.consumibles,
      manoDeObra: d.laborSetup + d.laborPost,
      extras: d.extras,
      hardwareCosto: 0,
      reservaFalla: d.reservaFalla,
      costoDirectoTotal: d.costoDirecto,
      costoRealTotal: resBorrador.costoTotal,
      subtotal: resBorrador.precioTotal,
      recargoUrgenciaMonto: 0,
      costoEnvio: 0,
      utilidad: resBorrador.utilidad,
      margenRealizado: resBorrador.margenRealizado,
      ivaMonto: 0,
      total: resBorrador.precioTotal,
      totalConIva: resBorrador.precioTotal
    };
  }, [resBorrador]);

  // Función genérica para calcular el impacto en vivo de mover cualquier variable 10%
  const getImpactText = (modifier: (d: TallerConfig) => TallerConfig): string => {
    try {
      const pId = refPrinterId || draft.impresoras[0]?.id || '';
      const mId = refMaterialId || draft.materiales[0]?.id || '';
      
      const ctxBase = buildContext(draft, pId, mId, {
        urgente: false,
        envio: 0,
        cobrarIva: false,
        margen: draft.margenPorDefecto
      });
      const baseRes = calcularLinea(refLineaInput, ctxBase);
      const basePrice = baseRes.precioTotal;

      const modDraft = modifier(JSON.parse(JSON.stringify(draft)));
      const ctxMod = buildContext(modDraft, pId, mId, {
        urgente: false,
        envio: 0,
        cobrarIva: false,
        margen: modDraft.margenPorDefecto
      });
      const modRes = calcularLinea(refLineaInput, ctxMod);
      const modPrice = modRes.precioTotal;

      const delta = modPrice - basePrice;
      if (Math.abs(delta) < 0.01) {
        return 'Si subes este valor 10% → el precio cambia $0.00 (0.0%) por redondeo o mínimo por pieza.';
      }
      const pct = basePrice > 0 ? (delta / basePrice) * 100 : 0;
      const sign = delta > 0 ? '+' : '';
      return `Si subes este valor 10% → el precio cambia ${sign}${formatMXN(delta)} (${sign}${pct.toFixed(1)}%)`;
    } catch {
      return 'Impacto no disponible.';
    }
  };

  // Validaciones inline conforme a sanitizeConfig
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (draft.tarifaKwh < 0) errors.tarifaKwh = 'La tarifa eléctrica no puede ser negativa.';
    if (draft.tarifaOperadorHora < 0) errors.tarifaOperadorHora = 'La tarifa de operador no puede ser negativa.';
    if (draft.margenPorDefecto < 0 || draft.margenPorDefecto > 0.90) {
      errors.margenPorDefecto = 'El margen debe estar entre 0% y 90%.';
    }
    if (draft.tasaFallaPorDefecto < 0 || draft.tasaFallaPorDefecto > 0.40) {
      errors.tasaFallaPorDefecto = 'La tasa de falla debe estar entre 0% y 40%.';
    }
    if (draft.minimoPorPieza < 0) errors.minimoPorPieza = 'El mínimo por pieza no puede ser negativo.';
    if (draft.minimoPedido < 0) errors.minimoPedido = 'El mínimo de pedido no puede ser negativo.';
    if (draft.recargoUrgencia < 0 || draft.recargoUrgencia > 2.0) {
      errors.recargoUrgencia = 'El recargo de urgencia debe estar entre 0% y 200%.';
    }
    if (draft.ivaTasa < 0 || draft.ivaTasa > 0.50) {
      errors.ivaTasa = 'La tasa de IVA debe estar entre 0% y 50%.';
    }
    return errors;
  }, [draft]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  const handleSave = async () => {
    if (hasErrors || isSaving) return;
    setIsSaving(true);
    try {
      const sanitized = sanitizeConfig(draft);
      await onSaveConfig(sanitized);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(JSON.parse(JSON.stringify(config)));
    onClose();
  };

  const handleRestore = async () => {
    setIsSaving(true);
    try {
      await onRestoreDefaults();
      setDraft(JSON.parse(JSON.stringify(DEFAULT_TALLER_CONFIG)));
      setShowConfirmRestore(false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 lg:p-6 overflow-y-auto">
      <div className="bg-white border border-[#82C69E] w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-[#2B2B2B]">
        
        {/* Header del Panel de Ajustes */}
        <header className="bg-[#1B4D3E] text-white p-4 lg:px-6 flex justify-between items-center shrink-0 border-b border-[#2E7D32]">
          <div className="flex items-center gap-3">
            <div className="bg-[#82C69E] text-[#1B4D3E] p-2 rounded-xl">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base lg:text-lg tracking-tight flex items-center gap-2">
                Ajustes de Costos y Tarifas
                <span className="text-[10px] bg-[#2E7D32] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider text-white">
                  Edición en Borrador
                </span>
              </h2>
              <p className="text-xs text-gray-300 font-mono">
                Modifica variables y analiza su impacto en tiempo real antes de guardar.
              </p>
            </div>
          </div>

          <button
            onClick={handleDiscard}
            className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-black/20 transition-colors cursor-pointer"
            title="Cerrar sin guardar"
          >
            <X size={20} />
          </button>
        </header>

        {/* Barra de Pestañas */}
        <div className="bg-[#F7F5F0] border-b border-gray-200 px-4 lg:px-6 py-2 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('taller')}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'taller'
                ? 'bg-[#1B4D3E] text-white shadow-xs'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <Zap size={14} /> Taller (Globales)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('impresoras')}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'impresoras'
                ? 'bg-[#1B4D3E] text-white shadow-xs'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <Printer size={14} /> Impresoras ({draft.impresoras.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('materiales')}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'materiales'
                ? 'bg-[#1B4D3E] text-white shadow-xs'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <Layers size={14} /> Materiales ({draft.materiales.length})
          </button>
        </div>

        {/* Contenido Principal con 2 Columnas */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Columna Principal: Variables y Tablas */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Banner de confirmación para restaurar defaults */}
            {showConfirmRestore && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2.5 text-amber-900">
                  <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">¿Restaurar todos los valores por defecto de fábrica?</p>
                    <p className="mt-0.5 text-amber-800">
                      Esto reemplazará tus tarifas eléctricas, costo de operador, márgenes, impresoras y materiales con los valores canónicos oficiales.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowConfirmRestore(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                  >
                    {isSaving ? 'Restaurando...' : 'Sí, restaurar de fábrica'}
                  </button>
                </div>
              </div>
            )}

            {/* PESTAÑA 1: TALLER (GLOBALES) */}
            {activeTab === 'taller' && (
              <div className="flex flex-col gap-5">
                
                {/* Tarifa Eléctrica CFE */}
                <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-[#1B4D3E] uppercase font-mono">
                        Tarifa eléctrica (CFE)
                      </label>
                      <button
                        type="button"
                        onClick={() => setOpenHelpKey(openHelpKey === 'tarifaKwh' ? null : 'tarifaKwh')}
                        className="text-gray-400 hover:text-[#1B4D3E] p-0.5 cursor-pointer"
                        title="Ver explicación"
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1">
                      <span className="text-xs text-gray-400 font-mono">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={draft.tarifaKwh}
                        onChange={e => setDraft({ ...draft, tarifaKwh: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-16 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-500 font-mono">MXN/kWh</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={draft.tarifaKwh}
                    onChange={e => setDraft({ ...draft, tarifaKwh: Number(e.target.value) })}
                    className="accent-[#1B4D3E] w-full cursor-pointer"
                  />

                  {openHelpKey === 'tarifaKwh' && (
                    <div className="p-2.5 bg-white rounded-lg border border-[#82C69E]/50 text-xs text-gray-700 leading-relaxed font-sans">
                      {HELP_TEXTS.tarifaKwh}
                    </div>
                  )}

                  <p className="text-[11px] font-mono text-[#2E7D32]">
                    {getImpactText(d => ({ ...d, tarifaKwh: d.tarifaKwh * 1.10 }))}
                  </p>
                  {validationErrors.tarifaKwh && (
                    <span className="text-[10px] text-red-600 font-bold">{validationErrors.tarifaKwh}</span>
                  )}
                </div>

                {/* Tarifa Operador Hora */}
                <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-[#1B4D3E] uppercase font-mono">
                        Costo de operador (Mano de obra)
                      </label>
                      <button
                        type="button"
                        onClick={() => setOpenHelpKey(openHelpKey === 'tarifaOperadorHora' ? null : 'tarifaOperadorHora')}
                        className="text-gray-400 hover:text-[#1B4D3E] p-0.5 cursor-pointer"
                        title="Ver explicación"
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1">
                      <span className="text-xs text-gray-400 font-mono">$</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={draft.tarifaOperadorHora}
                        onChange={e => setDraft({ ...draft, tarifaOperadorHora: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-16 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-500 font-mono">MXN/h</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={draft.tarifaOperadorHora}
                    onChange={e => setDraft({ ...draft, tarifaOperadorHora: Number(e.target.value) })}
                    className="accent-[#1B4D3E] w-full cursor-pointer"
                  />

                  {openHelpKey === 'tarifaOperadorHora' && (
                    <div className="p-2.5 bg-white rounded-lg border border-[#82C69E]/50 text-xs text-gray-700 leading-relaxed font-sans">
                      {HELP_TEXTS.tarifaOperadorHora}
                    </div>
                  )}

                  <p className="text-[11px] font-mono text-[#2E7D32]">
                    {getImpactText(d => ({ ...d, tarifaOperadorHora: d.tarifaOperadorHora * 1.10 }))}
                  </p>
                  {validationErrors.tarifaOperadorHora && (
                    <span className="text-[10px] text-red-600 font-bold">{validationErrors.tarifaOperadorHora}</span>
                  )}
                </div>

                {/* Margen por defecto y Tasa de Falla en 2 Columnas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Margen Real sobre precio */}
                  <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-[#1B4D3E] uppercase font-mono">
                          Margen deseado
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenHelpKey(openHelpKey === 'margenPorDefecto' ? null : 'margenPorDefecto')}
                          className="text-gray-400 hover:text-[#1B4D3E] p-0.5 cursor-pointer"
                          title="Ver explicación"
                        >
                          <Info size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          max="90"
                          step="1"
                          value={toPercent(draft.margenPorDefecto)}
                          onChange={e => setDraft({ ...draft, margenPorDefecto: fromPercent(Math.max(0, Math.min(90, Number(e.target.value) || 0))) })}
                          className="w-12 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                        />
                        <span className="text-xs text-[#2E7D32] font-bold">%</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="1"
                      value={toPercent(draft.margenPorDefecto)}
                      onChange={e => setDraft({ ...draft, margenPorDefecto: fromPercent(Number(e.target.value)) })}
                      className="accent-[#1B4D3E] w-full cursor-pointer"
                    />

                    {openHelpKey === 'margenPorDefecto' && (
                      <div className="p-2.5 bg-white rounded-lg border border-[#82C69E]/50 text-xs text-gray-700 leading-relaxed font-sans">
                        {HELP_TEXTS.margenPorDefecto}
                      </div>
                    )}

                    <p className="text-[11px] font-mono text-[#2E7D32]">
                      {getImpactText(d => ({ ...d, margenPorDefecto: Math.min(0.90, d.margenPorDefecto * 1.10) }))}
                    </p>
                    {validationErrors.margenPorDefecto && (
                      <span className="text-[10px] text-red-600 font-bold">{validationErrors.margenPorDefecto}</span>
                    )}
                  </div>

                  {/* Tasa de Falla */}
                  <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-[#1B4D3E] uppercase font-mono">
                          Tasa de falla
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenHelpKey(openHelpKey === 'tasaFallaPorDefecto' ? null : 'tasaFallaPorDefecto')}
                          className="text-gray-400 hover:text-[#1B4D3E] p-0.5 cursor-pointer"
                          title="Ver explicación"
                        >
                          <Info size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          max="40"
                          step="1"
                          value={toPercent(draft.tasaFallaPorDefecto)}
                          onChange={e => setDraft({ ...draft, tasaFallaPorDefecto: fromPercent(Math.max(0, Math.min(40, Number(e.target.value) || 0))) })}
                          className="w-12 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                        />
                        <span className="text-xs text-[#2E7D32] font-bold">%</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="1"
                      value={toPercent(draft.tasaFallaPorDefecto)}
                      onChange={e => setDraft({ ...draft, tasaFallaPorDefecto: fromPercent(Number(e.target.value)) })}
                      className="accent-[#1B4D3E] w-full cursor-pointer"
                    />

                    {openHelpKey === 'tasaFallaPorDefecto' && (
                      <div className="p-2.5 bg-white rounded-lg border border-[#82C69E]/50 text-xs text-gray-700 leading-relaxed font-sans">
                        {HELP_TEXTS.tasaFallaPorDefecto}
                      </div>
                    )}

                    <p className="text-[11px] font-mono text-[#2E7D32]">
                      {getImpactText(d => ({ ...d, tasaFallaPorDefecto: Math.min(0.40, d.tasaFallaPorDefecto * 1.10) }))}
                    </p>
                    {validationErrors.tasaFallaPorDefecto && (
                      <span className="text-[10px] text-red-600 font-bold">{validationErrors.tasaFallaPorDefecto}</span>
                    )}
                  </div>

                </div>

                {/* Mínimos y Paso de Redondeo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* Mínimo por pieza */}
                  <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <label className="text-[11px] font-bold text-[#1B4D3E] uppercase font-mono">
                          Mínimo pieza
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenHelpKey(openHelpKey === 'minimoPorPieza' ? null : 'minimoPorPieza')}
                          className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                        >
                          <Info size={13} />
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={draft.minimoPorPieza}
                        onChange={e => setDraft({ ...draft, minimoPorPieza: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-right font-bold text-xs"
                      />
                    </div>
                    {openHelpKey === 'minimoPorPieza' && (
                      <div className="p-2 bg-white rounded border border-[#82C69E]/50 text-[11px]">
                        {HELP_TEXTS.minimoPorPieza}
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-[#2E7D32]">
                      {getImpactText(d => ({ ...d, minimoPorPieza: d.minimoPorPieza * 1.10 }))}
                    </p>
                  </div>

                  {/* Mínimo de Pedido */}
                  <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <label className="text-[11px] font-bold text-[#1B4D3E] uppercase font-mono">
                          Mínimo pedido
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenHelpKey(openHelpKey === 'minimoPedido' ? null : 'minimoPedido')}
                          className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                        >
                          <Info size={13} />
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={draft.minimoPedido}
                        onChange={e => setDraft({ ...draft, minimoPedido: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-right font-bold text-xs"
                      />
                    </div>
                    {openHelpKey === 'minimoPedido' && (
                      <div className="p-2 bg-white rounded border border-[#82C69E]/50 text-[11px]">
                        {HELP_TEXTS.minimoPedido}
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-[#2E7D32]">
                      {getImpactText(d => ({ ...d, minimoPedido: d.minimoPedido * 1.10 }))}
                    </p>
                  </div>

                  {/* Paso de Redondeo */}
                  <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <label className="text-[11px] font-bold text-[#1B4D3E] uppercase font-mono">
                          Redondeo
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenHelpKey(openHelpKey === 'pasoRedondeo' ? null : 'pasoRedondeo')}
                          className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                        >
                          <Info size={13} />
                        </button>
                      </div>
                      <select
                        value={draft.pasoRedondeo}
                        onChange={e => setDraft({ ...draft, pasoRedondeo: Number(e.target.value) })}
                        className="bg-white border border-gray-300 rounded px-1.5 py-0.5 font-bold text-xs text-[#1B4D3E]"
                      >
                        <option value={0.5}>$0.50 MXN</option>
                        <option value={1}>$1.00 MXN</option>
                        <option value={5}>$5.00 MXN</option>
                        <option value={10}>$10.00 MXN</option>
                      </select>
                    </div>
                    {openHelpKey === 'pasoRedondeo' && (
                      <div className="p-2 bg-white rounded border border-[#82C69E]/50 text-[11px]">
                        {HELP_TEXTS.pasoRedondeo}
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-gray-500">
                      Redondea hacia arriba cada partida.
                    </p>
                  </div>

                </div>

                {/* Urgencia e IVA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Recargo Urgencia */}
                  <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-[#1B4D3E] uppercase font-mono">
                          Recargo de urgencia
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenHelpKey(openHelpKey === 'recargoUrgencia' ? null : 'recargoUrgencia')}
                          className="text-gray-400 hover:text-[#1B4D3E] p-0.5 cursor-pointer"
                        >
                          <Info size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-gray-300 rounded px-2 py-0.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          value={toPercent(draft.recargoUrgencia)}
                          onChange={e => setDraft({ ...draft, recargoUrgencia: fromPercent(Math.max(0, Number(e.target.value) || 0)) })}
                          className="w-12 text-right font-bold text-xs"
                        />
                        <span className="text-xs text-[#2E7D32] font-bold">%</span>
                      </div>
                    </div>
                    {openHelpKey === 'recargoUrgencia' && (
                      <div className="p-2 bg-white rounded border border-[#82C69E]/50 text-xs">
                        {HELP_TEXTS.recargoUrgencia}
                      </div>
                    )}
                  </div>

                  {/* IVA Tasa y Switch */}
                  <div className="bg-[#F7F5F0]/60 p-4 rounded-xl border border-gray-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-[#1B4D3E] uppercase font-mono">
                          Tasa de IVA
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenHelpKey(openHelpKey === 'ivaTasa' ? null : 'ivaTasa')}
                          className="text-gray-400 hover:text-[#1B4D3E] p-0.5 cursor-pointer"
                        >
                          <Info size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-gray-300 rounded px-2 py-0.5">
                        <input
                          type="number"
                          min="0"
                          max="30"
                          step="1"
                          value={toPercent(draft.ivaTasa)}
                          onChange={e => setDraft({ ...draft, ivaTasa: fromPercent(Math.max(0, Number(e.target.value) || 0)) })}
                          className="w-12 text-right font-bold text-xs"
                        />
                        <span className="text-xs text-[#2E7D32] font-bold">%</span>
                      </div>
                    </div>
                    {openHelpKey === 'ivaTasa' && (
                      <div className="p-2 bg-white rounded border border-[#82C69E]/50 text-xs">
                        {HELP_TEXTS.ivaTasa}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* PESTAÑA 2: IMPRESORAS */}
            {activeTab === 'impresoras' && (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase font-mono text-[#1B4D3E]">
                    Catálogo de Impresoras del Taller
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingPrinter(true);
                      setEditingPrinter({
                        id: `imp-${Date.now()}`,
                        nombre: 'Nueva Impresora',
                        tecnologia: 'FDM',
                        potenciaPromedioW: 120,
                        precioCompra: 18000,
                        vidaUtilHoras: 4000,
                        mantenimientoPorHora: 2.50,
                        volumenMaxMm: { x: 256, y: 256, z: 256 }
                      });
                    }}
                    className="bg-[#1B4D3E] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-[#2E7D32] cursor-pointer"
                  >
                    <Plus size={14} /> + Agregar Impresora
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {draft.impresoras.map((imp) => {
                    const amort = imp.vidaUtilHoras > 0 ? imp.precioCompra / imp.vidaUtilHoras : 0;
                    const costoHoraCalculado = amort + imp.mantenimientoPorHora;
                    const isArchived = (imp as ImpresoraConEstado).archivado;

                    return (
                      <div 
                        key={imp.id} 
                        className={`p-4 rounded-xl border transition-all ${
                          isArchived 
                            ? 'bg-gray-100 border-gray-300 opacity-60' 
                            : 'bg-white border-[#82C69E]/60 shadow-xs'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-[#1B4D3E]">{imp.nombre}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F7F5F0] border border-gray-300 font-bold">
                                {imp.tecnologia}
                              </span>
                              {isArchived && (
                                <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono font-bold">
                                  Archivada
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-gray-500 mt-1">
                              Potencia: {imp.potenciaPromedioW} W · Volumen: {imp.volumenMaxMm.x}×{imp.volumenMaxMm.y}×{imp.volumenMaxMm.z} mm
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPrinter(imp as ImpresoraConEstado);
                                setIsCreatingPrinter(false);
                              }}
                              className="text-xs text-[#1B4D3E] hover:underline font-bold px-2 py-1 rounded bg-[#F7F5F0] cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraft({
                                  ...draft,
                                  impresoras: draft.impresoras.map(i => {
                                    if (i.id === imp.id) {
                                      return { ...i, archivado: !isArchived } as ImpresoraConfig;
                                    }
                                    return i;
                                  })
                                });
                              }}
                              className="text-xs text-gray-500 hover:text-gray-800 p-1 cursor-pointer"
                              title={isArchived ? "Reactivar impresora" : "Archivar impresora"}
                            >
                              {isArchived ? <RotateCw size={15} /> : <Archive size={15} />}
                            </button>
                          </div>
                        </div>

                        {/* Desglose de Costo de Máquina por Hora */}
                        <div className="mt-3 p-2.5 bg-[#F7F5F0] rounded-lg border border-gray-200 flex flex-col gap-1 text-xs">
                          <span className="font-mono text-[#1B4D3E] font-bold">
                            Costo de máquina por hora = precio ÷ vida útil + mantenimiento = {formatMXN(costoHoraCalculado)}/h
                          </span>
                          <span className="text-[10px] text-gray-600 font-mono">
                            (${imp.precioCompra} ÷ {imp.vidaUtilHoras} h = {formatMXN(amort)}/h) + mantenimiento {formatMXN(imp.mantenimientoPorHora)}/h
                          </span>
                          {imp.tarifaHoraManual !== undefined && imp.tarifaHoraManual >= 0 && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold mt-1">
                              ⚠ Tarifa manual activa: {formatMXN(imp.tarifaHoraManual)}/h (reemplaza el cálculo automático).
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sub-formulario Modal para Crear/Editar Impresora */}
                {editingPrinter && (
                  <div className="p-4 bg-white border-2 border-[#1B4D3E] rounded-xl shadow-lg flex flex-col gap-3 mt-2">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-bold text-xs uppercase font-mono text-[#1B4D3E]">
                        {isCreatingPrinter ? 'Nueva Impresora' : `Editar ${editingPrinter.nombre}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingPrinter(null)}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Nombre</label>
                        <input
                          type="text"
                          value={editingPrinter.nombre}
                          onChange={e => setEditingPrinter({ ...editingPrinter, nombre: e.target.value })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Tecnología</label>
                        <select
                          value={editingPrinter.tecnologia}
                          onChange={e => setEditingPrinter({ ...editingPrinter, tecnologia: e.target.value as TecnologiaImpresion })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        >
                          <option value="FDM">FDM</option>
                          <option value="MSLA">MSLA (Resina)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Potencia Promedio (W)</label>
                        <input
                          type="number"
                          min="1"
                          max="2000"
                          value={editingPrinter.potenciaPromedioW}
                          onChange={e => setEditingPrinter({ ...editingPrinter, potenciaPromedioW: Number(e.target.value) || 0 })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Precio de Compra ($ MXN)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingPrinter.precioCompra}
                          onChange={e => setEditingPrinter({ ...editingPrinter, precioCompra: Number(e.target.value) || 0 })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Vida Útil (Horas)</label>
                        <input
                          type="number"
                          min="100"
                          value={editingPrinter.vidaUtilHoras}
                          onChange={e => setEditingPrinter({ ...editingPrinter, vidaUtilHoras: Number(e.target.value) || 1 })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Mantenimiento por Hora ($ MXN)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editingPrinter.mantenimientoPorHora}
                          onChange={e => setEditingPrinter({ ...editingPrinter, mantenimientoPorHora: Number(e.target.value) || 0 })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Tarifa Manual Opcional ($/h - anula amortización)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Vacío para cálculo automático"
                          value={editingPrinter.tarifaHoraManual ?? ''}
                          onChange={e => setEditingPrinter({
                            ...editingPrinter,
                            tarifaHoraManual: e.target.value === '' ? undefined : Number(e.target.value)
                          })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setEditingPrinter(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCreatingPrinter) {
                            setDraft({ ...draft, impresoras: [...draft.impresoras, editingPrinter] });
                          } else {
                            setDraft({
                              ...draft,
                              impresoras: draft.impresoras.map(i => i.id === editingPrinter.id ? editingPrinter : i)
                            });
                          }
                          setEditingPrinter(null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1B4D3E] text-white hover:bg-[#2E7D32] cursor-pointer"
                      >
                        Guardar Impresora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA 3: MATERIALES */}
            {activeTab === 'materiales' && (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase font-mono text-[#1B4D3E]">
                    Catálogo de Materiales
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingMaterial(true);
                      setEditingMaterial({
                        id: `mat-${Date.now()}`,
                        nombre: 'Nuevo Filamento',
                        tecnologia: 'FDM',
                        costoPorUnidad: 500,
                        mermaPorcentaje: 0.05
                      });
                    }}
                    className="bg-[#1B4D3E] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-[#2E7D32] cursor-pointer"
                  >
                    <Plus size={14} /> + Agregar Material
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {draft.materiales.map((mat) => {
                    const isArchived = (mat as MaterialConEstado).archivado;
                    return (
                      <div
                        key={mat.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isArchived 
                            ? 'bg-gray-100 border-gray-300 opacity-60' 
                            : 'bg-white border-[#82C69E]/60 shadow-xs'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-[#1B4D3E]">{mat.nombre}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F7F5F0] border border-gray-300 font-bold">
                                {mat.tecnologia}
                              </span>
                              {isArchived && (
                                <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono font-bold">
                                  Archivado
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono text-gray-600 mt-1">
                              Costo: {formatMXN(mat.costoPorUnidad)} / {mat.tecnologia === 'FDM' ? 'kg' : 'L'} · Merma estimada: {toPercent(mat.mermaPorcentaje)}%
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMaterial(mat as MaterialConEstado);
                                setIsCreatingMaterial(false);
                              }}
                              className="text-xs text-[#1B4D3E] hover:underline font-bold px-2 py-1 rounded bg-[#F7F5F0] cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraft({
                                  ...draft,
                                  materiales: draft.materiales.map(m => {
                                    if (m.id === mat.id) {
                                      return { ...m, archivado: !isArchived } as MaterialConfig;
                                    }
                                    return m;
                                  })
                                });
                              }}
                              className="text-xs text-gray-500 hover:text-gray-800 p-1 cursor-pointer"
                              title={isArchived ? "Reactivar material" : "Archivar material"}
                            >
                              {isArchived ? <RotateCw size={15} /> : <Archive size={15} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sub-formulario Modal para Crear/Editar Material */}
                {editingMaterial && (
                  <div className="p-4 bg-white border-2 border-[#1B4D3E] rounded-xl shadow-lg flex flex-col gap-3 mt-2">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-bold text-xs uppercase font-mono text-[#1B4D3E]">
                        {isCreatingMaterial ? 'Nuevo Material' : `Editar ${editingMaterial.nombre}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingMaterial(null)}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Nombre</label>
                        <input
                          type="text"
                          value={editingMaterial.nombre}
                          onChange={e => setEditingMaterial({ ...editingMaterial, nombre: e.target.value })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Tecnología</label>
                        <select
                          value={editingMaterial.tecnologia}
                          onChange={e => setEditingMaterial({ ...editingMaterial, tecnologia: e.target.value as TecnologiaImpresion })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        >
                          <option value="FDM">FDM</option>
                          <option value="MSLA">MSLA (Resina)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">
                          Costo por Unidad ({editingMaterial.tecnologia === 'FDM' ? '$/kg' : '$/Litro'})
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editingMaterial.costoPorUnidad}
                          onChange={e => setEditingMaterial({ ...editingMaterial, costoPorUnidad: Number(e.target.value) || 0 })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-gray-600">Merma (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={toPercent(editingMaterial.mermaPorcentaje)}
                          onChange={e => setEditingMaterial({ ...editingMaterial, mermaPorcentaje: fromPercent(Number(e.target.value) || 0) })}
                          className="border border-gray-300 rounded p-1.5 font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setEditingMaterial(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCreatingMaterial) {
                            setDraft({ ...draft, materiales: [...draft.materiales, editingMaterial] });
                          } else {
                            setDraft({
                              ...draft,
                              materiales: draft.materiales.map(m => m.id === editingMaterial.id ? editingMaterial : m)
                            });
                          }
                          setEditingMaterial(null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1B4D3E] text-white hover:bg-[#2E7D32] cursor-pointer"
                      >
                        Guardar Material
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Columna Lateral: Pieza de Referencia y Comparativa (pasa abajo en celular) */}
          <div className="lg:col-span-4 order-last lg:order-none flex flex-col gap-4">
            
            {/* Tarjeta de Pieza de Referencia */}
            <div className="bg-[#F7F5F0] p-4 lg:p-5 rounded-2xl border border-[#82C69E] shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span className="font-extrabold text-xs uppercase font-mono text-[#1B4D3E] flex items-center gap-1.5">
                  <TrendingUp size={16} /> Pieza de Referencia
                </span>
                <span className="text-[10px] text-gray-500 font-mono">Editable</span>
              </div>

              {/* Selector de Impresora y Material para la pieza de prueba */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-gray-600">Impresora de prueba</label>
                  <select
                    value={refPrinterId}
                    onChange={e => setRefPrinterId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs font-bold"
                  >
                    {draft.impresoras.map(i => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.tecnologia})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-gray-600">Material de prueba</label>
                  <select
                    value={refMaterialId}
                    onChange={e => setRefMaterialId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs font-bold"
                  >
                    {draft.materiales.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre} ({m.tecnologia})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Inputs de Masa, Horas, Cantidad y Minutos */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-gray-600 font-bold block">Masa / Vol.</label>
                  <input
                    type="number"
                    min="1"
                    value={refPeso}
                    onChange={e => setRefPeso(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-white border border-gray-300 rounded p-1 text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 font-bold block">Horas (H)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={refHoras}
                    onChange={e => setRefHoras(Math.max(0.1, Number(e.target.value) || 0.1))}
                    className="w-full bg-white border border-gray-300 rounded p-1 text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 font-bold block">Prep. (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={refSetup}
                    onChange={e => setRefSetup(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-white border border-gray-300 rounded p-1 text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 font-bold block">Post. (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={refPost}
                    onChange={e => setRefPost(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-white border border-gray-300 rounded p-1 text-center font-bold"
                  />
                </div>
              </div>

              {/* Comparador Guardado vs Borrador */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col gap-2 shadow-xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-mono">Config. Guardada:</span>
                  <span className="font-mono font-bold text-gray-700">{formatMXN(precioGuardado)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#1B4D3E] font-bold font-mono">En Borrador:</span>
                  <span className="font-mono font-extrabold text-sm text-[#1B4D3E]">{formatMXN(precioBorrador)}</span>
                </div>
                
                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-[11px] font-mono text-gray-500">Diferencia:</span>
                  <span className={`font-mono text-xs font-black ${diffPesos > 0 ? 'text-[#2E7D32]' : diffPesos < 0 ? 'text-amber-700' : 'text-gray-600'}`}>
                    {diffPesos > 0 ? '+' : ''}{formatMXN(diffPesos)} ({diffPesos > 0 ? '+' : ''}{diffPorcentaje.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Comparativa Gráfica con Donas lado a lado: Guardado vs Borrador */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-[10px] uppercase font-mono font-extrabold text-[#1B4D3E] flex items-center gap-1.5">
                    <Percent size={13} className="text-[#2E7D32]" /> Desglose Comparativo
                  </span>
                  <span className="text-[9px] font-mono text-gray-400">Sin IVA</span>
                </div>

                <div className="grid grid-cols-2 gap-3 items-start">
                  {/* Dona Guardado */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono font-bold text-gray-600 uppercase">
                      Guardado
                    </span>
                    {desgloseGuardado ? (
                      <DonaDesglose 
                        desglose={desgloseGuardado}
                        total={precioGuardado}
                        totalConIva={precioGuardado}
                        mostrarIva={false}
                        tamaño={130}
                        compacto={true}
                      />
                    ) : (
                      <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                  </div>

                  {/* Dona Borrador */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono font-bold text-[#1B4D3E] uppercase">
                      Borrador
                    </span>
                    {desgloseBorrador ? (
                      <DonaDesglose 
                        desglose={desgloseBorrador}
                        total={precioBorrador}
                        totalConIva={precioBorrador}
                        mostrarIva={false}
                        tamaño={130}
                        compacto={true}
                      />
                    ) : (
                      <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Footer con Botones de Acción */}
        <footer className="p-4 lg:px-6 bg-[#F7F5F0] border-t border-gray-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfirmRestore(true)}
            className="text-xs text-red-700 hover:text-red-900 font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} /> Restaurar valores por defecto
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={hasErrors || isSaving}
              className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#1B4D3E] hover:bg-[#2E7D32] text-white transition-colors disabled:opacity-50 flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save size={15} /> {isSaving ? 'Guardando...' : 'Guardar Ajustes'}
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
export default AjustesCostos;
