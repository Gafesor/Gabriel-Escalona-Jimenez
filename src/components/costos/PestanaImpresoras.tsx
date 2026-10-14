import React, { useState } from 'react';
import { Plus, Archive, RotateCw, X } from 'lucide-react';
import { TallerConfig } from '../../lib/tallerConfig';
import { ImpresoraConfig, TecnologiaImpresion } from '../../lib/pricing';

export type ImpresoraConEstado = ImpresoraConfig & {
  archivado?: boolean;
};

interface PestanaImpresorasProps {
  draft: TallerConfig;
  setDraft: React.Dispatch<React.SetStateAction<TallerConfig>>;
}

const formatMXN = (val: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
};

export const PestanaImpresoras: React.FC<PestanaImpresorasProps> = ({ draft, setDraft }) => {
  const [editingPrinter, setEditingPrinter] = useState<ImpresoraConEstado | null>(null);
  const [isCreatingPrinter, setIsCreatingPrinter] = useState<boolean>(false);

  const handleOpenCreate = () => {
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
  };

  const handleSavePrinter = () => {
    if (!editingPrinter) return;

    if (isCreatingPrinter) {
      setDraft(prev => ({
        ...prev,
        impresoras: [...prev.impresoras, editingPrinter]
      }));
    } else {
      setDraft(prev => ({
        ...prev,
        impresoras: prev.impresoras.map(i => (i.id === editingPrinter.id ? editingPrinter : i))
      }));
    }
    setEditingPrinter(null);
  };

  const handleToggleArchive = (imp: ImpresoraConfig) => {
    const isArchived = (imp as ImpresoraConEstado).archivado === true;
    setDraft(prev => ({
      ...prev,
      impresoras: prev.impresoras.map(i => {
        if (i.id === imp.id) {
          return { ...i, archivado: !isArchived } as ImpresoraConfig;
        }
        return i;
      })
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold uppercase font-mono text-[#1B4D3E]">
            Catálogo de Impresoras del Taller
          </h3>
          <p className="text-[11px] text-gray-500 font-mono">
            Define la potencia, vida útil y costo de mantenimiento por hora.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="bg-[#1B4D3E] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-[#2E7D32] transition-colors cursor-pointer"
        >
          <Plus size={14} /> + Agregar Impresora
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {draft.impresoras.map(imp => {
          const amort = imp.vidaUtilHoras > 0 ? imp.precioCompra / imp.vidaUtilHoras : 0;
          const costoHoraCalculado = amort + imp.mantenimientoPorHora;
          const isArchived = (imp as ImpresoraConEstado).archivado === true;

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
                    onClick={() => handleToggleArchive(imp)}
                    className="text-xs text-gray-500 hover:text-gray-800 p-1 cursor-pointer transition-colors"
                    title={isArchived ? 'Reactivar impresora' : 'Archivar impresora'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                onChange={e => setEditingPrinter({ ...editingPrinter, potenciaPromedioW: Math.max(1, Number(e.target.value) || 1) })}
                className="border border-gray-300 rounded p-1.5 font-bold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-600">Precio de Compra ($ MXN)</label>
              <input
                type="number"
                min="0"
                value={editingPrinter.precioCompra}
                onChange={e => setEditingPrinter({ ...editingPrinter, precioCompra: Math.max(0, Number(e.target.value) || 0) })}
                className="border border-gray-300 rounded p-1.5 font-bold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-600">Vida Útil (Horas)</label>
              <input
                type="number"
                min="100"
                value={editingPrinter.vidaUtilHoras}
                onChange={e => setEditingPrinter({ ...editingPrinter, vidaUtilHoras: Math.max(1, Number(e.target.value) || 1) })}
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
                onChange={e => setEditingPrinter({ ...editingPrinter, mantenimientoPorHora: Math.max(0, Number(e.target.value) || 0) })}
                className="border border-gray-300 rounded p-1.5 font-bold"
              />
            </div>
            <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
              <label className="font-bold text-gray-600">Tarifa Manual Opcional ($/h - anula amortización)</label>
              <input
                type="number"
                min="0"
                placeholder="Vacío para cálculo automático"
                value={editingPrinter.tarifaHoraManual !== undefined ? editingPrinter.tarifaHoraManual : ''}
                onChange={e => setEditingPrinter({
                  ...editingPrinter,
                  tarifaHoraManual: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0)
                })}
                className="border border-gray-300 rounded p-1.5 font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setEditingPrinter(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 hover:bg-gray-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSavePrinter}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1B4D3E] text-white hover:bg-[#2E7D32] cursor-pointer"
            >
              Guardar Impresora
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
