import React, { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DesgloseAgregadoTicket } from '../lib/ticket';
import { AlertCircle } from 'lucide-react';

export interface DonaDesgloseProps {
  desglose: DesgloseAgregadoTicket;
  total: number;
  totalConIva: number;
  mostrarIva?: boolean;
  tamaño?: number;
  compacto?: boolean;
  gananciaRedondeoMinimos?: number;
}

interface SegmentoDona {
  id: string;
  nombre: string;
  monto: number;
  color: string;
  porcentaje: number;
  esUtilidad?: boolean;
}

const formatMXN = (val: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
};

export function DonaDesglose({
  desglose,
  total,
  totalConIva,
  mostrarIva = false,
  tamaño = 200,
  compacto = false,
  gananciaRedondeoMinimos = 0
}: DonaDesgloseProps) {
  const shouldReduceMotion = useReducedMotion();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Determinar total activo de la base (con o sin IVA)
  const baseTotal = useMemo(() => {
    const val = mostrarIva ? totalConIva : total;
    return val > 0 ? val : 0;
  }, [mostrarIva, total, totalConIva]);

  // Construcción de segmentos respetando el orden canónico y colores de CubeUp³
  const { segmentosParaArco, leyendaCostosOrdenada, utilidadSegmento } = useMemo(() => {
    if (baseTotal <= 0) {
      return { segmentosParaArco: [], leyendaCostosOrdenada: [], utilidadSegmento: null };
    }

    // Orden canónico estricto de conceptos y colores definidos
    const itemsCanónicos: { id: string; nombre: string; monto: number; color: string; esUtilidad?: boolean }[] = [
      { id: 'material', nombre: 'Material', monto: Math.max(0, desglose.material), color: '#3E6E8E' },
      { id: 'energia', nombre: 'Energía', monto: Math.max(0, desglose.energia), color: '#E9B44C' },
      { id: 'maquina', nombre: 'Máquina', monto: Math.max(0, desglose.maquina), color: '#6C757D' },
      { id: 'consumibles', nombre: 'Consumibles', monto: Math.max(0, desglose.consumibles), color: '#9B7EBD' },
      { id: 'manoDeObra', nombre: 'Mano de obra', monto: Math.max(0, desglose.manoDeObra), color: '#D9734E' },
      { id: 'extras', nombre: 'Extras', monto: Math.max(0, desglose.extras), color: '#C9A66B' },
      { id: 'hardwareCosto', nombre: 'Hardware (costo)', monto: Math.max(0, desglose.hardwareCosto), color: '#7A9E9F' },
      { id: 'reservaFalla', nombre: 'Reserva por falla', monto: Math.max(0, desglose.reservaFalla), color: '#B85042' },
      { id: 'costoEnvio', nombre: 'Envío', monto: Math.max(0, desglose.costoEnvio), color: '#A3A3A3' },
      { id: 'recargoUrgencia', nombre: 'Recargo urgencia', monto: Math.max(0, desglose.recargoUrgenciaMonto), color: '#F28C28' },
      { id: 'utilidad', nombre: 'Utilidad', monto: Math.max(0, desglose.utilidad), color: '#2E7D32', esUtilidad: true }
    ];

    if (mostrarIva && desglose.ivaMonto > 0.001) {
      itemsCanónicos.push({ id: 'iva', nombre: 'IVA', monto: Math.max(0, desglose.ivaMonto), color: '#D4D4D4' });
    }

    // 1. Segmentos para el arco circular (en orden canónico estricto, solo aquellos con monto > 0)
    const arco: SegmentoDona[] = itemsCanónicos
      .filter(item => item.monto > 0.001)
      .map(item => ({
        id: item.id,
        nombre: item.nombre,
        monto: item.monto,
        color: item.color,
        porcentaje: (item.monto / baseTotal) * 100,
        esUtilidad: Boolean(item.esUtilidad)
      }));

    // 2. Leyenda: partidas de costos e impuestos ordenadas de mayor a menor monto
    const costosEImpuestos = arco
      .filter(seg => !seg.esUtilidad)
      .sort((a, b) => b.monto - a.monto);

    // 3. Partida de utilidad para separarla al final de la leyenda
    const utilSeg = arco.find(seg => seg.esUtilidad) || null;

    return {
      segmentosParaArco: arco,
      leyendaCostosOrdenada: costosEImpuestos,
      utilidadSegmento: utilSeg
    };
  }, [baseTotal, desglose, mostrarIva]);

  // Estado vacío cuando no hay partidas o el ticket es $0
  if (baseTotal <= 0 || segmentosParaArco.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-gray-400 gap-2 border border-dashed border-gray-200 rounded-2xl bg-[#F7F5F0]/50">
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
          <AlertCircle size={22} className="text-gray-400" />
        </div>
        <p className="text-xs font-mono font-bold text-gray-600 uppercase tracking-wider">
          Sin partidas para graficar
        </p>
        <p className="text-[11px] text-gray-400 max-w-[200px]">
          Agrega piezas al ticket para visualizar el desglose en dona.
        </p>
      </div>
    );
  }

  // Geometría del SVG del Donut
  const viewBoxSize = 200;
  const center = viewBoxSize / 2;
  const strokeWidth = compacto ? 22 : 26;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  // Segmento activo en hover o tap
  const activeSegment = hoveredId ? segmentosParaArco.find(s => s.id === hoveredId) : null;

  // Margen real global
  const margenRealPorcentaje = baseTotal > 0 ? (desglose.utilidad / baseTotal) * 100 : 0;
  const sinGanancia = desglose.utilidad <= 0.001;

  // Acumulador circular de desfase (stroke-dashoffset)
  let accumulatedOffset = 0;

  return (
    <motion.div 
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex flex-col gap-4 ${compacto ? 'p-1' : 'p-4 bg-white rounded-2xl border border-[#82C69E]/50 shadow-xs'}`}
    >
      {/* Contenedor Gráfico Circular con Centro */}
      <div className="flex flex-col items-center justify-center relative">
        <div 
          style={{ width: tamaño, height: tamaño }}
          className="relative flex items-center justify-center"
        >
          <svg 
            width={tamaño} 
            height={tamaño} 
            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
            className="transform -rotate-90 overflow-visible"
          >
            {/* Pista de fondo neutro */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={strokeWidth}
            />

            {/* Segmentos de la Dona */}
            {segmentosParaArco.map((seg) => {
              const segLength = (seg.porcentaje / 100) * circumference;
              const currentOffset = accumulatedOffset;
              accumulatedOffset += segLength;
              const isHovered = hoveredId === seg.id;

              return (
                <circle
                  key={seg.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${segLength} ${circumference - segLength}`}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="butt"
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setHoveredId(hoveredId === seg.id ? null : seg.id)}
                />
              );
            })}
          </svg>

          {/* Centro de la dona (Dinámico: cambia al interactuar o muestra total) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-2 text-center">
            {activeSegment ? (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500">
                  {activeSegment.nombre}
                </span>
                <span className="text-base lg:text-lg font-black text-[#1B4D3E] font-mono leading-tight">
                  {formatMXN(activeSegment.monto)}
                </span>
                <span 
                  className="text-[11px] font-bold font-mono px-1.5 py-0.2 rounded"
                  style={{ color: activeSegment.color }}
                >
                  {activeSegment.porcentaje.toFixed(1)}% del total
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400">
                  {mostrarIva ? 'Total c/IVA' : 'Total'}
                </span>
                <span className="text-base lg:text-lg font-black text-[#1B4D3E] font-mono leading-tight">
                  {formatMXN(baseTotal)}
                </span>
                {sinGanancia ? (
                  <span className="text-[11px] font-extrabold font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded mt-0.5">
                    Sin ganancia
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold font-mono text-[#2E7D32] bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                    margen real {margenRealPorcentaje.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leyenda Siempre Visible: Concepto, Monto y Porcentaje */}
      <div className="flex flex-col gap-1.5 w-full">
        {/* Costos e Impuestos ordenados de mayor a menor monto */}
        <div className="flex flex-col gap-1">
          {leyendaCostosOrdenada.map((item) => {
            const isHovered = hoveredId === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setHoveredId(hoveredId === item.id ? null : item.id)}
                className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  isHovered ? 'bg-[#82C69E]/20 font-bold' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <span className="text-gray-700">{item.nombre}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-900 font-bold">{formatMXN(item.monto)}</span>
                  <span className="text-gray-400 text-[11px] w-12 text-right">
                    {item.porcentaje.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Separador de Utilidad */}
        {utilidadSegmento && (
          <>
            <div className="border-t border-gray-200 my-0.5" />
            <div
              onMouseEnter={() => setHoveredId(utilidadSegmento.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setHoveredId(hoveredId === utilidadSegmento.id ? null : utilidadSegmento.id)}
              className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                hoveredId === utilidadSegmento.id ? 'bg-[#82C69E]/30 font-black' : 'bg-[#F0FDF4] font-bold hover:bg-[#82C69E]/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: utilidadSegmento.color }} 
                />
                <span className="text-[#1B4D3E]">Utilidad</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#2E7D32] font-black">{formatMXN(utilidadSegmento.monto)}</span>
                <span className="text-[#2E7D32] text-[11px] font-bold w-12 text-right">
                  {utilidadSegmento.porcentaje.toFixed(1)}%
                </span>
              </div>
            </div>
          </>
        )}

        {/* Nota si hay ganancia por redondeo o mínimos */}
        {gananciaRedondeoMinimos > 0.01 && (
          <p className="text-[10px] text-gray-500 font-mono italic px-2 pt-1 border-t border-gray-100">
            * Incluye {formatMXN(gananciaRedondeoMinimos)} por redondeo y mínimos
          </p>
        )}
      </div>
    </motion.div>
  );
}
export default DonaDesglose;
