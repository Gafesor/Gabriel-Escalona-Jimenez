import React, { useMemo, useState } from 'react';
import {
  FileText,
  RotateCcw,
  Minus,
  Plus,
  Settings,
  Trash2,
  Zap,
  Truck,
  Receipt,
  PieChart,
  Save,
  Share2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
  Bookmark,
  Check,
  X,
  Shield,
  Sparkles,
  Crown,
  Box,
  Hammer,
  Heart
} from 'lucide-react';
import { TicketItem } from '../hooks/useQuoteHistory';
import { TallerConfig, Preset, buildContext } from '../lib/tallerConfig';
import { ResultadoTicket } from '../lib/ticket';
import {
  margenToMarkup,
  calcularLinea,
  construirCascada,
  LineaInput,
  PricingContext,
  PasoCascada
} from '../lib/pricing';
import { DonaDesglose } from './DonaDesglose';
import { CascadaPrecio, MetricasRentabilidad } from './CascadaPrecio';

export interface TicketEnCursoProps {
  ticketItems: TicketItem[];
  config: TallerConfig;
  globalMargin: number;
  setGlobalMargin: (margin: number) => void;
  urgente: boolean;
  setUrgente: (val: boolean) => void;
  envio: number;
  setEnvio: (val: number) => void;
  cobrarIva: boolean;
  setCobrarIva: (val: boolean) => void;
  mostrarIvaEnDona: boolean;
  setMostrarIvaEnDona: (val: boolean) => void;
  isSavingDraft: boolean;
  savedQuoteId: string | null;
  savedQuotePricingVersion: number;
  ticketTotals: ResultadoTicket;
  onClearTicket: () => void;
  onUpdateItemQuantity: (id: string, newQty: number) => void;
  onEditItem: (item: TicketItem) => void;
  onRemoveItem: (id: string) => void;
  onSaveQuote: () => void;
  onGeneratePDF: () => void;
  onOpenWhatsApp: () => void;
  onSavePreset?: (preset: Preset) => void;
  onSaveConfig?: (config: TallerConfig) => void;
}

const formatMXN = (val: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
};

export const TicketEnCurso: React.FC<TicketEnCursoProps> = ({
  ticketItems,
  config,
  globalMargin,
  setGlobalMargin,
  urgente,
  setUrgente,
  envio,
  setEnvio,
  cobrarIva,
  setCobrarIva,
  mostrarIvaEnDona,
  setMostrarIvaEnDona,
  isSavingDraft,
  savedQuoteId,
  savedQuotePricingVersion,
  ticketTotals,
  onClearTicket,
  onUpdateItemQuantity,
  onEditItem,
  onRemoveItem,
  onSaveQuote,
  onGeneratePDF,
  onOpenWhatsApp,
  onSavePreset,
  onSaveConfig
}) => {
  // Estado para controlar qué partida tiene expandida su cascada individual
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Tab para alternar entre Cascada de Precio y Dona de Costos en el análisis global
  const [vistaAnalisis, setVistaAnalisis] = useState<'cascada' | 'dona'>('cascada');

  // Estados para el modal "Guardar como prestablecido" desde una partida del ticket
  const [itemParaPreset, setItemParaPreset] = useState<TicketItem | null>(null);
  const [presetNombre, setPresetNombre] = useState<string>('');
  const [presetIcono, setPresetIcono] = useState<string>('Box');
  const [presetGuardadoExitoso, setPresetGuardadoExitoso] = useState<boolean>(false);

  // Margen objetivo como fracción (0 a 0.90)
  const currentMarginFraction = Math.max(0, Math.min(0.9, globalMargin / 100));
  const markupMultiplier = currentMarginFraction < 1 ? 1 / (1 - currentMarginFraction) : 1;
  const markupPercent = Math.round(margenToMarkup(currentMarginFraction) * 100);

  // Detección de cotizaciones o partidas previas con motor antiguo
  const hasLegacyItems = useMemo(() => {
    return savedQuotePricingVersion !== 2 || ticketItems.some(i => i.itemType !== 'hardware' && !i.calc);
  }, [savedQuotePricingVersion, ticketItems]);

  const gananciaRedondeoMinimos = useMemo(() => {
    const diff =
      ticketTotals.total -
      ticketTotals.subtotal -
      ticketTotals.recargoUrgenciaMonto -
      ticketTotals.costoEnvio;
    return diff > 0.01 ? diff : 0;
  }, [ticketTotals]);

  // Cálculo individualizado de cascada y métricas por cada partida
  const lineasCalculadasMap = useMemo(() => {
    const mapa = new Map<
      string,
      {
        pasos: PasoCascada[];
        metricas: MetricasRentabilidad;
        causaBajoObjetivo: string | null;
        isUnderTarget: boolean;
      }
    >();

    for (const item of ticketItems) {
      if (item.itemType === 'hardware') {
        const costoUnit = Math.max(0, item.unitCost);
        const precioUnit = Math.max(0, item.unitPrice);
        const precioTotal = Math.max(0, item.totalPrice);
        const costoTotal = costoUnit * item.quantity;
        const utilidad = precioTotal - costoTotal;
        const margenRealizado = precioTotal > 0 ? utilidad / precioTotal : 0;
        const isUnderTarget = margenRealizado < currentMarginFraction - 0.05;

        let causa: string | null = null;
        if (isUnderTarget) {
          if (item.unitPrice < item.unitCost / (1 - currentMarginFraction)) {
            causa = 'Precio unitario fijado por debajo de la tasa de margen objetivo.';
          } else {
            causa = 'Ajuste de precio o redondeo comercial.';
          }
        }

        mapa.set(item.id, {
          pasos: [],
          metricas: {
            utilidad,
            margenRealizado,
            margenObjetivo: currentMarginFraction,
            utilidadPorHoraMaquina: null,
            utilidadPorHoraPersona: null,
            horasPersonaTotales: 0
          },
          causaBajoObjetivo: causa,
          isUnderTarget
        });
        continue;
      }

      // Manufactura 3D
      const material =
        (item.calc?.materialId
          ? config.materiales.find(m => m.id === item.calc?.materialId)
          : undefined) ||
        config.materiales.find(m => m.id === item.profileId) ||
        config.materiales.find(m => m.nombre === item.profileName) ||
        config.materiales[0];

      const impresora =
        (item.calc?.impresoraId
          ? config.impresoras.find(i => i.id === item.calc?.impresoraId)
          : undefined) ||
        config.impresoras.find(i => i.tecnologia === material.tecnologia) ||
        config.impresoras[0];

      const ctx: PricingContext = buildContext(config, impresora.id, material.id, {
        urgente,
        envio,
        cobrarIva,
        margen: currentMarginFraction
      });

      const lineaInput: LineaInput = {
        id: item.id,
        nombrePieza: item.itemName,
        tecnologia: material.tecnologia,
        cantidad: Math.max(1, Math.floor(item.quantity)),
        horasImpresion: Math.max(0, item.calc?.horasImpresion ?? item.timeInfo),
        pesoGramos:
          material.tecnologia === 'FDM'
            ? Math.max(0, item.calc?.pesoGramos ?? item.weightInfo)
            : undefined,
        volumenMl:
          material.tecnologia === 'MSLA'
            ? Math.max(0, item.calc?.volumenMl ?? item.weightInfo)
            : undefined,
        minutosModelado: Math.max(0, item.calc?.minutosModelado ?? 0),
        minutosAlistado: Math.max(0, item.calc?.minutosSetup ?? 0),
        minutosPostproceso: Math.max(0, item.calc?.minutosPostproceso ?? item.laborInfo ?? 0),
        extrasDirectos: Math.max(0, item.calc?.extrasDirectos ?? 0),
        margen: currentMarginFraction
      };

      const res = calcularLinea(lineaInput, ctx);
      const pasos = construirCascada(res, ctx);

      const isUnderTarget = res.margenRealizado < currentMarginFraction - 0.05;
      let causa: string | null = null;
      if (isUnderTarget) {
        if (res.precioTotal <= ctx.minimoPorPieza * res.cantidad) {
          causa = `Precio base ajustado por mínimo de pieza (${formatMXN(ctx.minimoPorPieza)}).`;
        } else {
          causa = 'Costos fijos y setup absorbidos por bajo volumen de piezas.';
        }
      }

      mapa.set(item.id, {
        pasos,
        metricas: {
          utilidad: res.utilidad,
          margenRealizado: res.margenRealizado,
          margenObjetivo: currentMarginFraction,
          utilidadPorHoraMaquina: res.utilidadPorHoraMaquina,
          utilidadPorHoraPersona: res.utilidadPorHoraPersona,
          horasPersonaTotales: res.horasPersonaTotales
        },
        causaBajoObjetivo: causa,
        isUnderTarget
      });
    }

    return mapa;
  }, [ticketItems, config, urgente, envio, cobrarIva, currentMarginFraction]);

  // Cascada agregada y métricas agregadas de toda la cotización
  const { cascadaGlobal, metricasGlobales } = useMemo(() => {
    const desg = ticketTotals.desgloseAgregado;
    const precioBaseTotal = ticketTotals.subtotal;
    const precioFinalTotal = cobrarIva ? ticketTotals.totalConIva : ticketTotals.total;

    let horasMaquinaGlobal = 0;
    let horasPersonaGlobal = 0;

    for (const item of ticketItems) {
      if (item.itemType !== 'hardware') {
        const horasImp = Math.max(0, item.calc?.horasImpresion ?? item.timeInfo);
        const minsAli = Math.max(0, item.calc?.minutosSetup ?? 0);
        const minsPost = Math.max(0, item.calc?.minutosPostproceso ?? item.laborInfo ?? 0);
        const cant = Math.max(1, Math.floor(item.quantity));
        horasMaquinaGlobal += horasImp;
        horasPersonaGlobal += (minsAli + minsPost * cant) / 60;
      }
    }

    const calcPct = (monto: number): number => {
      return precioBaseTotal > 0 ? (monto / precioBaseTotal) * 100 : 0;
    };

    let acc = 0;
    const pasos: PasoCascada[] = [];

    // Componentes directos agregados
    acc += desg.material;
    pasos.push({
      clave: 'material',
      etiqueta: 'Material',
      monto: desg.material,
      acumulado: acc,
      tipo: 'componente',
      porcentajeDelPrecio: calcPct(desg.material),
      ayuda: 'Filamento y resina consumidos en todas las piezas.'
    });

    acc += desg.energia;
    pasos.push({
      clave: 'energia',
      etiqueta: 'Energía impresión',
      monto: desg.energia,
      acumulado: acc,
      tipo: 'componente',
      porcentajeDelPrecio: calcPct(desg.energia),
      ayuda: 'Consumo eléctrico según potencia promedio de las máquinas.'
    });

    acc += desg.maquina;
    pasos.push({
      clave: 'maquina',
      etiqueta: 'Máquina',
      monto: desg.maquina,
      acumulado: acc,
      tipo: 'componente',
      porcentajeDelPrecio: calcPct(desg.maquina),
      ayuda: 'Amortización y mantenimiento preventivo por hora de uso.'
    });

    // Mano de obra global agregada
    acc += desg.manoDeObra;
    pasos.push({
      clave: 'labor_global',
      etiqueta: 'Mano de obra (Alistado + Post-procesado)',
      monto: desg.manoDeObra,
      acumulado: acc,
      tipo: 'componente',
      porcentajeDelPrecio: calcPct(desg.manoDeObra),
      ayuda: 'Horas de operador dedicadas a preparación y acabado.'
    });

    const extrasTotal = desg.extras + desg.hardwareCosto;
    if (extrasTotal > 0) {
      acc += extrasTotal;
      pasos.push({
        clave: 'extras',
        etiqueta: 'Extras y herrajes',
        monto: extrasTotal,
        acumulado: acc,
        tipo: 'componente',
        porcentajeDelPrecio: calcPct(extrasTotal),
        ayuda: 'Tornillería, insertos y componentes de ensamble.'
      });
    }

    pasos.push({
      clave: 'subtotal_tecnico',
      etiqueta: '= Subtotal técnico',
      monto: acc,
      acumulado: acc,
      tipo: 'subtotal',
      porcentajeDelPrecio: calcPct(acc),
      ayuda: 'Costo técnico directo antes de overhead y contingencia.'
    });

    // Overhead y contingencia de fallo
    const overheadGlobal = Math.max(0, desg.costoDirectoTotal - acc);
    if (overheadGlobal > 0) {
      acc += overheadGlobal;
      pasos.push({
        clave: 'overhead',
        etiqueta: '+ Overhead',
        monto: overheadGlobal,
        acumulado: acc,
        tipo: 'ajuste',
        porcentajeDelPrecio: calcPct(overheadGlobal),
        ayuda: 'Gastos fijos de taller por horas de máquina cotizadas.'
      });
    }

    if (desg.reservaFalla > 0) {
      acc += desg.reservaFalla;
      pasos.push({
        clave: 'base_con_fallos',
        etiqueta: '= Base con fallos',
        monto: acc,
        acumulado: acc,
        tipo: 'subtotal',
        porcentajeDelPrecio: calcPct(acc),
        ayuda: 'Costo total absorbido incluyendo factor de merma y fallas.'
      });
    }

    // Margen y subtotal de partidas
    const margenTotalMonto = Math.max(0, precioBaseTotal - desg.costoRealTotal);
    pasos.push({
      clave: 'margen',
      etiqueta: '+ Margen de utilidad',
      monto: margenTotalMonto,
      acumulado: precioBaseTotal,
      tipo: 'ajuste',
      porcentajeDelPrecio: calcPct(margenTotalMonto),
      ayuda: 'Utilidad neta prevista sobre la manufactura.'
    });

    pasos.push({
      clave: 'subtotal_partidas',
      etiqueta: 'Subtotal de partidas',
      monto: precioBaseTotal,
      acumulado: precioBaseTotal,
      tipo: 'subtotal',
      porcentajeDelPrecio: 100,
      ayuda: 'Importe de venta de partidas antes de recargos e impuestos.'
    });

    // Recargos de pedido
    if (ticketTotals.recargoUrgenciaMonto > 0) {
      pasos.push({
        clave: 'urgencia',
        etiqueta: `+ Recargo urgencia (${Math.round(config.recargoUrgencia * 100)}%)`,
        monto: ticketTotals.recargoUrgenciaMonto,
        acumulado: precioBaseTotal + ticketTotals.recargoUrgenciaMonto,
        tipo: 'ajuste',
        porcentajeDelPrecio: calcPct(ticketTotals.recargoUrgenciaMonto),
        ayuda: 'Prioridad de turno de producción.'
      });
    }

    if (ticketTotals.costoEnvio > 0) {
      pasos.push({
        clave: 'envio',
        etiqueta: '+ Envío / Mensajería',
        monto: ticketTotals.costoEnvio,
        acumulado: precioBaseTotal + ticketTotals.recargoUrgenciaMonto + ticketTotals.costoEnvio,
        tipo: 'ajuste',
        porcentajeDelPrecio: calcPct(ticketTotals.costoEnvio),
        ayuda: 'Flete y logística de entrega.'
      });
    }

    if (cobrarIva && ticketTotals.ivaMonto > 0) {
      pasos.push({
        clave: 'iva',
        etiqueta: `+ IVA (${Math.round(config.ivaTasa * 100)}%)`,
        monto: ticketTotals.ivaMonto,
        acumulado: precioFinalTotal,
        tipo: 'ajuste',
        porcentajeDelPrecio: calcPct(ticketTotals.ivaMonto),
        ayuda: 'Impuesto al Valor Agregado fiscal.'
      });
    }

    pasos.push({
      clave: 'total_general',
      etiqueta: 'Total cotización',
      monto: precioFinalTotal,
      acumulado: precioFinalTotal,
      tipo: 'total',
      porcentajeDelPrecio: precioBaseTotal > 0 ? (precioFinalTotal / precioBaseTotal) * 100 : 100,
      ayuda: 'Monto final pagadero por el cliente.'
    });

    const metricas: MetricasRentabilidad = {
      utilidad: ticketTotals.utilidadNeta,
      margenRealizado: ticketTotals.margenGlobalRealizado,
      margenObjetivo: currentMarginFraction,
      utilidadPorHoraMaquina:
        horasMaquinaGlobal > 0 ? ticketTotals.utilidadNeta / horasMaquinaGlobal : null,
      utilidadPorHoraPersona:
        horasPersonaGlobal > 0 ? ticketTotals.utilidadNeta / horasPersonaGlobal : null,
      horasPersonaTotales: horasPersonaGlobal
    };

    return { cascadaGlobal: pasos, metricasGlobales: metricas };
  }, [ticketTotals, config, cobrarIva, currentMarginFraction, ticketItems]);

  const toggleExpandItem = (id: string) => {
    setExpandedItemId(prev => (prev === id ? null : id));
  };

  // Apertura del modal para congelar partida como prestablecido
  const handleAbrirModalPreset = (item: TicketItem) => {
    setItemParaPreset(item);
    setPresetNombre(item.itemName);
    setPresetIcono('Box');
    setPresetGuardadoExitoso(false);
  };

  // Guardado efectivo del nuevo prestablecido
  const handleConfirmarGuardarPreset = () => {
    if (!itemParaPreset || !presetNombre.trim()) return;

    const matId = itemParaPreset.calc?.materialId || config.materiales[0]?.id || 'pla';
    const mat = config.materiales.find(m => m.id === matId) || config.materiales[0];
    const impId = itemParaPreset.calc?.impresoraId || config.impresoras[0]?.id || 'fdm-1';

    const merma =
      itemParaPreset.calc?.mermaPorcentaje !== undefined
        ? itemParaPreset.calc.mermaPorcentaje
        : (mat.mermaPorcentaje ?? 5);

    const tasaFalla =
      itemParaPreset.calc?.tasaFallaPorcentaje !== undefined
        ? itemParaPreset.calc.tasaFallaPorcentaje
        : (config.tasaFallaDefault ?? 5);

    const minsModelado = itemParaPreset.calc?.minutosModelado !== undefined ? itemParaPreset.calc.minutosModelado : 0;
    const minsAlistado = itemParaPreset.calc?.minutosSetup !== undefined ? itemParaPreset.calc.minutosSetup : 0;
    const minsPost = itemParaPreset.calc?.minutosPostproceso !== undefined
      ? itemParaPreset.calc.minutosPostproceso
      : (itemParaPreset.laborInfo ?? 0);
    const margenSug = itemParaPreset.calc?.margen !== undefined ? itemParaPreset.calc.margen : currentMarginFraction;

    const nuevoPreset: Preset = {
      id: `preset-${Date.now()}`,
      nombre: presetNombre.trim(),
      icono: presetIcono,
      materialId: matId,
      impresoraId: impId,
      mermaPorcentaje: merma,
      tasaFalla: tasaFalla,
      minutosModelado: minsModelado,
      minutosAlistado: minsAlistado,
      minutosPostproceso: minsPost,
      margenSugerido: margenSug,
      archivado: false,
      orden: config.presets.length
    };

    if (onSavePreset) {
      onSavePreset(nuevoPreset);
    } else if (onSaveConfig) {
      onSaveConfig({
        ...config,
        presets: [...config.presets, nuevoPreset]
      });
    }

    setPresetGuardadoExitoso(true);
    setTimeout(() => {
      setItemParaPreset(null);
      setPresetGuardadoExitoso(false);
    }, 900);
  };

  return (
    <div className="md:col-span-7 xl:col-span-8 flex flex-col bg-white border border-[#82C69E]/70 rounded-2xl shadow-sm overflow-hidden relative pb-4">
      {/* Header del Ticket */}
      <div className="bg-[#1B4D3E] text-white p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={16} />
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
              onClick={onClearTicket}
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

      {/* Panel Superior de Análisis: Cascada Agregada & Dona de Desglose */}
      {ticketItems.length > 0 && (
        <div className="p-4 lg:p-5 bg-[#F7F5F0]/60 border-b border-[#82C69E]/40">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1B4D3E]">
                Estructura de la Cotización
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                ({ticketItems.length} {ticketItems.length === 1 ? 'partida' : 'partidas'})
              </span>
            </div>

            {/* Alternador de vista: Cascada vs Dona */}
            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setVistaAnalisis('cascada')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  vistaAnalisis === 'cascada'
                    ? 'bg-[#1B4D3E] text-white shadow-xs'
                    : 'text-gray-600 hover:text-[#1B4D3E]'
                }`}
              >
                <Layers size={13} />
                <span>Cascada de Precio</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaAnalisis('dona')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  vistaAnalisis === 'dona'
                    ? 'bg-[#1B4D3E] text-white shadow-xs'
                    : 'text-gray-600 hover:text-[#1B4D3E]'
                }`}
              >
                <PieChart size={13} />
                <span>Distribución de Costo</span>
              </button>
            </div>
          </div>

          {vistaAnalisis === 'cascada' ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="text-[11px] font-mono text-gray-500 mb-2">
                Cascada agregada: cómo se construye el precio global paso a paso desde el costo técnico hasta el importe final.
              </div>
              <CascadaPrecio
                pasos={cascadaGlobal}
                rentabilidad={metricasGlobales}
                titulo="Cascada Agregada de Cotización"
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-gray-500">
                  Distribución analítica: en qué componentes directos se invierte el capital del taller.
                </span>
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
                tamaño={200}
                gananciaRedondeoMinimos={gananciaRedondeoMinimos}
              />
            </div>
          )}
        </div>
      )}

      {/* Lista de Partidas */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#F7F5F0]/40 min-h-[350px]">
        {ticketItems.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center opacity-40 gap-3 py-16 text-[#1B4D3E]">
            <FileText size={48} strokeWidth={1} />
            <span className="font-mono uppercase tracking-widest text-xs text-center leading-relaxed">
              El ticket está vacío.<br />Captura piezas o componentes a la izquierda.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ticketItems.map(item => {
              const calcInfo = lineasCalculadasMap.get(item.id);
              const isExpanded = expandedItemId === item.id;
              const isHardware = item.itemType === 'hardware';

              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#82C69E]/50 rounded-xl overflow-hidden shadow-xs hover:border-[#1B4D3E] transition-all"
                >
                  <div className="p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 relative">
                    <div
                      className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                        isHardware ? 'bg-[#2E7D32]' : 'bg-[#1B4D3E]'
                      }`}
                    />

                    {/* Datos de la pieza */}
                    <div className="flex flex-col pl-2 flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1B4D3E] text-sm sm:text-base">
                          {item.itemName}
                        </span>

                        {calcInfo?.isUnderTarget && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded"
                            title={calcInfo.causaBajoObjetivo ?? 'Margen por debajo del objetivo'}
                          >
                            <AlertTriangle size={11} className="text-amber-700" />
                            Margen {((calcInfo.metricas.margenRealizado ?? 0) * 100).toFixed(1)}% (Bajo)
                          </span>
                        )}

                        {!item.calc && !isHardware && (
                          <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold px-1.5 py-0.2 rounded">
                            Fórmula anterior
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-gray-500 uppercase mt-0.5">
                        {isHardware
                          ? 'Hardware Adicional / Componente de Ensamble'
                          : `${item.profileName} · ${item.weightInfo}g · ${item.timeInfo}h`}
                      </span>

                      {calcInfo?.isUnderTarget && calcInfo.causaBajoObjetivo && (
                        <span className="text-[10px] font-medium text-amber-800 mt-1 flex items-center gap-1">
                          ↳ {calcInfo.causaBajoObjetivo}
                        </span>
                      )}
                    </div>

                    {/* Control de Cantidad (Stepper en vivo) */}
                    <div className="flex items-center gap-1.5 bg-[#F7F5F0] px-2 py-1 rounded-lg border border-gray-200">
                      <span className="text-[10px] font-mono text-gray-500 uppercase font-semibold mr-1">
                        Piezas:
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateItemQuantity(item.id, (item.quantity || 1) - 1)}
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
                        onChange={e =>
                          onUpdateItemQuantity(item.id, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-12 text-center text-xs font-bold text-[#1B4D3E] bg-white border border-gray-300 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                      />

                      <button
                        type="button"
                        onClick={() => onUpdateItemQuantity(item.id, (item.quantity || 1) + 1)}
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

                      {/* Botón para expandir/colapsar cascada */}
                      <button
                        type="button"
                        onClick={() => toggleExpandItem(item.id)}
                        className={`p-1.5 rounded transition-colors cursor-pointer border ${
                          isExpanded
                            ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                            : 'bg-[#F7F5F0] text-gray-600 border-gray-200 hover:text-[#1B4D3E] hover:border-[#1B4D3E]'
                        }`}
                        title={isExpanded ? 'Ocultar cascada analítica' : 'Ver cascada analítica'}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>

                      {/* Botón Guardar como prestablecido (solo manufactura 3D) */}
                      {!isHardware && (
                        <button
                          type="button"
                          onClick={() => handleAbrirModalPreset(item)}
                          className="text-gray-400 hover:text-[#1B4D3E] p-1.5 hover:bg-[#82C69E]/20 rounded transition-colors cursor-pointer"
                          title="Guardar como prestablecido"
                        >
                          <Bookmark size={15} />
                        </button>
                      )}

                      <button
                        onClick={() => onEditItem(item)}
                        className="text-gray-400 hover:text-[#1B4D3E] p-1.5 hover:bg-[#F7F5F0] rounded transition-colors cursor-pointer"
                        title="Editar especificaciones"
                      >
                        <Settings size={15} />
                      </button>

                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="Eliminar partida"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Detalle colapsable de la Cascada individual de la partida */}
                  {isExpanded && (
                    <div className="p-4 bg-[#F7F5F0]/50 border-t border-gray-200">
                      {isHardware ? (
                        <CascadaPrecio
                          pasos={[]}
                          hardware={{
                            nombrePieza: item.itemName,
                            costoUnitario: item.unitCost,
                            margenObjetivo: currentMarginFraction,
                            margenRealizado: calcInfo?.metricas.margenRealizado ?? 0,
                            precioUnitario: item.unitPrice,
                            cantidad: item.quantity,
                            precioTotal: item.totalPrice,
                            utilidad: calcInfo?.metricas.utilidad ?? (item.totalPrice - item.unitCost * item.quantity),
                            motivoAjuste: calcInfo?.causaBajoObjetivo
                          }}
                          titulo={`Mini-Cascada Comercial: ${item.itemName}`}
                        />
                      ) : calcInfo ? (
                        <CascadaPrecio
                          pasos={calcInfo.pasos}
                          rentabilidad={calcInfo.metricas}
                          titulo={`Cascada Técnica: ${item.itemName}`}
                        />
                      ) : (
                        <div className="text-xs font-mono text-gray-500 py-2">
                          Partida sin desglose de capas (fórmula anterior).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal / Diálogo para Guardar como Prestablecido desde la partida */}
      {itemParaPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#82C69E] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del modal */}
            <div className="bg-[#1B4D3E] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark size={18} className="text-[#82C69E]" />
                <h3 className="font-bold text-sm">Guardar como Prestablecido</h3>
              </div>
              <button
                type="button"
                onClick={() => setItemParaPreset(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-5 flex flex-col gap-4 text-xs">
              <p className="text-gray-600">
                Congela los parámetros de manufactura de <strong className="text-[#1B4D3E]">{itemParaPreset.itemName}</strong> como un nuevo prestablecido rápido de 1 clic:
              </p>

              {/* Nombre del Preset */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-mono uppercase font-bold text-gray-600">
                  Nombre del prestablecido
                </label>
                <input
                  type="text"
                  value={presetNombre}
                  onChange={e => setPresetNombre(e.target.value)}
                  placeholder="Ej. Soporte reforzado PETG"
                  className="bg-[#F7F5F0] border border-gray-300 rounded-lg p-2.5 font-bold text-[#1B4D3E] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                  autoFocus
                />
              </div>

              {/* Selector de Icono */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase font-bold text-gray-600">
                  Ícono identificador
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: 'Box', IconComp: Box },
                    { id: 'Zap', IconComp: Zap },
                    { id: 'Shield', IconComp: Shield },
                    { id: 'Layers', IconComp: Layers },
                    { id: 'Sparkles', IconComp: Sparkles },
                    { id: 'Crown', IconComp: Crown },
                    { id: 'Hammer', IconComp: Hammer },
                    { id: 'Heart', IconComp: Heart }
                  ].map(ico => {
                    const isSelected = presetIcono === ico.id;
                    const Comp = ico.IconComp;
                    return (
                      <button
                        key={ico.id}
                        type="button"
                        onClick={() => setPresetIcono(ico.id)}
                        className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                            : 'bg-[#F7F5F0] text-gray-600 border-gray-300 hover:border-[#1B4D3E]'
                        }`}
                        title={ico.id}
                      >
                        <Comp size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resumen de Parámetros Congelados */}
              <div className="bg-[#F7F5F0] p-3 rounded-xl border border-gray-200 flex flex-col gap-1.5">
                <span className="text-[10px] font-mono uppercase font-bold text-gray-500">
                  Valores que se congelarán:
                </span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-gray-500">Material:</span>
                  <span className="font-bold text-right truncate text-gray-700">
                    {itemParaPreset.profileName}
                  </span>

                  <span className="text-gray-500">Merma estimada:</span>
                  <span className="font-bold text-right text-gray-700">
                    {itemParaPreset.calc?.mermaPorcentaje ?? 5}%
                  </span>

                  <span className="text-gray-500">Tasa de fallo:</span>
                  <span className="font-bold text-right text-gray-700">
                    {itemParaPreset.calc?.tasaFallaPorcentaje ?? config.tasaFallaDefault}%
                  </span>

                  <span className="text-gray-500">Diseño CAD:</span>
                  <span className="font-bold text-right text-gray-700">
                    {itemParaPreset.calc?.minutosModelado ?? 0} min
                  </span>

                  <span className="text-gray-500">Alistado:</span>
                  <span className="font-bold text-right text-gray-700">
                    {itemParaPreset.calc?.minutosSetup ?? 0} min
                  </span>

                  <span className="text-gray-500">Post-proceso:</span>
                  <span className="font-bold text-right text-gray-700">
                    {itemParaPreset.calc?.minutosPostproceso ?? itemParaPreset.laborInfo ?? 0} min
                  </span>

                  <span className="text-gray-500">Margen sugerido:</span>
                  <span className="font-bold text-right text-[#2E7D32]">
                    {Math.round((itemParaPreset.calc?.margen ?? currentMarginFraction) * 100)}%
                  </span>
                </div>
              </div>

              {/* Acciones del Modal */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setItemParaPreset(null)}
                  className="px-3 py-2 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarGuardarPreset}
                  disabled={!presetNombre.trim()}
                  className="px-4 py-2 rounded-lg bg-[#1B4D3E] text-white font-bold hover:bg-[#2E7D32] disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {presetGuardadoExitoso ? (
                    <>
                      <Check size={14} /> ¡Prestablecido guardado!
                    </>
                  ) : (
                    <>
                      <Bookmark size={14} /> Guardar prestablecido
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer del Ticket: Parámetros del Pedido, Totales y Acciones */}
      <div className="shrink-0 p-4 lg:p-6 bg-white border-t border-[#82C69E]/40 flex flex-col gap-4">
        {/* Parámetros del Ticket: Urgencia, Envío, IVA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#F7F5F0] rounded-xl border border-gray-200 text-xs">
          {/* Switch Urgente */}
          <label className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-[#1B4D3E] transition-colors">
            <div className="flex items-center gap-1.5 text-[#1B4D3E] font-bold">
              <Zap
                size={14}
                className={urgente ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}
              />
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
              <Truck size={14} className={envio > 0 ? 'text-[#2E7D32]' : 'text-gray-400'} />
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
              <Receipt size={14} className={cobrarIva ? 'text-[#2E7D32]' : 'text-gray-400'} />
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
                    onChange={e =>
                      setGlobalMargin(Math.max(0, Math.min(90, Number(e.target.value) || 0)))
                    }
                    className="w-10 text-center text-xs font-bold text-[#1B4D3E] focus:outline-none"
                  />
                  <span className="text-xs text-[#2E7D32] font-bold">%</span>
                </div>
              </div>
              <span className="text-[9px] font-mono text-gray-500 mt-0.5">
                equivale a markup {markupPercent}% (costo × {markupMultiplier.toFixed(2)})
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

        {/* Botones de acción */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={onSaveQuote}
            disabled={ticketItems.length === 0 || isSavingDraft}
            className="w-full bg-[#1B4D3E] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#2E7D32] transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Save size={15} /> {isSavingDraft ? 'Guardando...' : 'Guardar Cotización'}
          </button>

          <div className="p-3 bg-[#F7F5F0] rounded-xl border border-[#82C69E]/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#1B4D3E]">
              <Share2 size={14} className="text-[#2E7D32]" />
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider">
                Exportar & Compartir
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onGeneratePDF}
                disabled={ticketItems.length === 0}
                className="bg-white border border-[#1B4D3E] text-[#1B4D3E] py-1.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#F0FDF4] transition-colors disabled:opacity-40 cursor-pointer"
              >
                <FileText size={13} /> PDF
              </button>

              <button
                type="button"
                onClick={onOpenWhatsApp}
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
  );
};
