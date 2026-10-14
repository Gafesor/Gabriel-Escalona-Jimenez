import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Wifi, 
  Lightbulb, 
  Monitor, 
  FileSpreadsheet, 
  FolderPlus, 
  Clock, 
  Calculator, 
  AlertTriangle, 
  Info, 
  UserCheck, 
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { TallerConfig } from '../../lib/tallerConfig';

export interface DesgloseGastosFijos {
  renta: number;
  internet: number;
  luzLocal: number;
  software: number;
  contador: number;
  otrosFijos: number;
}

export interface PestanaGastosFijosProps {
  draft: TallerConfig;
  setDraft: React.Dispatch<React.SetStateAction<TallerConfig>>;
}

const STORAGE_KEY_DESGLOSE = 'cubeup3_gastos_fijos_desglose';

const DEFAULT_DESGLOSE: DesgloseGastosFijos = {
  renta: 2500,
  internet: 600,
  luzLocal: 400,
  software: 300,
  contador: 200,
  otrosFijos: 0
};

const formatMXN = (val: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
};

const TOOLTIPS: Record<string, string> = {
  renta: 'Renta proporcional del espacio; si la subes se incrementa el costo fijo por hora de impresión.',
  internet: 'Conexión para monitoreo y slicers; si la subes aumenta la cuota fija mensual prorrateada.',
  luzLocal: 'Iluminación ambiental y cómputo base; las impresoras se costean por separado en cada máquina.',
  software: 'Licencias CAD y cortadores; si subes el gasto se reparte más costo operativo en cada trabajo.',
  contador: 'Honorarios contables y administrativos; subirlo protege tu margen absorbiendo gestión fiscal.',
  otrosFijos: 'Agua, insumos de limpieza y varios; subirlo cubre imprevistos del taller.',
  horasProductivas: 'Horas reales imprimiendo al mes; si pones más horas baja la tasa, si pones menos sube.',
  tarifaOperador: 'Costo por hora de trabajo manual; subirla eleva el cobro de alistado y postproceso.',
  tarifaDiseno: 'Costo por hora de modelado 3D CAD; subirla incrementa la partida técnica de diseño.'
};

export function PestanaGastosFijos({ draft, setDraft }: PestanaGastosFijosProps) {
  const [openHelpKey, setOpenHelpKey] = useState<string | null>(null);

  // Inicialización del desglose desde localStorage o con valores por defecto congruentes con los $4,000 de overhead
  const [desglose, setDesglose] = useState<DesgloseGastosFijos>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DESGLOSE);
      if (saved) {
        const parsed = JSON.parse(saved) as DesgloseGastosFijos;
        if (
          typeof parsed.renta === 'number' &&
          typeof parsed.internet === 'number' &&
          typeof parsed.luzLocal === 'number' &&
          typeof parsed.software === 'number' &&
          typeof parsed.contador === 'number' &&
          typeof parsed.otrosFijos === 'number'
        ) {
          return parsed;
        }
      }
    } catch {
      // Si el almacenamiento local no está disponible, utilizar los valores predeterminados
    }

    // Si los costos fijos en draft difieren del total estándar de $4,000, ajustar proporcionalmente
    const baseTotal = draft.overhead.costosFijosMensuales;
    if (baseTotal > 0 && Math.abs(baseTotal - 4000) > 1) {
      return {
        renta: Math.round(baseTotal * 0.625),
        internet: Math.round(baseTotal * 0.15),
        luzLocal: Math.round(baseTotal * 0.10),
        software: Math.round(baseTotal * 0.075),
        contador: Math.round(baseTotal * 0.05),
        otrosFijos: 0
      };
    }

    return DEFAULT_DESGLOSE;
  });

  // Suma total calculada automáticamente a partir de los 6 renglones
  const totalFijos = useMemo(() => {
    return (
      Math.max(0, desglose.renta) +
      Math.max(0, desglose.internet) +
      Math.max(0, desglose.luzLocal) +
      Math.max(0, desglose.software) +
      Math.max(0, desglose.contador) +
      Math.max(0, desglose.otrosFijos)
    );
  }, [desglose]);

  // Sincronizar el total con el borrador de configuración del taller y persistir desglose
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DESGLOSE, JSON.stringify(desglose));
    } catch {
      // Ignorar fallas silenciosas de almacenamiento en modo restringido
    }

    if (Math.abs(draft.overhead.costosFijosMensuales - totalFijos) > 0.01) {
      setDraft(prev => ({
        ...prev,
        overhead: {
          ...prev.overhead,
          costosFijosMensuales: totalFijos
        }
      }));
    }
  }, [totalFijos, desglose, draft.overhead.costosFijosMensuales, setDraft]);

  const horasProductivas = Math.max(0, draft.overhead.horasProductivasMes);

  // Cálculo de la tasa de overhead por hora
  const tasaOverhead = useMemo(() => {
    if (horasProductivas <= 0) return 0;
    return totalFijos / horasProductivas;
  }, [totalFijos, horasProductivas]);

  // Impacto en pieza típica de 4 horas
  const impactoPieza4h = useMemo(() => {
    return tasaOverhead * 4;
  }, [tasaOverhead]);

  // Actualizador tipado por renglón
  const handleUpdateDesglose = (campo: keyof DesgloseGastosFijos, valor: number) => {
    const valNumerico = Math.max(0, valor);
    setDesglose(prev => ({
      ...prev,
      [campo]: valNumerico
    }));
  };

  const toggleHelp = (key: string) => {
    setOpenHelpKey(prev => (prev === key ? null : key));
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      
      {/* SECCIÓN 1: CAPTURA POR RENGLONES DE GASTOS FIJOS */}
      <div className="bg-[#F7F5F0] p-5 rounded-2xl border border-gray-200 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#1B4D3E]" />
            <h3 className="text-xs font-bold text-[#1B4D3E] uppercase tracking-wider font-mono">
              Gastos fijos mensuales del local
            </h3>
          </div>
          <span className="text-[11px] font-mono text-gray-500">
            Suma automática en vivo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Renta */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-500" />
                <label className="text-xs font-semibold text-gray-700">Renta del espacio</label>
                <button
                  type="button"
                  onClick={() => toggleHelp('renta')}
                  className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                  title="Ver explicación"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-400 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={desglose.renta}
                  onChange={e => handleUpdateDesglose('renta', Number(e.target.value) || 0)}
                  className="w-20 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 font-mono">/mes</span>
              </div>
            </div>
            {openHelpKey === 'renta' && (
              <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
                {TOOLTIPS.renta}
              </p>
            )}
          </div>

          {/* Internet */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Wifi size={14} className="text-gray-500" />
                <label className="text-xs font-semibold text-gray-700">Internet</label>
                <button
                  type="button"
                  onClick={() => toggleHelp('internet')}
                  className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                  title="Ver explicación"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-400 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="20"
                  value={desglose.internet}
                  onChange={e => handleUpdateDesglose('internet', Number(e.target.value) || 0)}
                  className="w-20 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 font-mono">/mes</span>
              </div>
            </div>
            {openHelpKey === 'internet' && (
              <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
                {TOOLTIPS.internet}
              </p>
            )}
          </div>

          {/* Luz del local */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Lightbulb size={14} className="text-gray-500" />
                <label className="text-xs font-semibold text-gray-700">Luz del local (sin equipo)</label>
                <button
                  type="button"
                  onClick={() => toggleHelp('luzLocal')}
                  className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                  title="Ver explicación"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-400 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="20"
                  value={desglose.luzLocal}
                  onChange={e => handleUpdateDesglose('luzLocal', Number(e.target.value) || 0)}
                  className="w-20 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 font-mono">/mes</span>
              </div>
            </div>
            {openHelpKey === 'luzLocal' && (
              <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
                {TOOLTIPS.luzLocal}
              </p>
            )}
          </div>

          {/* Software */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Monitor size={14} className="text-gray-500" />
                <label className="text-xs font-semibold text-gray-700">Software (CAD, slicer)</label>
                <button
                  type="button"
                  onClick={() => toggleHelp('software')}
                  className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                  title="Ver explicación"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-400 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="20"
                  value={desglose.software}
                  onChange={e => handleUpdateDesglose('software', Number(e.target.value) || 0)}
                  className="w-20 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 font-mono">/mes</span>
              </div>
            </div>
            {openHelpKey === 'software' && (
              <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
                {TOOLTIPS.software}
              </p>
            )}
          </div>

          {/* Contador / administración */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet size={14} className="text-gray-500" />
                <label className="text-xs font-semibold text-gray-700">Contador / administración</label>
                <button
                  type="button"
                  onClick={() => toggleHelp('contador')}
                  className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                  title="Ver explicación"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-400 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={desglose.contador}
                  onChange={e => handleUpdateDesglose('contador', Number(e.target.value) || 0)}
                  className="w-20 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 font-mono">/mes</span>
              </div>
            </div>
            {openHelpKey === 'contador' && (
              <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
                {TOOLTIPS.contador}
              </p>
            )}
          </div>

          {/* Otros fijos */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FolderPlus size={14} className="text-gray-500" />
                <label className="text-xs font-semibold text-gray-700">Otros fijos</label>
                <button
                  type="button"
                  onClick={() => toggleHelp('otrosFijos')}
                  className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                  title="Ver explicación"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-400 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="20"
                  value={desglose.otrosFijos}
                  onChange={e => handleUpdateDesglose('otrosFijos', Number(e.target.value) || 0)}
                  className="w-20 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 font-mono">/mes</span>
              </div>
            </div>
            {openHelpKey === 'otrosFijos' && (
              <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
                {TOOLTIPS.otrosFijos}
              </p>
            )}
          </div>
        </div>

        {/* Separador y suma automática */}
        <div className="pt-3 border-t border-gray-300 flex items-center justify-between px-1">
          <span className="text-xs font-bold text-gray-800 uppercase font-mono">
            Total gastos fijos
          </span>
          <span className="text-sm font-extrabold text-[#1B4D3E] font-mono">
            {formatMXN(totalFijos)} /mes
          </span>
        </div>

        {/* Horas productivas */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-[#1B4D3E]" />
              <label className="text-xs font-bold text-gray-800">Horas productivas al mes</label>
              <button
                type="button"
                onClick={() => toggleHelp('horasProductivas')}
                className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                title="Ver explicación"
              >
                <Info size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1">
              <input
                type="number"
                min="0"
                step="5"
                value={draft.overhead.horasProductivasMes}
                onChange={e => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setDraft(prev => ({
                    ...prev,
                    overhead: {
                      ...prev.overhead,
                      horasProductivasMes: val
                    }
                  }));
                }}
                className="w-16 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
              />
              <span className="text-xs text-gray-600 font-mono font-semibold">h</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 font-mono leading-tight">
            Horas de máquina REALES, no las horas que está encendida.
          </p>
          {openHelpKey === 'horasProductivas' && (
            <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
              {TOOLTIPS.horasProductivas}
            </p>
          )}
        </div>

        {/* Resultado destacado: Tasa de Overhead */}
        <div className="bg-[#1B4D3E] text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-lg">
              <Calculator size={20} className="text-[#82C69E]" />
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-gray-200">
                Tasa de overhead por hora
              </p>
              <p className="text-[10px] text-gray-300 font-mono">
                {formatMXN(totalFijos)} ÷ {horasProductivas} h
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[#82C69E]">
              {formatMXN(tasaOverhead)}
            </span>
            <span className="text-xs font-mono text-gray-200 ml-1">/hora</span>
          </div>
        </div>

        {/* Línea de impacto en vivo */}
        <div className="bg-[#82C69E]/20 border border-[#82C69E]/60 p-3 rounded-xl flex items-center gap-2 text-xs font-mono text-[#1B4D3E]">
          <Sparkles size={16} className="shrink-0 text-[#2E7D32]" />
          <span>
            Una pieza de 4 h carga <strong>{formatMXN(impactoPieza4h)}</strong> de gastos fijos.
          </span>
        </div>
      </div>

      {/* SECCIÓN 2: TARIFAS DE MANO DE OBRA */}
      <div className="bg-[#F7F5F0] p-5 rounded-2xl border border-gray-200 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <UserCheck size={18} className="text-[#1B4D3E]" />
          <h3 className="text-xs font-bold text-[#1B4D3E] uppercase tracking-wider font-mono">
            Tarifas de mano de obra
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tarifa de operador */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-[#1B4D3E]">Tarifa de operador</label>
                <button
                  type="button"
                  onClick={() => toggleHelp('tarifaOperador')}
                  className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                  title="Ver explicación"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1">
                <span className="text-xs text-gray-400 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={draft.tarifaOperadorHora}
                  onChange={e => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    setDraft(prev => ({
                      ...prev,
                      tarifaOperadorHora: val
                    }));
                  }}
                  className="w-16 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                />
                <span className="text-xs text-gray-600 font-mono font-semibold">/h</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-mono">
              (alistar, post-procesado)
            </p>
            {openHelpKey === 'tarifaOperador' && (
              <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
                {TOOLTIPS.tarifaOperador}
              </p>
            )}
          </div>

          {/* Tarifa de diseño */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-[#1B4D3E]">Tarifa de diseño</label>
                <button
                  type="button"
                  onClick={() => toggleHelp('tarifaDiseno')}
                  className="text-gray-400 hover:text-[#1B4D3E] cursor-pointer"
                  title="Ver explicación"
                >
                  <Info size={13} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1">
                <span className="text-xs text-gray-400 font-mono">$</span>
                <input
                  type="number"
                  min="0"
                  step="25"
                  value={draft.tarifaDisenoHora}
                  onChange={e => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    setDraft(prev => ({
                      ...prev,
                      tarifaDisenoHora: val
                    }));
                  }}
                  className="w-16 text-right font-bold text-xs text-[#1B4D3E] focus:outline-none"
                />
                <span className="text-xs text-gray-600 font-mono font-semibold">/h</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-mono">
              (modelado CAD)
            </p>
            {openHelpKey === 'tarifaDiseno' && (
              <p className="text-[11px] text-[#1B4D3E] bg-[#82C69E]/15 p-2 rounded-lg border border-[#82C69E]/40 font-mono">
                {TOOLTIPS.tarifaDiseno}
              </p>
            )}
          </div>
        </div>

        {/* Nota de negocio */}
        <p className="text-xs font-mono text-gray-600 bg-white p-3 rounded-xl border border-gray-200">
          El diseño se cobra aparte porque no vale lo mismo que quitar soportes.
        </p>
      </div>

      {/* SECCIÓN 3: ADVERTENCIAS EN VIVO Y NOTA PREVENTIVA FIJA */}
      <div className="flex flex-col gap-2.5">
        {/* Advertencia: Horas productivas = 0 */}
        {horasProductivas === 0 && (
          <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Sin horas productivas el overhead no se puede repartir.</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Ingresa cuántas horas de impresión efectiva esperas producir al mes para calcular la cuota horaria.
              </p>
            </div>
          </div>
        )}

        {/* Advertencia: Tasa overhead > Tarifa de operador */}
        {horasProductivas > 0 && tasaOverhead > draft.tarifaOperadorHora && (
          <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Tus gastos fijos por hora superan lo que cobras por hora de trabajo. Revisa las horas productivas.
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Overhead: {formatMXN(tasaOverhead)}/h vs. Operador: {formatMXN(draft.tarifaOperadorHora)}/h.
              </p>
            </div>
          </div>
        )}

        {/* Nota preventiva fija */}
        <div className="bg-[#2B2B2B]/5 border border-gray-200 p-3 rounded-xl flex items-center gap-2 text-xs text-gray-700">
          <ShieldAlert size={15} className="text-[#1B4D3E] shrink-0" />
          <p className="text-[11px] font-mono leading-tight">
            No incluyas aquí boquillas, FEP ni refacciones: ya se cobran en cada impresora.
          </p>
        </div>
      </div>

    </div>
  );
}
