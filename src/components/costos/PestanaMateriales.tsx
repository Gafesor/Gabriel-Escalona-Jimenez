import React, { useState } from 'react';
import { Plus, Archive, RotateCw, X } from 'lucide-react';
import { TallerConfig } from '../../lib/tallerConfig';
import { MaterialConfig, TecnologiaImpresion } from '../../lib/pricing';

export type MaterialConEstado = MaterialConfig & {
  archivado?: boolean;
};

interface PestanaMaterialesProps {
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

const toPercent = (fraction: number): number => {
  return Math.round(fraction * 1000) / 10;
};

const fromPercent = (percent: number): number => {
  return Math.round(percent * 10) / 1000;
};

export const PestanaMateriales: React.FC<PestanaMaterialesProps> = ({ draft, setDraft }) => {
  const [editingMaterial, setEditingMaterial] = useState<MaterialConEstado | null>(null);
  const [isCreatingMaterial, setIsCreatingMaterial] = useState<boolean>(false);

  const handleOpenCreate = () => {
    setIsCreatingMaterial(true);
    setEditingMaterial({
      id: `mat-${Date.now()}`,
      nombre: 'Nuevo Filamento',
      tecnologia: 'FDM',
      costoPorUnidad: 500,
      mermaPorcentaje: 0.05
    });
  };

  const handleSaveMaterial = () => {
    if (!editingMaterial) return;

    if (isCreatingMaterial) {
      setDraft(prev => ({
        ...prev,
        materiales: [...prev.materiales, editingMaterial]
      }));
    } else {
      setDraft(prev => ({
        ...prev,
        materiales: prev.materiales.map(m => (m.id === editingMaterial.id ? editingMaterial : m))
      }));
    }
    setEditingMaterial(null);
  };

  const handleToggleArchive = (mat: MaterialConfig) => {
    const isArchived = (mat as MaterialConEstado).archivado === true;
    setDraft(prev => ({
      ...prev,
      materiales: prev.materiales.map(m => {
        if (m.id === mat.id) {
          return { ...m, archivado: !isArchived } as MaterialConfig;
        }
        return m;
      })
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold uppercase font-mono text-[#1B4D3E]">
            Catálogo de Materiales
          </h3>
          <p className="text-[11px] text-gray-500 font-mono">
            Configura filamentos FDM ($/kg) y resinas MSLA ($/L) con su porcentaje de merma.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="bg-[#1B4D3E] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-[#2E7D32] transition-colors cursor-pointer"
        >
          <Plus size={14} /> + Agregar Material
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {draft.materiales.map(mat => {
          const isArchived = (mat as MaterialConEstado).archivado === true;

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
                    onClick={() => handleToggleArchive(mat)}
                    className="text-xs text-gray-500 hover:text-gray-800 p-1 cursor-pointer transition-colors"
                    title={isArchived ? 'Reactivar material' : 'Archivar material'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                onChange={e => setEditingMaterial({ ...editingMaterial, costoPorUnidad: Math.max(0, Number(e.target.value) || 0) })}
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
                onChange={e => setEditingMaterial({ ...editingMaterial, mermaPorcentaje: fromPercent(Math.max(0, Math.min(50, Number(e.target.value) || 0))) })}
                className="border border-gray-300 rounded p-1.5 font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setEditingMaterial(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 hover:bg-gray-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveMaterial}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1B4D3E] text-white hover:bg-[#2E7D32] cursor-pointer"
            >
              Guardar Material
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
