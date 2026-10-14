import React, { useMemo } from 'react';
import { TrendingUp, Percent } from 'lucide-react';
import { TallerConfig, buildContext } from '../../lib/tallerConfig';
import { calcularLinea, LineaInput, TecnologiaImpresion } from '../../lib/pricing';
import { DesgloseAgregadoTicket } from '../../lib/ticket';
import { DonaDesglose } from '../DonaDesglose';

interface PanelPiezaReferenciaProps {
  draft: TallerConfig;
  config: TallerConfig;
  refPrinterId: string;
  setRefPrinterId: (id: string) => void;
  refMaterialId: string;
  setRefMaterialId: (id: string) => void;
  refPeso: number;
  setRefPeso: (peso: number) => void;
  refHoras: number;
  setRefHoras: (horas: number) => void;
  refSetup: number;
  setRefSetup: (setup: number) => void;
  refPost: number;
  setRefPost: (post: number) => void;
}

const formatMXN = (val: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
};

export const PanelPiezaReferencia: React.FC<PanelPiezaReferenciaProps> = ({
  draft,
  config,
  refPrinterId,
  setRefPrinterId,
  refMaterialId,
  setRefMaterialId,
  refPeso,
  setRefPeso,
  refHoras,
  setRefHoras,
  refSetup,
  setRefSetup,
  refPost,
  setRefPost
}) => {
  const refLineaInput: LineaInput = useMemo(() => {
    const printer = draft.impresoras.find(i => i.id === refPrinterId) || draft.impresoras[0];
    const tec: TecnologiaImpresion = printer ? printer.tecnologia : 'FDM';
    return {
      id: 'ref-piece',
      nombrePieza: 'Pieza de Referencia',
      tecnologia: tec,
      cantidad: 1,
      horasImpresion: Math.max(0.1, refHoras),
      pesoGramos: tec === 'FDM' ? Math.max(1, refPeso) : undefined,
      volumenMl: tec === 'MSLA' ? Math.max(1, refPeso) : undefined,
      minutosSetup: Math.max(0, refSetup),
      minutosPostproceso: Math.max(0, refPost),
      extrasDirectos: 0,
      margen: draft.margenPorDefecto
    };
  }, [draft, refPrinterId, refHoras, refPeso, refSetup, refPost]);

  const resGuardado = useMemo(() => {
    const pId = refPrinterId || (config.impresoras.length > 0 ? config.impresoras[0].id : '');
    const mId = refMaterialId || (config.materiales.length > 0 ? config.materiales[0].id : '');
    if (!pId || !mId) return null;

    const ctx = buildContext(config, pId, mId, {
      urgente: false,
      envio: 0,
      cobrarIva: false,
      margen: config.margenPorDefecto
    });
    return calcularLinea(refLineaInput, ctx);
  }, [config, refPrinterId, refMaterialId, refLineaInput]);

  const resBorrador = useMemo(() => {
    const pId = refPrinterId || (draft.impresoras.length > 0 ? draft.impresoras[0].id : '');
    const mId = refMaterialId || (draft.materiales.length > 0 ? draft.materiales[0].id : '');
    if (!pId || !mId) return null;

    const ctx = buildContext(draft, pId, mId, {
      urgente: false,
      envio: 0,
      cobrarIva: false,
      margen: draft.margenPorDefecto
    });
    return calcularLinea(refLineaInput, ctx);
  }, [draft, refPrinterId, refMaterialId, refLineaInput]);

  const precioGuardado = resGuardado ? resGuardado.precioTotal : 0;
  const precioBorrador = resBorrador ? resBorrador.precioTotal : 0;

  const diffPesos = precioBorrador - precioGuardado;
  const diffPorcentaje = precioGuardado > 0 ? (diffPesos / precioGuardado) * 100 : 0;

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

  return (
    <div className="bg-[#F7F5F0] p-4 lg:p-5 rounded-2xl border border-[#82C69E] shadow-xs flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <span className="font-extrabold text-xs uppercase font-mono text-[#1B4D3E] flex items-center gap-1.5">
          <TrendingUp size={16} /> Pieza de Referencia
        </span>
        <span className="text-[10px] text-gray-500 font-mono">Simulador en vivo</span>
      </div>

      {/* Selector de Impresora y Material para la prueba */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-mono font-bold text-gray-600">Impresora de prueba</label>
          <select
            value={refPrinterId}
            onChange={e => setRefPrinterId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs font-bold"
          >
            {draft.impresoras.map(i => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.tecnologia})
              </option>
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
              <option key={m.id} value={m.id}>
                {m.nombre} ({m.tecnologia})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inputs de Masa, Horas, Prep y Post */}
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

      {/* Comparador Numérico Guardado vs Borrador */}
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
          <span
            className={`font-mono text-xs font-black ${
              diffPesos > 0 ? 'text-[#2E7D32]' : diffPesos < 0 ? 'text-amber-700' : 'text-gray-600'
            }`}
          >
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
  );
};
