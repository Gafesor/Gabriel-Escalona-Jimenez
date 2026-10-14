import React, { useState, useEffect } from 'react';
import { Cpu, Plus, Check, X } from 'lucide-react';
import { TallerConfig } from '../lib/tallerConfig';
import { redondearAlPaso } from '../lib/pricing';
import { TicketItem } from '../hooks/useQuoteHistory';

export interface FormHardwareProps {
  config: TallerConfig;
  globalMargin: number;
  editingItem: TicketItem | null;
  onAddOrUpdateItem: (item: TicketItem) => void;
  onCancelEdit: () => void;
}

export const FormHardware: React.FC<FormHardwareProps> = ({
  config,
  globalMargin,
  editingItem,
  onAddOrUpdateItem,
  onCancelEdit
}) => {
  const [hwName, setHwName] = useState<string>('');
  const [hwQuantity, setHwQuantity] = useState<number>(1);
  const [hwPrice, setHwPrice] = useState<number | ''>('');

  // Sincronización reactiva con el modo de edición de un insumo de hardware
  useEffect(() => {
    if (editingItem && editingItem.itemType === 'hardware') {
      setHwName(editingItem.itemName);
      setHwQuantity(editingItem.quantity || 1);
      setHwPrice(editingItem.unitCost);
    } else if (!editingItem) {
      setHwName('');
      setHwQuantity(1);
      setHwPrice('');
    }
  }, [editingItem]);

  const isEditing = Boolean(editingItem && editingItem.itemType === 'hardware');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwName.trim() || hwPrice === '') return;

    const qty = Math.max(1, hwQuantity || 1);
    const baseCost = Math.max(0, Number(hwPrice));
    const m = Math.max(0, Math.min(0.90, globalMargin / 100));
    const unitPrice = redondearAlPaso(m < 1 ? baseCost / (1 - m) : baseCost, config.pasoRedondeo);
    const totalPrice = unitPrice * qty;
    const totalCost = baseCost * qty;

    const targetItem: TicketItem = {
      id: editingItem ? editingItem.id : Math.random().toString(36).substring(2, 11),
      itemName: hwName.trim(),
      quantity: qty,
      profileName: 'Hardware / Herrajes',
      weightInfo: 0,
      timeInfo: 0,
      unitCost: baseCost,
      totalCost,
      unitPrice,
      totalPrice,
      itemType: 'hardware',
      calc: undefined
    };

    onAddOrUpdateItem(targetItem);

    if (!editingItem) {
      setHwName('');
      setHwQuantity(1);
      setHwPrice('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-[#82C69E]/60 shadow-sm flex flex-col gap-3">
      <h3 className="text-xs uppercase font-bold text-[#1B4D3E] flex items-center gap-2">
        <Cpu size={15} /> Insumos Extra (Hardware)
      </h3>
      <p className="text-[10px] leading-tight text-gray-500">
        Tornillería, insertos térmicos, empaques o componentes no impresos.
      </p>

      <div className="grid grid-cols-4 gap-2">
        <input
          type="text"
          value={hwName}
          onChange={e => setHwName(e.target.value)}
          placeholder="Ej. Tornillos M3..."
          className="col-span-2 bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
        />
        <input
          type="number"
          min="1"
          step="1"
          value={hwQuantity}
          onChange={e => setHwQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          title="Cantidad"
          placeholder="Cant."
          className="bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-center text-[#1B4D3E] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
        />
        <input
          type="number"
          min="0"
          step="any"
          value={hwPrice}
          onChange={e => setHwPrice(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="$ Unit."
          className="bg-[#F7F5F0] border border-[#82C69E]/80 rounded-lg p-2 text-xs font-bold text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
        />
      </div>

      {isEditing ? (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            type="submit"
            disabled={!hwName.trim() || hwPrice === ''}
            className="w-full bg-[#1B4D3E] text-white py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-1 hover:bg-[#2E7D32] cursor-pointer"
          >
            <Check size={14} /> Guardar
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-1 cursor-pointer"
          >
            <X size={14} /> Cancelar
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={!hwName.trim() || hwPrice === ''}
          className="w-full bg-white border border-[#1B4D3E] text-[#1B4D3E] py-2 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#F0FDF4] transition-all disabled:opacity-50 cursor-pointer"
        >
          <Plus size={14} /> Añadir Insumo
        </button>
      )}
    </form>
  );
};
