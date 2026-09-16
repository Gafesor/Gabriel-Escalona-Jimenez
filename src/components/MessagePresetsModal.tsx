import React, { useState } from 'react';
import { Copy, Check, MessageSquare, Briefcase, FileText, Zap, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MessagePresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  operatorName: string;
  folio: string;
  items: any[];
  total: number;
}

const formatMXN = (val: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(val);
};

export const MessagePresetsModal: React.FC<MessagePresetsModalProps> = ({
  isOpen,
  onClose,
  clientName,
  operatorName,
  folio,
  items,
  total
}) => {
  const [activeTab, setActiveTab] = useState<'friendly' | 'detailed' | 'compact' | 'formal'>('friendly');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const resolvedClient = clientName.trim() || 'Cliente';
  const resolvedFolio = folio || 'BORRADOR';
  const resolvedOperator = operatorName.trim() || 'Asesor Técnico';
  const dateStr = format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });

  // Generate presets
  const getFriendlyMessage = () => {
    let msg = `*¡Hola, ${resolvedClient}!* 👋 Espero que te encuentres muy bien.\n\n`;
    msg += `Te comparto el presupuesto para la manufactura de tus piezas en 3D bajo el folio *${resolvedFolio}*:\n\n`;
    
    items.forEach(item => {
      const spec = item.itemType === 'hardware' ? 'Herraje/Accesorio' : `${item.weightInfo}g | ${item.timeInfo}h`;
      msg += `• *${item.itemName}* _(${item.profileName})_ \n  ${item.quantity} pza(s) x ${formatMXN(item.unitPrice)} ➔ *${formatMXN(item.totalPrice)}*\n`;
    });

    msg += `\n💵 *Total de la Cotización:* *${formatMXN(total)}*\n\n`;
    msg += `El tiempo est. de entrega se calcula tras confirmar el pedido. Quedo a tus órdenes para afinar cualquier detalle del material o diseño, ¿cómo lo ves? ¡Muchas gracias! ✨`;
    return msg;
  };

  const getDetailedMessage = () => {
    let msg = `⚙️ *CUBEUP³ - DETALLE DE EVALUACIÓN DE IMPRESIÓN 3D* ⚙️\n`;
    msg += `===============================\n`;
    msg += `*Folio:* \`${resolvedFolio}\`\n`;
    msg += `*Cliente:* ${resolvedClient}\n`;
    msg += `*Asesor:* ${resolvedOperator}\n`;
    msg += `*Fecha:* ${dateStr}\n`;
    msg += `===============================\n\n`;
    msg += `📍 *DESGLOSE DE SERVICIOS ADITIVOS:*\n\n`;

    items.forEach((item, idx) => {
      msg += `${idx + 1}. *[${item.itemType === 'hardware' ? 'HARDWARE' : 'PIEZA 3D'}] ${item.itemName}*\n`;
      msg += `   • Cantidad: ${item.quantity} Unidad(es)\n`;
      msg += `   • Perfil técnico: ${item.profileName}\n`;
      if (item.itemType !== 'hardware') {
        msg += `   • Consumo de material: ${item.weightInfo} gramos por pza\n`;
        msg += `   • Tiempo de máquina: ${item.timeInfo} horas por pza\n`;
      }
      msg += `   • Costo Unitario: ${formatMXN(item.unitPrice)}\n`;
      msg += `   • Subtotal: *${formatMXN(item.totalPrice)}*\n\n`;
    });

    msg += `===============================\n`;
    msg += `💰 *PRECIO NETO FINAL ACUMULADO:* *${formatMXN(total)}* MXN\n`;
    msg += `===============================\n\n`;
    msg += `_Este presupuesto es calculado en tiempo real basándose estrictamente en los perfiles de rebanado del taller y los herrajes adicionales añadidos a la orden._`;
    return msg;
  };

  const getCompactMessage = () => {
    let msg = `⚡ *CubeUp³ - Cotización Rápida* 📝\n`;
    msg += `*Cliente:* ${resolvedClient} | *Folio:* \`${resolvedFolio}\`\n\n`;

    items.forEach(item => {
      msg += `• [${item.quantity}x] ${item.itemName} (${item.profileName}) ➔ *${formatMXN(item.totalPrice)}*\n`;
    });

    msg += `\n*TOTAL NETO:* *${formatMXN(total)}*`;
    return msg;
  };

  const getFormalMessage = () => {
    let msg = `*PROPUESTA DE SERVICIOS DE MANUFACTURA ADITIVA Y DISEÑO3D*\n`;
    msg += `*CubeUp³ Inteligencia Compartida*\n`;
    msg += `Folio del Presupuesto: ${resolvedFolio}\n`;
    msg += `Fecha de Emisión: ${dateStr}\n\n`;
    msg += `*Estimado(a) ${resolvedClient},*\n`;
    msg += `De acuerdo con su requerimiento técnico y los parámetros evaluados por nuestro laboratorio de impresión, presentamos el desglose oficial del costo del servicio:\n\n`;

    items.forEach((item, idx) => {
      msg += `*Concepto ${idx + 1}:* ${item.itemName}\n`;
      msg += `- Cantidad: ${item.quantity} pieza(s)\n`;
      msg += `- Especificación de Material: Perfil ${item.profileName}\n`;
      msg += `- Importe Acumulado: ${formatMXN(item.totalPrice)} (moneda nacional)\n\n`;
    });

    msg += `*RESUMEN FINANCIERO GENERAL:*\n`;
    msg += `• *Importe Total Cotizado:* *${formatMXN(total)}* MXN\n`;
    msg += `• *Asesor Responsable:* ${resolvedOperator}\n\n`;
    msg += `*Términos y Condiciones Generales:*\n`;
    msg += `1. Validez comercial de esta cotización: 15 días calendario.\n`;
    msg += `2. Los plazos de impresión se reprogramarán formalmente al liquidar el 50% de anticipo estipulado.\n\n`;
    msg += `Atentamente,\n`;
    msg += `*Departamento de Ingeniería y Manufactura CubeUp³*`;
    return msg;
  };

  const getActiveText = () => {
    switch (activeTab) {
      case 'friendly': return getFriendlyMessage();
      case 'detailed': return getDetailedMessage();
      case 'compact': return getCompactMessage();
      case 'formal': return getFormalMessage();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200" id="presets-modal-overlay" onClick={(e) => {
      if ((e.target as HTMLElement).id === 'presets-modal-overlay') onClose();
    }}>
      <div className="bg-white rounded-2xl border border-emerald-150 max-w-2xl w-full flex flex-col shadow-2xl relative overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#059669] text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">Presets de Mensajes para Clientes</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E5E7EB] bg-gray-50 overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setActiveTab('friendly')}
            className={`flex-1 min-w-[120px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 transition-all ${activeTab === 'friendly' ? 'border-[#059669] text-[#059669] bg-white' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
          >
            <MessageSquare size={14} /> WhatsApp Amigable
          </button>
          <button 
            onClick={() => setActiveTab('detailed')}
            className={`flex-1 min-w-[120px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 transition-all ${activeTab === 'detailed' ? 'border-[#059669] text-[#059669] bg-white' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
          >
            <FileText size={14} /> Detallado 3D
          </button>
          <button 
            onClick={() => setActiveTab('compact')}
            className={`flex-1 min-w-[120px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 transition-all ${activeTab === 'compact' ? 'border-[#059669] text-[#059669] bg-white' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
          >
            <Zap size={14} /> Síntesis Rápida
          </button>
          <button 
            onClick={() => setActiveTab('formal')}
            className={`flex-1 min-w-[120px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 transition-all ${activeTab === 'formal' ? 'border-[#059669] text-[#059669] bg-white' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
          >
            <Briefcase size={14} /> Presupuesto Formal
          </button>
        </div>

        {/* Preview Area */}
        <div className="p-6 flex-1 overflow-y-auto bg-[#F9FAFB]">
          <div className="mb-3 flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 font-bold">Vista previa del mensaje (Editable):</span>
            <span className="text-[10px] font-mono text-gray-500 uppercase">{items.length} piezas listas</span>
          </div>
          <div className="relative border border-[#D1D5DB] bg-white rounded-xl shadow-inner overflow-hidden">
            <textarea 
              value={getActiveText()}
              readOnly
              className="w-full p-4 text-xs font-mono text-gray-800 bg-transparent h-80 outline-none border-none resize-none leading-relaxed select-all"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-[#E5E7EB] flex items-center justify-between gap-3 shrink-0">
          <p className="text-[10px] text-gray-400 font-serif leading-tight max-w-[50%]">
            Puedes copiar este mensaje y pegarlo directamente en el chat con tu cliente o enviarlo en un correo electrónico.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-[#D1D5DB] text-gray-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors"
            >
              Cerrar
            </button>
            <button 
              onClick={handleCopy}
              className={`px-5 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md ${copied ? 'bg-emerald-800 text-white' : 'bg-[#059669] hover:bg-[#03704e] text-white'}`}
            >
              {copied ? (
                <>
                  <Check size={14} /> Copiado con éxito
                </>
              ) : (
                <>
                  <Copy size={14} /> Copiar Mensaje
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
