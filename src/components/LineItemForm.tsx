/**
 * CubeUp³ — Formulario de Partida / Pieza (LineItemForm)
 * 
 * Permite capturar y editar líneas de impresión técnica (FDM o MSLA).
 * - Selección de presets preconfigurados con auto-rellenado y guardado de nuevo preset.
 * - Validación en vivo mediante `validarLinea()` de pricing.ts (los problemas se muestran inline).
 * - Aritmética de costos y precios delegada al 100% en `calcularLinea()`.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Clock,
  Scale,
  Wrench,
  DollarSign,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  Material,
  Printer,
  Preset,
  QuoteItem,
  QuoteItemImpresionFDM,
  QuoteItemImpresionMSLA,
  DEFAULT_TALLER_SETTINGS,
  esMaterialFDM,
  esMaterialMSLA
} from '../types/domain';
import {
  calcularLinea,
  validarLinea,
  PricingContext,
  LineaInput,
  ProblemaValidacion,
  margenToMarkup
} from '../lib/pricing';

export interface LineItemFormProps {
  materiales: Material[];
  impresoras: Printer[];
  presets: Preset[];
  globalMargin: number; // Porcentaje (ej. 45)
  onAddItem: (item: QuoteItem) => void;
  onSaveAsPreset?: (preset: Omit<Preset, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'archivedAt'>) => void;
}

export const LineItemForm: React.FC<LineItemFormProps> = ({
  materiales,
  impresoras,
  presets,
  globalMargin,
  onAddItem,
  onSaveAsPreset
}) => {
  // Estado local del formulario
  const [nombrePieza, setNombrePieza] = useState<string>('');
  const [tecnologia, setTecnologia] = useState<'FDM' | 'MSLA'>('FDM');
  const [materialId, setMaterialId] = useState<string>('');
  const [printerId, setPrinterId] = useState<string>('');
  const [presetIdSeleccionado, setPresetIdSeleccionado] = useState<string>('');

  const [cantidad, setCantidad] = useState<number>(1);
  const [horasImpresion, setHorasImpresion] = useState<number>(2.5);
  const [pesoGramos, setPesoGramos] = useState<number>(45);
  const [volumenMl, setVolumenMl] = useState<number>(30);
  const [minutosSetup, setMinutosSetup] = useState<number>(10);
  const [minutosPostproceso, setMinutosPostproceso] = useState<number>(5);
  const [extrasDirectos, setExtrasDirectos] = useState<number>(0);

  const [guardadoExitosoPreset, setGuardadoExitosoPreset] = useState<boolean>(false);

  // Filtrar materiales e impresoras compatibles según tecnología seleccionada
  const materialesCompatibles = useMemo(() => {
    return materiales.filter((m) => m.tecnologia === tecnologia && m.activo && !m.archivedAt);
  }, [materiales, tecnologia]);

  const impresorasCompatibles = useMemo(() => {
    return impresoras.filter((p) => p.tecnologia === tecnologia && p.activo && !p.archivedAt);
  }, [impresoras, tecnologia]);

  const presetsCompatibles = useMemo(() => {
    return presets.filter((p) => p.tecnologia === tecnologia && !p.archivedAt);
  }, [presets, tecnologia]);

  // Autoseleccionar material e impresora por defecto si cambian
  useEffect(() => {
    if (materialesCompatibles.length > 0 && (!materialId || !materialesCompatibles.some((m) => m.id === materialId))) {
      setMaterialId(materialesCompatibles[0].id);
    }
  }, [materialesCompatibles, materialId]);

  useEffect(() => {
    if (impresorasCompatibles.length > 0 && (!printerId || !impresorasCompatibles.some((p) => p.id === printerId))) {
      setPrinterId(impresorasCompatibles[0].id);
    }
  }, [impresorasCompatibles, printerId]);

  // Objeto material e impresora activos
  const materialActivo = useMemo(() => {
    return materiales.find((m) => m.id === materialId);
  }, [materiales, materialId]);

  const impresoraActiva = useMemo(() => {
    return impresoras.find((p) => p.id === printerId);
  }, [impresoras, printerId]);

  // Aplicar Preset
  const handleAplicarPreset = (id: string) => {
    setPresetIdSeleccionado(id);
    if (!id) return;
    const targetPreset = presets.find((p) => p.id === id);
    if (targetPreset) {
      if (targetPreset.tecnologia !== tecnologia) {
        setTecnologia(targetPreset.tecnologia);
      }
    }
  };

  // Guardar línea actual como nuevo preset
  const handleCrearPreset = () => {
    if (!onSaveAsPreset || !nombrePieza.trim()) return;
    onSaveAsPreset({
      nombre: `Preset: ${nombrePieza.trim()}`,
      tecnologia,
      alturaCapaMm: 0.2,
      rellenoPorcentaje: 20
    });
    setGuardadoExitosoPreset(true);
    setTimeout(() => setGuardadoExitosoPreset(false), 3000);
  };

  // Armar contexto de precios para el cálculo
  const ctx: PricingContext | null = useMemo(() => {
    if (!materialActivo || !impresoraActiva) return null;

    let costoUnidad = 450;
    if (esMaterialFDM(materialActivo)) {
      costoUnidad = materialActivo.precioPorKg;
    } else if (esMaterialMSLA(materialActivo)) {
      costoUnidad = materialActivo.precioPorLitro;
    }

    return {
      tarifaKwh: DEFAULT_TALLER_SETTINGS.tarifaKwh,
      tarifaOperadorHora: DEFAULT_TALLER_SETTINGS.tarifaOperadorHora,
      margenPorDefecto: globalMargin / 100,
      tasaFallaPorDefecto: DEFAULT_TALLER_SETTINGS.tasaFallaPorDefecto,
      minimoPorPieza: DEFAULT_TALLER_SETTINGS.minimoPorPieza,
      pasoRedondeo: DEFAULT_TALLER_SETTINGS.pasoRedondeo,
      minimoPedido: DEFAULT_TALLER_SETTINGS.minimoPedido,
      recargoUrgencia: 0,
      envio: 0,
      ivaTasa: DEFAULT_TALLER_SETTINGS.ivaTasa,
      impresora: {
        id: impresoraActiva.id,
        nombre: impresoraActiva.nombre,
        tecnologia: impresoraActiva.tecnologia,
        potenciaPromedioW: impresoraActiva.potenciaPromedioW,
        precioCompra: impresoraActiva.precioCompra,
        vidaUtilHoras: impresoraActiva.vidaUtilHoras,
        mantenimientoPorHora: impresoraActiva.mantenimientoPorHora,
        tarifaHoraManual: impresoraActiva.tarifaHoraManual,
        volumenMaxMm: impresoraActiva.volumenMaxMm
      },
      material: {
        id: materialActivo.id,
        nombre: materialActivo.nombre,
        tecnologia: materialActivo.tecnologia,
        costoPorUnidad: costoUnidad,
        mermaPorcentaje: materialActivo.merma
      }
    };
  }, [materialActivo, impresoraActiva, globalMargin]);

  // Entrada de la línea
  const lineaInput: LineaInput = useMemo(() => {
    return {
      id: 'preview-draft',
      nombrePieza: nombrePieza.trim() || 'Pieza sin nombre',
      tecnologia,
      cantidad: Math.max(1, cantidad),
      horasImpresion: Math.max(0.1, horasImpresion),
      pesoGramos: tecnologia === 'FDM' ? pesoGramos : undefined,
      volumenMl: tecnologia === 'MSLA' ? volumenMl : undefined,
      minutosSetup,
      minutosPostproceso,
      extrasDirectos,
      margen: globalMargin / 100
    };
  }, [
    nombrePieza,
    tecnologia,
    cantidad,
    horasImpresion,
    pesoGramos,
    volumenMl,
    minutosSetup,
    minutosPostproceso,
    extrasDirectos,
    globalMargin
  ]);

  // Validaciones en vivo
  const problemas = useMemo<ProblemaValidacion[]>(() => {
    if (!ctx) return [];
    return validarLinea(lineaInput, ctx);
  }, [lineaInput, ctx]);

  // Cálculo puro en tiempo real
  const resultadoCalculo = useMemo(() => {
    if (!ctx) return null;
    return calcularLinea(lineaInput, ctx);
  }, [lineaInput, ctx]);

  // Helper para buscar problemas por campo
  const getProblemaCampo = (campo: string) => problemas.find((p) => p.campo === campo);

  const hayErroresBloqueantes = problemas.some((p) => p.tipo === 'error');

  const handleAgregarAlTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultadoCalculo || hayErroresBloqueantes || !materialActivo || !impresoraActiva) return;

    const baseItem = {
      id: crypto.randomUUID(),
      tipo: 'impresion' as const,
      order: 0,
      descripcion: nombrePieza.trim() || (tecnologia === 'FDM' ? 'Pieza Impresa 3D (FDM)' : 'Pieza Resina (MSLA)'),
      cantidad: resultadoCalculo.cantidad,
      unitCost: resultadoCalculo.costoUnitario,
      totalCost: resultadoCalculo.costoTotal,
      unitPrice: resultadoCalculo.precioUnitario,
      totalPrice: resultadoCalculo.precioTotal,
      breakdown: {
        material: resultadoCalculo.desgloseLote.material,
        energia: resultadoCalculo.desgloseLote.energia,
        maquina: resultadoCalculo.desgloseLote.maquina,
        consumibles: resultadoCalculo.desgloseLote.consumibles,
        laborSetup: resultadoCalculo.desgloseLote.laborSetup,
        laborPost: resultadoCalculo.desgloseLote.laborPost,
        extras: resultadoCalculo.desgloseLote.extras,
        costoDirecto: resultadoCalculo.desgloseLote.costoDirecto,
        reservaFalla: resultadoCalculo.desgloseLote.reservaFalla,
        costoTotal: resultadoCalculo.costoTotal,
        costoUnitario: resultadoCalculo.costoUnitario
      },
      margenAplicado: globalMargin / 100
    };

    if (tecnologia === 'FDM') {
      const itemFDM: QuoteItemImpresionFDM = {
        ...baseItem,
        tecnologia: 'FDM',
        materialId: materialActivo.id,
        printerId: impresoraActiva.id,
        presetId: presetIdSeleccionado || undefined,
        pesoGramos,
        horasImpresion,
        minutosSetup,
        minutosPostproceso
      };
      onAddItem(itemFDM);
    } else {
      const itemMSLA: QuoteItemImpresionMSLA = {
        ...baseItem,
        tecnologia: 'MSLA',
        materialId: materialActivo.id,
        printerId: impresoraActiva.id,
        presetId: presetIdSeleccionado || undefined,
        volumenMl,
        horasImpresion,
        minutosSetup,
        minutosPostproceso
      };
      onAddItem(itemMSLA);
    }

    // Resetear formulario para la siguiente pieza manteniendo la configuración de máquina
    setNombrePieza('');
  };

  return (
    <div className="bg-[#F7F5F0] border border-[#82C69E]/40 rounded-xl p-5 shadow-sm text-[#2B2B2B]">
      {/* Header del formulario */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#82C69E]/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1B4D3E] text-white flex items-center justify-center font-bold">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1B4D3E]">Agregar Pieza a Cotización</h2>
            <p className="text-xs text-gray-500">Parámetros de rebanado, tiempos y consumos de taller</p>
          </div>
        </div>

        {/* Selector de Tecnología FDM vs MSLA */}
        <div className="inline-flex rounded-lg border border-[#82C69E]/60 p-1 bg-white">
          <button
            type="button"
            onClick={() => setTecnologia('FDM')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              tecnologia === 'FDM'
                ? 'bg-[#1B4D3E] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#1B4D3E]'
            }`}
          >
            Filamento (FDM)
          </button>
          <button
            type="button"
            onClick={() => setTecnologia('MSLA')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              tecnologia === 'MSLA'
                ? 'bg-[#1B4D3E] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#1B4D3E]'
            }`}
          >
            Resina (MSLA)
          </button>
        </div>
      </div>

      {/* Selector de Presets de Rebanado */}
      <div className="pt-3 pb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Sparkles className="w-4 h-4 text-[#2E7D32]" />
          <label htmlFor="preset-select" className="text-xs font-semibold text-gray-700">
            Preset de Laminado:
          </label>
          <select
            id="preset-select"
            value={presetIdSeleccionado}
            onChange={(e) => handleAplicarPreset(e.target.value)}
            className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#1B4D3E] focus:outline-none"
          >
            <option value="">Personalizado / Sin preset</option>
            {presetsCompatibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.alturaCapaMm}mm - {p.rellenoPorcentaje}%)
              </option>
            ))}
          </select>
        </div>

        {onSaveAsPreset && (
          <button
            type="button"
            onClick={handleCrearPreset}
            disabled={!nombrePieza.trim()}
            className="text-xs px-3 py-1.5 rounded-md border border-[#2E7D32] text-[#2E7D32] hover:bg-[#2E7D32]/10 transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
          >
            {guardadoExitosoPreset ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <span>Guardar como preset</span>
            )}
          </button>
        )}
      </div>

      <form onSubmit={handleAgregarAlTicket} className="space-y-4 pt-2">
        {/* Fila 1: Nombre de la pieza y Cantidad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="pieza-nombre" className="block text-xs font-semibold text-gray-700 mb-1">
              Nombre de la pieza o descripción del modelo
            </label>
            <input
              id="pieza-nombre"
              type="text"
              placeholder="Ej: Carcasa de sensor IP67, Engrane helicoidal..."
              value={nombrePieza}
              onChange={(e) => setNombrePieza(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1B4D3E] focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="pieza-cantidad" className="block text-xs font-semibold text-gray-700 mb-1">
              Cantidad de piezas (Lote)
            </label>
            <div className="flex items-center">
              <input
                id="pieza-cantidad"
                type="number"
                min="1"
                step="1"
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1B4D3E] focus:outline-none font-semibold text-center"
              />
            </div>
            {getProblemaCampo('cantidad') && (
              <p className="text-[11px] text-red-600 mt-1">{getProblemaCampo('cantidad')?.mensaje}</p>
            )}
          </div>
        </div>

        {/* Fila 2: Material e Impresora */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="select-material" className="block text-xs font-semibold text-gray-700 mb-1">
              Material ({tecnologia})
            </label>
            <select
              id="select-material"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1B4D3E] focus:outline-none"
            >
              {materialesCompatibles.map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.nombre} ({mat.color}) - $
                  {esMaterialFDM(mat) ? `${mat.precioPorKg}/kg` : `${mat.precioPorLitro}/L`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="select-printer" className="block text-xs font-semibold text-gray-700 mb-1">
              Impresora asignada
            </label>
            <select
              id="select-printer"
              value={printerId}
              onChange={(e) => setPrinterId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#1B4D3E] focus:outline-none"
            >
              {impresorasCompatibles.map((imp) => (
                <option key={imp.id} value={imp.id}>
                  {imp.nombre} ({imp.modelo}) · ~{imp.potenciaPromedioW}W
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 3: Consumo y Tiempo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3.5 rounded-lg border border-[#82C69E]/30">
          {tecnologia === 'FDM' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="input-peso" className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-[#2E7D32]" />
                  <span>Peso Lote (g)</span>
                </label>
              </div>
              <input
                id="input-peso"
                type="number"
                min="1"
                step="any"
                value={pesoGramos}
                onChange={(e) => setPesoGramos(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:outline-none"
              />
              {getProblemaCampo('pesoGramos') && (
                <p
                  className={`text-[10px] mt-1 ${
                    getProblemaCampo('pesoGramos')?.tipo === 'error' ? 'text-red-600' : 'text-amber-700'
                  }`}
                >
                  {getProblemaCampo('pesoGramos')?.mensaje}
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="input-volumen" className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#2E7D32]" />
                  <span>Volumen Lote (ml)</span>
                </label>
              </div>
              <input
                id="input-volumen"
                type="number"
                min="1"
                step="any"
                value={volumenMl}
                onChange={(e) => setVolumenMl(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:outline-none"
              />
              {getProblemaCampo('volumenMl') && (
                <p className="text-[10px] text-red-600 mt-1">{getProblemaCampo('volumenMl')?.mensaje}</p>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="input-horas" className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>Tiempo Máquina (h)</span>
              </label>
            </div>
            <input
              id="input-horas"
              type="number"
              min="0.1"
              step="0.1"
              value={horasImpresion}
              onChange={(e) => setHorasImpresion(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:outline-none"
            />
            {getProblemaCampo('horasImpresion') && (
              <p className="text-[10px] text-red-600 mt-1">{getProblemaCampo('horasImpresion')?.mensaje}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="input-setup" className="text-xs font-semibold text-gray-700 flex items-center gap-1" title="Preparación del lote (1 sola vez)">
                <Wrench className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>Setup Lote (min)</span>
              </label>
            </div>
            <input
              id="input-setup"
              type="number"
              min="0"
              step="1"
              value={minutosSetup}
              onChange={(e) => setMinutosSetup(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="input-post" className="text-xs font-semibold text-gray-700 flex items-center gap-1" title="Postproceso aplicado por cada pieza">
                <Wrench className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span>Postproceso/Pza (min)</span>
              </label>
            </div>
            <input
              id="input-post"
              type="number"
              min="0"
              step="1"
              value={minutosPostproceso}
              onChange={(e) => setMinutosPostproceso(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Insumos extras directos */}
        <div className="flex items-center gap-3">
          <label htmlFor="input-extras" className="text-xs font-semibold text-gray-700 flex items-center gap-1 min-w-[170px]">
            <DollarSign className="w-3.5 h-3.5 text-[#2E7D32]" />
            <span>Extras/Insertos Lote ($ MXN):</span>
          </label>
          <input
            id="input-extras"
            type="number"
            min="0"
            step="any"
            value={extrasDirectos}
            onChange={(e) => setExtrasDirectos(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-36 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-md focus:outline-none"
            placeholder="0.00"
          />
          <span className="text-[11px] text-gray-500">Insertos térmicos, tornillos, empaques, pintura</span>
        </div>

        {/* Preview en vivo y botón de agregar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#82C69E]/30">
          {resultadoCalculo ? (
            <div className="flex items-baseline gap-4 text-xs">
              <div>
                <span className="text-gray-500">Costo lote: </span>
                <span className="font-semibold text-gray-800">${resultadoCalculo.costoTotal.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Precio unitario: </span>
                <span className="font-bold text-[#1B4D3E] text-sm">${resultadoCalculo.precioUnitario.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Precio total ({cantidad} pza{cantidad > 1 ? 's' : ''}): </span>
                <span className="font-extrabold text-[#2E7D32] text-base">${resultadoCalculo.precioTotal.toFixed(2)} MXN</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              <span>Configura material e impresora para ver el cálculo.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!resultadoCalculo || hayErroresBloqueantes}
            className="px-5 py-2.5 bg-[#1B4D3E] hover:bg-[#2E7D32] text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Agregar al Ticket</span>
          </button>
        </div>
      </form>
    </div>
  );
};
