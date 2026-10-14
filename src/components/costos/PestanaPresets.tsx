import React, { useState } from 'react';
import { 
  Zap, 
  Shield, 
  Sparkles, 
  Layers, 
  Crown, 
  Box, 
  Hammer, 
  Heart, 
  Wrench, 
  Package, 
  Rocket, 
  Star,
  GripVertical, 
  Pencil, 
  Copy, 
  Archive, 
  ArchiveRestore, 
  Plus, 
  Check, 
  X, 
  Info,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { Preset, TallerConfig } from '../../lib/tallerConfig';

export interface PestanaPresetsProps {
  draft: TallerConfig;
  setDraft: React.Dispatch<React.SetStateAction<TallerConfig>>;
}

// Catálogo de iconos disponibles para los prestablecidos
export const PRESET_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Zap,
  Shield,
  Sparkles,
  Layers,
  Crown,
  Box,
  Hammer,
  Heart,
  Wrench,
  Package,
  Rocket,
  Star
};

// Formato de porcentaje seguro
const formatPct = (val: number): string => `${Math.round(val * 100)}%`;

export function PestanaPresets({ draft, setDraft }: PestanaPresetsProps) {
  // Filtro de activos / archivados
  const [verArchivados, setVerArchivados] = useState<boolean>(false);

  // Estado para drag and drop nativo HTML5
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Estado del modal de edición / creación
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filtrar prestablecidos según pestaña
  const activePresets = draft.presets.filter(p => !p.archivado);
  const archivedPresets = draft.presets.filter(p => p.archivado);
  const presetsVisibles = verArchivados ? archivedPresets : activePresets;

  // Renderizar icono dinámico según string
  const renderIcon = (iconoName: string, size = 16, className = '') => {
    const IconComponent = PRESET_ICONS[iconoName] || Box;
    return <IconComponent size={size} className={className} />;
  };

  // Drag and Drop nativo HTML5
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newActiveList = [...activePresets];
    const [movedItem] = newActiveList.splice(draggedIndex, 1);
    newActiveList.splice(targetIndex, 0, movedItem);

    // Reasignar orden secuencial a la lista reordenada
    const reorderedActive = newActiveList.map((item, idx) => ({
      ...item,
      orden: idx
    }));

    // Combinar con los archivados intactos
    const updatedAllPresets = [
      ...reorderedActive,
      ...archivedPresets
    ];

    setDraft(prev => ({
      ...prev,
      presets: updatedAllPresets
    }));

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Duplicar preset
  const handleDuplicate = (preset: Preset) => {
    const newId = `preset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPreset: Preset = {
      ...preset,
      id: newId,
      nombre: `${preset.nombre} (copia)`,
      orden: draft.presets.length,
      archivado: false
    };

    setDraft(prev => ({
      ...prev,
      presets: [...prev.presets, newPreset]
    }));
  };

  // Alternar archivado (Archivar / Desarchivar)
  const handleToggleArchive = (presetId: string) => {
    setDraft(prev => ({
      ...prev,
      presets: prev.presets.map(p => {
        if (p.id === presetId) {
          return {
            ...p,
            archivado: !p.archivado
          };
        }
        return p;
      })
    }));
  };

  // Iniciar edición
  const handleStartEdit = (preset: Preset) => {
    setEditingPreset({ ...preset });
    setIsCreating(false);
    setFormErrors({});
  };

  // Iniciar nuevo preset
  const handleStartCreate = () => {
    const defaultMaterial = draft.materiales[0];
    const defaultPrinter = draft.impresoras[0];

    const newPreset: Preset = {
      id: `preset-${Date.now()}`,
      nombre: '',
      icono: 'Zap',
      descripcion: '',
      materialId: defaultMaterial?.id || 'mat-pla-std',
      impresoraId: defaultPrinter?.id || 'imp-fdm-default',
      mermaPorcentaje: defaultMaterial?.mermaPorcentaje ?? 0.05,
      tasaFalla: draft.tasaFallaPorDefecto,
      minutosModelado: 0,
      minutosAlistado: 5,
      minutosPostproceso: 0,
      margenSugerido: draft.margenPorDefecto,
      archivado: false,
      orden: activePresets.length
    };

    setEditingPreset(newPreset);
    setIsCreating(true);
    setFormErrors({});
  };

  // Guardar preset editado o nuevo
  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset) return;

    const errors: Record<string, string> = {};
    if (!editingPreset.nombre.trim()) {
      errors.nombre = 'El nombre del prestablecido es obligatorio.';
    }
    if (editingPreset.mermaPorcentaje < 0 || editingPreset.mermaPorcentaje > 0.50) {
      errors.mermaPorcentaje = 'La merma debe estar entre 0% y 50%.';
    }
    if (editingPreset.tasaFalla < 0 || editingPreset.tasaFalla > 0.40) {
      errors.tasaFalla = 'La tasa de falla debe estar entre 0% y 40%.';
    }
    if (editingPreset.margenSugerido < 0 || editingPreset.margenSugerido > 0.90) {
      errors.margenSugerido = 'El margen debe estar entre 0% y 90%.';
    }
    if (editingPreset.minutosModelado < 0) {
      errors.minutosModelado = 'Los minutos no pueden ser negativos.';
    }
    if (editingPreset.minutosAlistado < 0) {
      errors.minutosAlistado = 'Los minutos no pueden ser negativos.';
    }
    if (editingPreset.minutosPostproceso < 0) {
      errors.minutosPostproceso = 'Los minutos no pueden ser negativos.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setDraft(prev => {
      if (isCreating) {
        return {
          ...prev,
          presets: [...prev.presets, editingPreset]
        };
      } else {
        return {
          ...prev,
          presets: prev.presets.map(p => p.id === editingPreset.id ? editingPreset : p)
        };
      }
    });

    setEditingPreset(null);
    setIsCreating(false);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Barra de Filtros */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#F7F5F0] text-[#1B4D3E]">
              <Sliders size={20} />
            </span>
            <div>
              <h3 className="font-extrabold text-base text-[#2B2B2B] tracking-tight">
                Prestablecidos de Cotización (Presets)
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                Automatiza la selección de 12 parámetros en un solo clic. Arrastra los renglones para ordenar los chips.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-[#F7F5F0] p-1 rounded-xl flex items-center border border-gray-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setVerArchivados(false)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                !verArchivados 
                  ? 'bg-[#1B4D3E] text-white shadow-xs' 
                  : 'text-gray-600 hover:text-[#1B4D3E]'
              }`}
            >
              Activos ({activePresets.length})
            </button>
            <button
              type="button"
              onClick={() => setVerArchivados(true)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                verArchivados 
                  ? 'bg-[#1B4D3E] text-white shadow-xs' 
                  : 'text-gray-600 hover:text-[#1B4D3E]'
              }`}
            >
              Archivados ({archivedPresets.length})
            </button>
          </div>

          {!verArchivados && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="px-3.5 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B4D3E] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              Nuevo prestablecido
            </button>
          )}
        </div>
      </div>

      {/* Lista de Prestablecidos */}
      {presetsVisibles.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-dashed border-gray-300 text-center">
          <Box size={36} className="mx-auto text-gray-400 mb-2" />
          <h4 className="text-sm font-bold text-gray-700">
            {verArchivados ? 'No hay prestablecidos archivados' : 'No hay prestablecidos activos'}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {verArchivados 
              ? 'Cuando archives prestablecidos en desuso aparecerán aquí para recuperarlos.' 
              : 'Crea tu primer prestablecido o recupera uno archivado para acelerar el cotizador.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {!verArchivados && (
            <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 px-1">
              <Info size={13} className="text-[#1B4D3E]" />
              El orden aquí define exactamente la secuencia de botones visibles arriba del cotizador.
            </div>
          )}

          {presetsVisibles.map((preset, index) => {
            const material = draft.materiales.find(m => m.id === preset.materialId);
            const impresora = draft.impresoras.find(i => i.id === preset.impresoraId);
            const isDragging = draggedIndex === index;
            const isOver = dragOverIndex === index;

            return (
              <div
                key={preset.id}
                draggable={!verArchivados}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`bg-white rounded-2xl border transition-all p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isOver 
                    ? 'border-[#2E7D32] bg-[#F7F5F0] shadow-md scale-[1.01]' 
                    : isDragging 
                    ? 'opacity-40 border-dashed border-gray-400' 
                    : 'border-gray-200 hover:border-gray-300 shadow-xs'
                }`}
              >
                {/* Lado izquierdo: Asa de arrastre + Icono + Información */}
                <div className="flex items-start md:items-center gap-3">
                  {!verArchivados ? (
                    <div 
                      className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-gray-100 transition-colors shrink-0"
                      title="Arrastrar para reordenar"
                    >
                      <GripVertical size={18} />
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-gray-400 font-bold px-1.5 py-0.5 bg-gray-100 rounded-md">
                      #{index + 1}
                    </span>
                  )}

                  <div className="w-10 h-10 rounded-xl bg-[#F7F5F0] border border-gray-200 text-[#1B4D3E] flex items-center justify-center shrink-0 shadow-2xs">
                    {renderIcon(preset.icono, 20)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-sm text-[#2B2B2B]">
                        {preset.nombre}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-[#1B4D3E] font-bold border border-emerald-200">
                        Margen {formatPct(preset.margenSugerido)}
                      </span>
                      {preset.minutosModelado > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                          CAD {preset.minutosModelado}m
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{material?.nombre || 'Material eliminado'}</span>
                      <span>•</span>
                      <span>{impresora?.nombre || 'Impresora eliminada'}</span>
                      <span>•</span>
                      <span>Falla {formatPct(preset.tasaFalla)}</span>
                      <span>•</span>
                      <span>Prep {preset.minutosAlistado}m / Post {preset.minutosPostproceso}m</span>
                    </div>

                    {preset.descripcion && (
                      <p className="text-[11px] text-gray-400 italic mt-0.5">
                        {preset.descripcion}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lado derecho: Previsualización de Chip + Acciones */}
                <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 shrink-0">
                  {/* Vista previa del chip */}
                  <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-[#F7F5F0] text-xs font-bold text-[#1B4D3E]">
                    {renderIcon(preset.icono, 14)}
                    <span>{preset.nombre}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(preset)}
                      className="p-2 rounded-xl text-gray-600 hover:text-[#1B4D3E] hover:bg-emerald-50 transition-colors cursor-pointer"
                      title="Editar valores del prestablecido"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicate(preset)}
                      className="p-2 rounded-xl text-gray-600 hover:text-[#1B4D3E] hover:bg-emerald-50 transition-colors cursor-pointer"
                      title="Duplicar como nuevo prestablecido"
                    >
                      <Copy size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleArchive(preset.id)}
                      className="p-2 rounded-xl text-gray-600 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                      title={preset.archivado ? 'Desarchivar y mostrar en cotizador' : 'Archivar prestablecido'}
                    >
                      {preset.archivado ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Creación / Edición */}
      {editingPreset && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full border border-gray-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div className="bg-[#1B4D3E] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-white/10">
                  {renderIcon(editingPreset.icono, 20)}
                </span>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">
                    {isCreating ? 'Nuevo Prestablecido' : `Editar: ${editingPreset.nombre}`}
                  </h3>
                  <p className="text-xs text-gray-300 font-mono">
                    Define la combinación técnica y el margen que se aplicarán en un solo clic.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSavePreset} className="p-6 space-y-5">
              {/* Nombre e Icono */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nombre del Prestablecido *
                  </label>
                  <input
                    type="text"
                    value={editingPreset.nombre}
                    onChange={(e) => setEditingPreset({ ...editingPreset, nombre: e.target.value })}
                    placeholder="p. ej. Prototipo rápido, Serie corta"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] font-medium text-sm text-[#2B2B2B]"
                  />
                  {formErrors.nombre && (
                    <p className="text-xs text-red-600 mt-1 font-mono">{formErrors.nombre}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Icono Distintivo
                  </label>
                  <select
                    value={editingPreset.icono}
                    onChange={(e) => setEditingPreset({ ...editingPreset, icono: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] font-medium text-sm text-[#2B2B2B] bg-white cursor-pointer"
                  >
                    {Object.keys(PRESET_ICONS).map(iconKey => (
                      <option key={iconKey} value={iconKey}>
                        {iconKey}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descripción corta */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Descripción o Subtítulo Técnico (Opcional)
                </label>
                <input
                  type="text"
                  value={editingPreset.descripcion || ''}
                  onChange={(e) => setEditingPreset({ ...editingPreset, descripcion: e.target.value })}
                  placeholder="p. ej. PLA 0.28mm · sin post-procesado · modelado 0"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] text-xs text-gray-700 font-mono"
                />
              </div>

              {/* Selector de Material e Impresora */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Material Vinculado
                  </label>
                  <select
                    value={editingPreset.materialId}
                    onChange={(e) => setEditingPreset({ ...editingPreset, materialId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] font-medium text-sm text-[#2B2B2B] bg-white cursor-pointer"
                  >
                    {draft.materiales.map(mat => (
                      <option key={mat.id} value={mat.id}>
                        {mat.nombre} ({mat.tecnologia}) - ${mat.costoPorUnidad}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Impresora Vinculada
                  </label>
                  <select
                    value={editingPreset.impresoraId}
                    onChange={(e) => setEditingPreset({ ...editingPreset, impresoraId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] font-medium text-sm text-[#2B2B2B] bg-white cursor-pointer"
                  >
                    {draft.impresoras.map(imp => (
                      <option key={imp.id} value={imp.id}>
                        {imp.nombre} ({imp.tecnologia})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tiempos de Mano de Obra: Modelado CAD, Alistado, Postproceso */}
              <div className="bg-[#F7F5F0] p-4 rounded-2xl border border-gray-200 space-y-3">
                <span className="text-xs font-extrabold text-[#1B4D3E] uppercase tracking-wider block">
                  Tiempos de Trabajo (Minutos)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Diseño CAD / Modelado
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={editingPreset.minutosModelado}
                        onChange={(e) => setEditingPreset({ ...editingPreset, minutosModelado: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] text-xs font-mono font-bold text-[#2B2B2B]"
                      />
                      <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono">min</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Alistado / Preparación
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editingPreset.minutosAlistado}
                        onChange={(e) => setEditingPreset({ ...editingPreset, minutosAlistado: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] text-xs font-mono font-bold text-[#2B2B2B]"
                      />
                      <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono">min</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Post-procesado / Acabado
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={editingPreset.minutosPostproceso}
                        onChange={(e) => setEditingPreset({ ...editingPreset, minutosPostproceso: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] text-xs font-mono font-bold text-[#2B2B2B]"
                      />
                      <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Factores de Riesgo y Margen Comercial */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Merma Material (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="1"
                      value={Math.round(editingPreset.mermaPorcentaje * 100)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingPreset({ ...editingPreset, mermaPorcentaje: val / 100 });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] text-xs font-mono font-bold text-[#2B2B2B]"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono">%</span>
                  </div>
                  {formErrors.mermaPorcentaje && (
                    <p className="text-[10px] text-red-600 mt-0.5 font-mono">{formErrors.mermaPorcentaje}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Tasa de Falla (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="40"
                      step="1"
                      value={Math.round(editingPreset.tasaFalla * 100)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingPreset({ ...editingPreset, tasaFalla: val / 100 });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] text-xs font-mono font-bold text-[#2B2B2B]"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono">%</span>
                  </div>
                  {formErrors.tasaFalla && (
                    <p className="text-[10px] text-red-600 mt-0.5 font-mono">{formErrors.tasaFalla}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Margen Sugerido (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      step="1"
                      value={Math.round(editingPreset.margenSugerido * 100)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingPreset({ ...editingPreset, margenSugerido: val / 100 });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-hidden focus:border-[#1B4D3E] text-xs font-mono font-bold text-[#2B2B2B]"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-400 font-mono">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    Markup: {editingPreset.margenSugerido < 1 ? `${((editingPreset.margenSugerido / (1 - editingPreset.margenSugerido)) * 100).toFixed(1)}%` : '—'}
                  </p>
                  {formErrors.margenSugerido && (
                    <p className="text-[10px] text-red-600 mt-0.5 font-mono">{formErrors.margenSugerido}</p>
                  )}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#2E7D32] text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={16} />
                  Guardar Prestablecido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
