import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, AlertTriangle, Cpu, Wrench } from 'lucide-react';
import { PasoCascada, margenToMarkup } from '../lib/pricing';

export interface MetricasRentabilidad {
  utilidad: number;
  margenRealizado: number;
  margenObjetivo: number;
  utilidadPorHoraMaquina: number | null;
  utilidadPorHoraPersona: number | null;
  horasPersonaTotales: number;
  advertenciaMargen?: string | null;
}

export interface CascadaHardwareInfo {
  nombrePieza: string;
  costoUnitario: number;
  margenObjetivo: number;
  margenRealizado: number;
  precioUnitario: number;
  cantidad: number;
  precioTotal: number;
  utilidad: number;
  motivoAjuste?: string | null;
}

export interface CascadaPrecioProps {
  pasos?: PasoCascada[];
  rentabilidad?: MetricasRentabilidad;
  hardware?: CascadaHardwareInfo;
  titulo?: string;
  subtitulo?: string;
  compacto?: boolean;
}

const formatearMoneda = (val: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

const formatearPorcentaje = (val: number): string => {
  return `${(val * 100).toFixed(1)}%`;
};

/**
 * Tooltip accesible y compacto de una sola línea
 */
const TooltipAyuda: React.FC<{ texto: string }> = ({ texto }) => {
  return (
    <span className="relative group inline-flex items-center ml-1 align-middle">
      <HelpCircle className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#1B4D3E] transition-colors cursor-help" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block z-30 whitespace-nowrap rounded bg-[#2B2B2B] px-2.5 py-1 text-xs text-white shadow-lg">
        {texto}
        <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-[#2B2B2B]" />
      </span>
    </span>
  );
};

export const CascadaPrecio: React.FC<CascadaPrecioProps> = ({
  pasos,
  rentabilidad,
  hardware,
  titulo,
  subtitulo,
  compacto = false
}) => {
  // Manejo de agrupación de mano de obra
  const pasoModelado = pasos?.find((p) => p.clave === 'labor_modelado');
  const pasoAlistado = pasos?.find((p) => p.clave === 'labor_alistado');
  const pasoPost = pasos?.find((p) => p.clave === 'labor_post');

  // Si alguna de las 3 labores está en 0, iniciamos expandido para señalar qué falta capturar
  const algunaLaborEnCero =
    (pasoModelado !== undefined && pasoModelado.monto <= 0) ||
    (pasoAlistado !== undefined && pasoAlistado.monto <= 0) ||
    (pasoPost !== undefined && pasoPost.monto <= 0);

  const [laborExpandida, setLaborExpandida] = useState<boolean>(algunaLaborEnCero);

  // Mini-cascada para partidas de Hardware
  if (hardware !== undefined) {
    const markupObjetivoPct = (margenToMarkup(hardware.margenObjetivo) * 100).toFixed(1);
    const bajoMargen = hardware.margenRealizado < hardware.margenObjetivo - 0.05;
    const esCritico = hardware.margenRealizado < 0.15;

    return (
      <div className={`space-y-4 rounded-xl border border-stone-200 bg-white ${compacto ? 'p-3 text-sm' : 'p-5 shadow-sm'}`}>
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#1B4D3E]" />
            <h4 className="font-semibold text-[#1B4D3E]">
              {titulo !== undefined ? titulo : `Cascada de Hardware: ${hardware.nombrePieza}`}
            </h4>
          </div>
          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium">
            Partida comercial (sin impresión 3D)
          </span>
        </div>

        {/* Panel de rentabilidad de hardware */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F7F5F0] p-3 rounded-lg border border-stone-200">
          <div>
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider block">Utilidad total</span>
            <span className="text-xl font-bold text-[#1B4D3E] font-mono">{formatearMoneda(hardware.utilidad)}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider block">Margen real</span>
              <span className="text-xs text-stone-500">(obj. {formatearPorcentaje(hardware.margenObjetivo)})</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-lg font-bold font-mono px-1.5 py-0.5 rounded ${
                  esCritico
                    ? 'text-rose-700 bg-rose-100 border border-rose-300'
                    : bajoMargen
                    ? 'text-amber-800 bg-amber-100 border border-amber-300'
                    : 'text-[#2E7D3E]'
                }`}
              >
                {formatearPorcentaje(hardware.margenRealizado)}
              </span>
              <span className="text-xs text-stone-500">markup {markupObjetivoPct}%</span>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider block">Lote ({hardware.cantidad} pzs)</span>
            <span className="text-lg font-bold text-[#2B2B2B] font-mono">{formatearMoneda(hardware.precioTotal)}</span>
          </div>
        </div>

        {bajoMargen && (
          <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Margen bajo objetivo:</strong>{' '}
              {hardware.motivoAjuste !== null && hardware.motivoAjuste !== undefined
                ? hardware.motivoAjuste
                : 'El margen realizado difiere del objetivo configurado por precio mínimo o redondeo.'}
            </span>
          </div>
        )}

        {/* Pasos simplificados */}
        <div className="space-y-1 font-mono text-sm">
          <div className="flex justify-between items-center py-1.5 px-2 text-[#2B2B2B]">
            <span className="font-sans">Costo unitario de adquisición</span>
            <span>{formatearMoneda(hardware.costoUnitario)}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 px-2 text-[#2E7D32]">
            <span className="font-sans flex items-center">
              + Margen comercial aplicado ({formatearPorcentaje(hardware.margenRealizado)})
              <TooltipAyuda texto="Sobreprecio comercial sobre el costo base de adquisición" />
            </span>
            <span className="font-semibold">
              +{formatearMoneda(Math.max(0, hardware.precioUnitario - hardware.costoUnitario))}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 px-2.5 bg-[#F7F5F0] border-t border-stone-200 text-[#1B4D3E] font-bold">
            <span className="font-sans">Precio unitario base</span>
            <span>{formatearMoneda(hardware.precioUnitario)}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 px-3 bg-[#1B4D3E] text-white rounded-lg font-bold text-base mt-2">
            <span className="font-sans">Total partida ({hardware.cantidad} pzs)</span>
            <span>{formatearMoneda(hardware.precioTotal)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (pasos === undefined || pasos.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 text-stone-500 text-center text-sm">
        No hay datos de cascada disponibles para esta partida.
      </div>
    );
  }

  // Rentabilidad
  const bajoMargenObj =
    rentabilidad !== undefined &&
    rentabilidad.margenRealizado < rentabilidad.margenObjetivo - 0.05;
  const esMargenCritico =
    rentabilidad !== undefined && rentabilidad.margenRealizado < 0.15;
  const markupObjetivoPct =
    rentabilidad !== undefined
      ? (margenToMarkup(rentabilidad.margenObjetivo) * 100).toFixed(1)
      : '0.0';

  // Suma agrupada de mano de obra
  const montoLaborTotal =
    (pasoModelado !== undefined ? pasoModelado.monto : 0) +
    (pasoAlistado !== undefined ? pasoAlistado.monto : 0) +
    (pasoPost !== undefined ? pasoPost.monto : 0);
  const pctLaborTotal =
    (pasoModelado !== undefined ? pasoModelado.porcentajeDelPrecio : 0) +
    (pasoAlistado !== undefined ? pasoAlistado.porcentajeDelPrecio : 0) +
    (pasoPost !== undefined ? pasoPost.porcentajeDelPrecio : 0);

  return (
    <div className={`space-y-4 rounded-xl border border-stone-200 bg-white ${compacto ? 'p-3 text-sm' : 'p-5 shadow-sm'}`}>
      {/* Encabezado */}
      {(titulo !== undefined || subtitulo !== undefined) && (
        <div className="border-b border-stone-100 pb-2">
          {titulo !== undefined && <h4 className="font-semibold text-[#1B4D3E] text-base">{titulo}</h4>}
          {subtitulo !== undefined && <p className="text-xs text-stone-500 mt-0.5">{subtitulo}</p>}
        </div>
      )}

      {/* 2. PANEL DE RENTABILIDAD SUPERIOR */}
      {rentabilidad !== undefined && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F7F5F0] p-3.5 rounded-xl border border-stone-200">
            {/* 1. Utilidad - el más grande */}
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                Utilidad
              </span>
              <span className="text-2xl font-black text-[#1B4D3E] font-mono tracking-tight">
                {formatearMoneda(rentabilidad.utilidad)}
              </span>
            </div>

            {/* 2. Margen real con objetivo y markup */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Margen Real
                </span>
                <span className="text-xs text-stone-500">
                  (obj. {formatearPorcentaje(rentabilidad.margenObjetivo)})
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span
                  className={`text-xl font-bold font-mono px-2 py-0.5 rounded ${
                    esMargenCritico
                      ? 'text-rose-700 bg-rose-100 border border-rose-300'
                      : bajoMargenObj
                      ? 'text-amber-800 bg-amber-100 border border-amber-300'
                      : 'text-[#2E7D32] bg-emerald-50 border border-emerald-200'
                  }`}
                >
                  {formatearPorcentaje(rentabilidad.margenRealizado)}
                </span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1">
                Margen {formatearPorcentaje(rentabilidad.margenObjetivo)} · equiv. a markup {markupObjetivoPct}%
              </span>
            </div>

            {/* 3. Por hora de máquina */}
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-stone-400" />
                Por hora máquina
              </span>
              <span className="text-xl font-bold text-[#2B2B2B] font-mono">
                {rentabilidad.utilidadPorHoraMaquina !== null
                  ? `${formatearMoneda(rentabilidad.utilidadPorHoraMaquina)}/h`
                  : 'N/A'}
              </span>
              <span className="text-[11px] text-stone-500 mt-1">
                {rentabilidad.utilidadPorHoraPersona !== null
                  ? `${formatearMoneda(rentabilidad.utilidadPorHoraPersona)}/h de tu tiempo`
                  : 'N/A'}{' '}
                · {rentabilidad.horasPersonaTotales.toFixed(2)} h persona
              </span>
            </div>
          </div>

          {/* 4. Línea bajo objetivo */}
          {bajoMargenObj && (
            <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Margen bajo objetivo:</strong>{' '}
                {rentabilidad.advertenciaMargen !== null && rentabilidad.advertenciaMargen !== undefined
                  ? rentabilidad.advertenciaMargen
                  : 'Margen realizado inferior al objetivo (afectado por precio mínimo de pieza o redondeo).'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 1. CASCADA VERTICAL */}
      <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 bg-white">
        {pasos.map((paso) => {
          // Omitimos los pasos individuales de labor ya que se agrupan en su bloque
          if (
            paso.clave === 'labor_modelado' ||
            paso.clave === 'labor_alistado' ||
            paso.clave === 'labor_post'
          ) {
            // Cuando llegamos a labor_modelado (el primero), renderizamos el grupo completo
            if (paso.clave === 'labor_modelado') {
              return (
                <div key="grupo_mano_de_obra" className="divide-y divide-stone-100/60">
                  {/* Fila agrupada de Mano de Obra */}
                  <div
                    onClick={() => setLaborExpandida(!laborExpandida)}
                    className="relative flex items-center justify-between py-2 px-3 hover:bg-stone-50 cursor-pointer select-none transition-colors"
                  >
                    {/* Barra de proporción tenue */}
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-600/10 pointer-events-none transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, pctLaborTotal))}%` }}
                    />

                    <div className="relative z-10 flex items-center gap-1.5 font-medium text-[#2B2B2B]">
                      {laborExpandida ? (
                        <ChevronDown className="w-4 h-4 text-stone-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-stone-500" />
                      )}
                      <span>Mano de obra (total)</span>
                      <TooltipAyuda texto="Suma de modelado CAD, alistado de taller y post-procesado manual." />
                      {algunaLaborEnCero && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-normal ml-1">
                          Revisar capturas en $0
                        </span>
                      )}
                    </div>

                    <div className="relative z-10 font-mono text-sm text-[#2B2B2B] font-semibold flex items-center gap-2">
                      <span className="text-xs text-stone-400 font-sans font-normal">
                        {pctLaborTotal.toFixed(1)}%
                      </span>
                      <span>{formatearMoneda(montoLaborTotal)}</span>
                    </div>
                  </div>

                  {/* Sub-filas colapsables */}
                  {laborExpandida && (
                    <div className="bg-[#FAF9F6] pl-6 pr-3 py-1 space-y-0.5 border-l-2 border-[#1B4D3E]/30 text-xs">
                      {pasoModelado !== undefined && (
                        <div className="flex items-center justify-between py-1 text-stone-600">
                          <span className="flex items-center">
                            • Modelado CAD
                            <TooltipAyuda texto={pasoModelado.ayuda} />
                            {pasoModelado.monto <= 0 && (
                              <span className="text-[10px] text-stone-400 ml-1.5">($0 / sin diseño)</span>
                            )}
                          </span>
                          <span className="font-mono">{formatearMoneda(pasoModelado.monto)}</span>
                        </div>
                      )}

                      {pasoAlistado !== undefined && (
                        <div className="flex items-center justify-between py-1 text-stone-600">
                          <span className="flex items-center">
                            • Alistado / Setup
                            <TooltipAyuda texto={pasoAlistado.ayuda} />
                            {pasoAlistado.monto <= 0 && (
                              <span className="text-[10px] text-amber-600 ml-1.5">(0 min)</span>
                            )}
                          </span>
                          <span className="font-mono">{formatearMoneda(pasoAlistado.monto)}</span>
                        </div>
                      )}

                      {pasoPost !== undefined && (
                        <div className="flex items-center justify-between py-1 text-stone-600">
                          <span className="flex items-center">
                            • Post-procesado
                            <TooltipAyuda texto={pasoPost.ayuda} />
                            {pasoPost.monto <= 0 && (
                              <span className="text-[10px] text-amber-600 ml-1.5">(0 min)</span>
                            )}
                          </span>
                          <span className="font-mono">{formatearMoneda(pasoPost.monto)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          }

          // Renderizado según tipo de paso
          if (paso.tipo === 'total') {
            return (
              <div
                key={paso.clave}
                className="relative flex items-center justify-between py-3 px-3.5 bg-[#1B4D3E] text-white font-bold text-base"
              >
                <div className="relative z-10 flex items-center">
                  <span>{paso.etiqueta}</span>
                  <TooltipAyuda texto={paso.ayuda} />
                </div>
                <div className="relative z-10 font-mono text-lg font-black tracking-tight">
                  {formatearMoneda(paso.monto)}
                </div>
              </div>
            );
          }

          if (paso.tipo === 'subtotal') {
            return (
              <div
                key={paso.clave}
                className="relative flex items-center justify-between py-2 px-3 bg-[#F7F5F0] text-[#1B4D3E] font-bold text-sm border-t border-stone-200"
              >
                <div className="relative z-10 flex items-center">
                  <span>{paso.etiqueta}</span>
                  <TooltipAyuda texto={paso.ayuda} />
                </div>
                <div className="relative z-10 font-mono text-sm">
                  {formatearMoneda(paso.monto)}
                </div>
              </div>
            );
          }

          if (paso.tipo === 'ajuste') {
            return (
              <div
                key={paso.clave}
                className="relative flex items-center justify-between py-2 px-3 text-[#2B2B2B] text-sm"
              >
                {/* Barra de proporción tenue */}
                <div
                  className="absolute inset-y-0 left-0 bg-[#2E7D32]/10 pointer-events-none transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, paso.porcentajeDelPrecio))}%` }}
                />

                <div className="relative z-10 flex items-center text-[#2E7D32] font-semibold">
                  <span>{paso.etiqueta}</span>
                  <TooltipAyuda texto={paso.ayuda} />
                </div>
                <div className="relative z-10 font-mono font-semibold text-[#2E7D32]">
                  +{formatearMoneda(paso.monto)}
                </div>
              </div>
            );
          }

          // Tipo componente estándar
          return (
            <div
              key={paso.clave}
              className="relative flex items-center justify-between py-1.5 px-3 text-[#2B2B2B] text-sm"
            >
              {/* Barra de proporción tenue */}
              <div
                className="absolute inset-y-0 left-0 bg-stone-300/20 pointer-events-none transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, paso.porcentajeDelPrecio))}%` }}
              />

              <div className="relative z-10 flex items-center text-stone-700">
                <span>{paso.etiqueta}</span>
                <TooltipAyuda texto={paso.ayuda} />
              </div>
              <div className="relative z-10 font-mono text-stone-800 flex items-center gap-2">
                <span className="text-[11px] text-stone-400 font-sans">
                  {paso.porcentajeDelPrecio.toFixed(1)}%
                </span>
                <span>{formatearMoneda(paso.monto)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
