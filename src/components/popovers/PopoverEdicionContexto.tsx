import React, { useState, useEffect, useRef } from 'react';
import { X, Save, ExternalLink } from 'lucide-react';
import { MaterialConfig, ImpresoraConfig } from '../../lib/pricing';

export type TipoEdicionContextual = 'material' | 'impresora';

export interface PopoverEdicionContextoProps {
  tipo: TipoEdicionContextual;
  isOpen: boolean;
  onClose: () => void;
  material?: MaterialConfig;
  impresora?: ImpresoraConfig;
  onGuardarMaterial?: (materialActualizado: MaterialConfig) => void | Promise<void>;
  onGuardarImpresora?: (impresoraActualizada: ImpresoraConfig) => void | Promise<void>;
  onAbrirAjustesCompletos: (pestana: 'materiales' | 'impresoras') => void;
}

const toPercent = (fraction: number): number => {
  return Math.round(fraction * 1000) / 10;
};

const fromPercent = (percent: number): number => {
  return Math.round(percent * 10) / 1000;
};

export const PopoverEdicionContexto: React.FC<PopoverEdicionContextoProps> = ({
  tipo,
  isOpen,
  onClose,
  material,
  impresora,
  onGuardarMaterial,
  onGuardarImpresora,
  onAbrirAjustesCompletos
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Estados locales para material
  const [nombreMat, setNombreMat] = useState<string>('');
  const [costoMat, setCostoMat] = useState<number>(0);
  const [mermaMat, setMermaMat] = useState<number>(5);

  // Estados locales para impresora
  const [nombreImp, setNombreImp] = useState<string>('');
  const [potenciaImp, setPotenciaImp] = useState<number>(120);
  const [precioImp, setPrecioImp] = useState<number>(18000);
  const [vidaUtilImp, setVidaUtilImp] = useState<number>(4000);
  const [mantImp, setMantImp] = useState<number>(2.5);
  const [tarifaManualImp, setTarifaManualImp] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Reiniciar valores al abrir
  useEffect(() => {
    if (isOpen) {
      if (tipo === 'material' && material) {
        setNombreMat(material.nombre);
        setCostoMat(material.costoPorUnidad);
        setMermaMat(toPercent(material.mermaPorcentaje));
      } else if (tipo === 'impresora' && impresora) {
        setNombreImp(impresora.nombre);
        setPotenciaImp(impresora.potenciaPromedioW);
        setPrecioImp(impresora.precioCompra);
        setVidaUtilImp(impresora.vidaUtilHoras);
        setMantImp(impresora.mantenimientoPorHora);
        setTarifaManualImp(
          impresora.tarifaHoraManual !== undefined ? String(impresora.tarifaHoraManual) : ''
        );
      }
    }
  }, [isOpen, tipo, material, impresora]);

  // Cierre con Escape y clic afuera
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (tipo === 'material' && material && onGuardarMaterial) {
        const matActualizado: MaterialConfig = {
          ...material,
          nombre: nombreMat.trim() || material.nombre,
          costoPorUnidad: Math.max(0, Number(costoMat) || 0),
          mermaPorcentaje: fromPercent(Math.max(0, Math.min(50, Number(mermaMat) || 0)))
        };
        await onGuardarMaterial(matActualizado);
      } else if (tipo === 'impresora' && impresora && onGuardarImpresora) {
        const impActualizada: ImpresoraConfig = {
          ...impresora,
          nombre: nombreImp.trim() || impresora.nombre,
          potenciaPromedioW: Math.max(1, Number(potenciaImp) || 1),
          precioCompra: Math.max(0, Number(precioImp) || 0),
          vidaUtilHoras: Math.max(1, Number(vidaUtilImp) || 1),
          mantenimientoPorHora: Math.max(0, Number(mantImp) || 0),
          tarifaHoraManual:
            tarifaManualImp.trim() === ''
              ? undefined
              : Math.max(0, Number(tarifaManualImp) || 0)
        };
        await onGuardarImpresora(impActualizada);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-40 top-full mt-2 left-0 sm:right-0 sm:left-auto w-80 sm:w-96 bg-white border-2 border-[#1B4D3E] rounded-2xl shadow-2xl p-4 text-[#2B2B2B] animate-in fade-in zoom-in-95 duration-100"
      onClick={e => e.stopPropagation()}
    >
      {/* Cabecera del Popover */}
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 mb-3">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2E7D32]">
            Edición rápida
          </span>
          <h4 className="text-xs font-extrabold text-[#1B4D3E] uppercase font-mono">
            {tipo === 'material' ? 'Ajustar Material' : 'Ajustar Impresora'}
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          title="Cerrar (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleGuardar} className="flex flex-col gap-3 text-xs">
        {tipo === 'material' && material && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700 font-mono">Nombre</label>
              <input
                type="text"
                value={nombreMat}
                onChange={e => setNombreMat(e.target.value)}
                className="w-full bg-[#F7F5F0] border border-gray-300 rounded-lg p-2 font-bold text-[#1B4D3E] focus:bg-white focus:outline-none focus:border-[#1B4D3E]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700 font-mono">
                  Costo ({material.tecnologia === 'FDM' ? '$/kg' : '$/Litro'})
                </label>
                <div className="flex items-center bg-[#F7F5F0] border border-gray-300 rounded-lg px-2 py-1.5 focus-within:bg-white focus-within:border-[#1B4D3E]">
                  <span className="text-gray-400 font-mono text-xs mr-1">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={costoMat}
                    onChange={e => setCostoMat(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full font-mono font-bold text-right text-xs focus:outline-none bg-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700 font-mono">Merma (%)</label>
                <div className="flex items-center bg-[#F7F5F0] border border-gray-300 rounded-lg px-2 py-1.5 focus-within:bg-white focus-within:border-[#1B4D3E]">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={mermaMat}
                    onChange={e => setMermaMat(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                    className="w-full font-mono font-bold text-right text-xs focus:outline-none bg-transparent"
                    required
                  />
                  <span className="text-gray-500 font-mono text-xs ml-1">%</span>
                </div>
              </div>
            </div>
          </>
        )}

        {tipo === 'impresora' && impresora && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700 font-mono">Nombre</label>
              <input
                type="text"
                value={nombreImp}
                onChange={e => setNombreImp(e.target.value)}
                className="w-full bg-[#F7F5F0] border border-gray-300 rounded-lg p-2 font-bold text-[#1B4D3E] focus:bg-white focus:outline-none focus:border-[#1B4D3E]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700 font-mono">Potencia (W)</label>
                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={potenciaImp}
                  onChange={e => setPotenciaImp(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full bg-[#F7F5F0] border border-gray-300 rounded-lg p-1.5 font-mono font-bold text-right focus:bg-white focus:outline-none focus:border-[#1B4D3E]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700 font-mono">Precio compra ($)</label>
                <input
                  type="number"
                  min="0"
                  value={precioImp}
                  onChange={e => setPrecioImp(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-[#F7F5F0] border border-gray-300 rounded-lg p-1.5 font-mono font-bold text-right focus:bg-white focus:outline-none focus:border-[#1B4D3E]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700 font-mono">Vida útil (horas)</label>
                <input
                  type="number"
                  min="100"
                  value={vidaUtilImp}
                  onChange={e => setVidaUtilImp(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full bg-[#F7F5F0] border border-gray-300 rounded-lg p-1.5 font-mono font-bold text-right focus:bg-white focus:outline-none focus:border-[#1B4D3E]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700 font-mono">Mant. ($/hora)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={mantImp}
                  onChange={e => setMantImp(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-[#F7F5F0] border border-gray-300 rounded-lg p-1.5 font-mono font-bold text-right focus:bg-white focus:outline-none focus:border-[#1B4D3E]"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-600 font-mono">
                Tarifa manual opcional ($/h - anula amortización)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Vacío para cálculo automático"
                value={tarifaManualImp}
                onChange={e => setTarifaManualImp(e.target.value)}
                className="w-full bg-[#F7F5F0] border border-gray-300 rounded-lg p-1.5 font-mono font-bold text-right focus:bg-white focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>
          </>
        )}

        {/* Botones de Acción */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onAbrirAjustesCompletos(tipo === 'material' ? 'materiales' : 'impresoras');
            }}
            className="text-[11px] font-bold text-[#1B4D3E] hover:underline flex items-center gap-1 cursor-pointer"
          >
            Abrir ajustes completos <ExternalLink size={12} />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-300 hover:bg-gray-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#1B4D3E] hover:bg-[#2E7D32] text-white flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
            >
              <Save size={13} /> {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
