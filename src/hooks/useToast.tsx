import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  success: (msg: string, duration?: number) => void;
  error: (msg: string, action?: ToastAction, duration?: number) => void;
  warning: (msg: string, duration?: number) => void;
  info: (msg: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    
    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 4000);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((msg: string, duration = 3000) => addToast({ type: 'success', message: msg, duration }), [addToast]);
  const error = useCallback((msg: string, action?: ToastAction, duration = 4000) => addToast({ type: 'error', message: msg, action, duration }), [addToast]);
  const warning = useCallback((msg: string, duration = 4000) => addToast({ type: 'warning', message: msg, duration }), [addToast]);
  const info = useCallback((msg: string, duration = 4000) => addToast({ type: 'info', message: msg, duration }), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, success, error, warning, info, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
