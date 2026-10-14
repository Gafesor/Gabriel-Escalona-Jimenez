import React, { useState, useMemo } from 'react';
import { 
  X, 
  Info, 
  RotateCcw, 
  Save, 
  AlertTriangle, 
  Printer, 
  Layers, 
  Sliders, 
  Zap,
  Building2,
  Sparkles
} from 'lucide-react';
import { 
  TallerConfig, 
  DEFAULT_TALLER_CONFIG, 
  buildContext, 
  sanitizeConfig 
} from '../lib/tallerConfig';
import { 
  calcularLinea, 
  LineaInput 
} from '../lib/pricing';
import { PestanaGastosFijos } from './costos/PestanaGastosFijos';
import { PestanaPresets } from './costos/PestanaPresets';
import { PestanaImpresoras } from './costos/PestanaImpresoras';
import { PestanaMateriales } from './costos/PestanaMateriales';
import { PanelPiezaReferencia } from './costos/PanelPiezaReferencia';

export type TabKey = 'taller' | 'gastosFijos' | 'impresoras' | 'materiales' | 'presets';

export interface AjustesCostosProps {
  isOpen: boolean;
  onClose: () => void;
  config: TallerConfig;
  onSaveConfig: (newConfig: TallerConfig) => Promise<void>;
  onRestoreDefaults: () => Promise<void>;
  initialTab?: TabKey;
}

const formatMXN = (val: number): string => {
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
  margenPorDefecto: 'qué parte del PRECIO es ganancia. Margen de 45% → precio = costo ÷ 0.55 = costo × 1.82. No es lo mismo que sumar 45% al costo (eso deja solo 31% de margen).',
  tasaFallaPorDefecto: 'de cada 100 impresiones, cuántas salen mal. El costo se divide entre (1 − falla): con 10% cobras 11.1% más, porque las piezas buenas pagan las fallidas.',
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
  onRestoreDefaults,
  initialTab
}: AjustesCostosProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('taller');
  const [draft, setDraft] = useState<TallerConfig>(() => JSON.parse(JSON.stringify(config)));
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [openHelpKey, setOpenHelpKey] = useState<string | null>(null);

  // Pieza de referencia editable para pruebas de impacto
  const [refPeso, setRefPeso] = useState<number>(80);
  const [refHoras, setRefHoras] = useState<number>(4);
  const [refSetup, setRefSetup] = useState<number>(15);
  const [refPost, setRefPost] = useState<number>(5);
  const [refPrinterId, setRefPrinterId] = useState<string>(() => {
    const fdm = config.impresoras.find(i => i.tecnologia === 'FDM');
    return fdm ? fdm.id : (config.impresoras.length > 0 ? config.impresoras[0].id : '');
  });
  const [refMaterialId, setRefMaterialId] = useState<string>(() => {
    const fdmMat = config.materiales.find(m => m.tecnologia === 'FDM');
    return fdmMat ? fdmMat.id : (config.materiales.length > 0 ? config.materiales[0].id : '');
  });

  // Sincronizar borrador y pestaña inicial cuando se abre el modal
  React.useEffect(() => {
    if (isOpen) {
      setDraft(JSON.parse(JSON.stringify(config)));
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setShowConfirmRestore(false);
      setOpenHelpKey(null);
    }
  }, [isOpen, config, initialTab]);

  // Función genérica para calcular el impacto en vivo de mover cualquier variable 10%
  const getImpactText = (modifier: (d: TallerConfig) => TallerConfig): string => {
    try {
      const pId = refPrinterId || (draft.impresoras.length > 0 ? draft.impresoras[0].id : '');
      const mId = refMaterialId || (draft.materiales.length > 0 ? draft.materiales[0].id : '');
      if (!pId || !mId) return 'Impacto no disponible.';

      const refLineaInput: LineaInput = {
        id: 'ref-piece',
        nombrePieza: 'Pieza de Referencia',
        tecnologia: 'FDM',
        cantidad: 1,
        horasImpresion: Math.max(0.1, refHoras),
        pesoGramos: Math.max(1, refPeso),
        minutosSetup: Math.max(0, refSetup),
        minutosPostproceso: Math.max(0, refPost),
        extrasDirectos: 0,
        margen: draft.margenPorDefecto
      };

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
    if (draft.tarifaDisenoHora < 0) errors.tarifaDisenoHora = 'La tarifa de diseño no puede ser negativa.';
    if (draft.overhead.costosFijosMensuales < 0) errors.costosFijos = 'Los costos fijos no pueden ser negativos.';
    if (draft.overhead.horasProductivasMes < 0) errors.horasProductivas = 'Las horas productivas no pueden ser negativas.';
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

  const presetsCount = draft.presets ? draft.presets.length : 0;

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

        {/* Barra de Pestañas con Prestablecidos */}
        <div className="bg-[#F7F5F0] border-b border-gray-200 px-4 lg:px-6 py-2 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('taller')}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'taller'
                ? 'bg-[#1B4D3E] text-white shadow-xs'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <Zap size={14} /> Taller (Globales)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'presets'
                ? 'bg-[#1B4D3E] text-white shadow-xs'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <Sparkles size={14} /> Prestablecidos ({presetsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gastosFijos')}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'gastosFijos'
                ? 'bg-[#1B4D3E] text-white shadow-xs'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <Building2 size={14} /> Gastos fijos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('impresoras')}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
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
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
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
          
          {/* Columna Principal: Pestañas */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Banner de confirmación para restaurar defaults */}
            {showConfirmRestore && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2.5 text-amber-900">
                  <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">¿Restaurar todos los valores por defecto de fábrica?</p>
                    <p className="mt-0.5 text-amber-800">
                      Esto reemplazará tus tarifas eléctricas, costo de operador, márgenes, impresoras, materiales y prestablecidos con los valores canónicos oficiales.
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

            {/* PESTAÑA: TALLER (GLOBALES) */}
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

                {/* Enlace rápido a Gastos Fijos y Mano de Obra */}
                <div className="bg-[#1B4D3E]/5 border border-[#1B4D3E]/15 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-[#1B4D3E] shrink-0" />
                    <span className="text-xs font-semibold text-gray-800">
                      Gastos fijos y tarifas de mano de obra (operador y diseño CAD)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('gastosFijos')}
                    className="text-xs font-bold font-mono text-[#1B4D3E] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    Configurar en pestaña Gastos fijos →
                  </button>
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

                  {/* IVA Tasa */}
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

            {/* PESTAÑA: PRESTABLECIDOS */}
            {activeTab === 'presets' && (
              <PestanaPresets draft={draft} setDraft={setDraft} />
            )}

            {/* PESTAÑA: GASTOS FIJOS Y MANO DE OBRA */}
            {activeTab === 'gastosFijos' && (
              <PestanaGastosFijos draft={draft} setDraft={setDraft} />
            )}

            {/* PESTAÑA: IMPRESORAS */}
            {activeTab === 'impresoras' && (
              <PestanaImpresoras draft={draft} setDraft={setDraft} />
            )}

            {/* PESTAÑA: MATERIALES */}
            {activeTab === 'materiales' && (
              <PestanaMateriales draft={draft} setDraft={setDraft} />
            )}

          </div>

          {/* Columna Lateral: Pieza de Referencia y Comparativa (pasa abajo en celular) */}
          <div className="lg:col-span-4 order-last lg:order-none flex flex-col gap-4">
            <PanelPiezaReferencia 
              draft={draft}
              config={config}
              refPrinterId={refPrinterId}
              setRefPrinterId={setRefPrinterId}
              refMaterialId={refMaterialId}
              setRefMaterialId={setRefMaterialId}
              refPeso={refPeso}
              setRefPeso={setRefPeso}
              refHoras={refHoras}
              setRefHoras={setRefHoras}
              refSetup={refSetup}
              setRefSetup={setRefSetup}
              refPost={refPost}
              setRefPost={setRefPost}
            />
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
