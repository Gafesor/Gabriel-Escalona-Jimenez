/**
 * CubeUp³ — Tabla de Escalones de Cantidad (QuantityTiers)
 * 
 * Muestra el escalonamiento por volumen (1, 5, 10, 25, 50 piezas) para la pieza/línea en curso.
 * La reducción en precio unitario se calcula con precisión matemática mediante `calcularEscalones()`
 * reflejando la dilución real del costo de setup único y tiempo de preparación entre múltiples piezas,
 * eliminando descuentos ficticios o arbitrarios.
 */

import React, { useMemo } from 'react';
import { Layers, TrendingDown, Info, CheckCircle2 } from 'lucide-react';
import { LineaInput, PricingContext, calcularEscalones, EscalonResultado } from '../lib/pricing';

export interface QuantityTiersProps {
  linea: LineaInput;
  ctx: PricingContext;
  cantidades?: number[]; // Por defecto [1, 5, 10, 25, 50]
  cantidadActual?: number;
  onSelectTier?: (cantidad: number) => void;
}

export const QuantityTiers: React.FC<QuantityTiersProps> = ({
  linea,
  ctx,
  cantidades = [1, 5, 10, 25, 50],
  cantidadActual = 1,
  onSelectTier
}) => {
  const escalones: EscalonResultado[] = useMemo(() => {
    return calcularEscalones(linea, ctx, cantidades);
  }, [linea, ctx, cantidades]);

  const formatoMXN = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  return (
    <div className="bg-white border border-[#82C69E]/50 rounded-xl p-4 shadow-sm text-[#2B2B2B]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#82C69E]/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#F0FDF4] border border-[#82C69E] rounded-lg text-[#1B4D3E]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1B4D3E]">
              Escalones de Volumen (Tiered Pricing)
            </h3>
            <p className="text-[10px] text-gray-500">
              Ahorro real por dilución del costo de preparación (setup único de rebanado y calibración)
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono font-semibold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
          Fictiv Pattern
        </span>
      </div>

      {/* Grid de Escalones */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {escalones.map((tier) => {
          const esSeleccionado = tier.cantidad === cantidadActual;

          return (
            <div
              key={tier.cantidad}
              onClick={() => onSelectTier && onSelectTier(tier.cantidad)}
              className={`relative flex flex-col justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                esSeleccionado
                  ? 'bg-[#F0FDF4] border-[#1B4D3E] shadow-sm ring-1 ring-[#1B4D3E]'
                  : 'bg-[#F7F5F0]/50 border-gray-200 hover:border-[#82C69E] hover:bg-white'
              }`}
            >
              {/* Badge de Ahorro */}
              {tier.ahorroPorcentualRespectoAUnitaria > 0 ? (
                <div className="absolute -top-2 -right-1 bg-[#2E7D32] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs">
                  <TrendingDown className="w-2.5 h-2.5" />
                  <span>-{tier.ahorroPorcentualRespectoAUnitaria.toFixed(0)}%</span>
                </div>
              ) : (
                <div className="absolute -top-2 -right-1 bg-gray-400 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                  Base
                </div>
              )}

              {/* Cantidad */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-900">
                  {tier.cantidad} {tier.cantidad === 1 ? 'pieza' : 'piezas'}
                </span>
                {esSeleccionado && <CheckCircle2 className="w-3 h-3 text-[#1B4D3E]" />}
              </div>

              {/* Precio Unitario */}
              <div className="my-1">
                <span className="block text-[9px] uppercase font-mono text-gray-400">P. Unitario</span>
                <span className="text-sm font-extrabold text-[#1B4D3E] tracking-tight">
                  {formatoMXN(tier.precioUnitario)}
                </span>
              </div>

              {/* Total */}
              <div className="pt-1.5 border-t border-gray-100 mt-1 flex justify-between items-baseline">
                <span className="text-[9px] text-gray-400 font-mono">Total:</span>
                <span className="text-[11px] font-bold text-gray-700">
                  {formatoMXN(tier.precioTotal)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota Explicativa */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-start gap-1.5 text-[10px] text-gray-500">
        <Info className="w-3.5 h-3.5 text-[#2E7D32] shrink-0 mt-0.5" />
        <p className="leading-tight">
          El precio unitario disminuye conforme crece el lote porque el tiempo de preparación, inspección
          inicial y calibración se distribuyen entre más unidades, maximizando la eficiencia de taller.
        </p>
      </div>
    </div>
  );
};
