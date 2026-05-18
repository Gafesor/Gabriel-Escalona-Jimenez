import React from 'react';
import { useToast, ToastMessage } from '../hooks/useToast';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const { removeToast } = useToast();

  const styles = {
    success: 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]',
    error: 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]',
    warning: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
    info: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]'
  };

  const icons = {
    success: <Check size={18} className="shrink-0 mt-0.5" />,
    error: <X size={18} className="shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={18} className="shrink-0 mt-0.5" />,
    info: <Info size={18} className="shrink-0 mt-0.5" />
  };

  return (
    <div className={`flex items-start gap-3 p-4 border-2 shadow-2xl animate-in slide-in-from-right-full fade-in duration-200 w-80 md:w-96 ${styles[toast.type]}`}>
      {icons[toast.type]}
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-sm font-sans leading-snug">{toast.message}</p>
        {toast.action && (
          <button 
            onClick={() => {
              toast.action!.onClick();
              removeToast(toast.id);
            }}
            className="self-start text-xs font-bold uppercase tracking-widest hover:opacity-80 underline underline-offset-4"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button onClick={() => removeToast(toast.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
