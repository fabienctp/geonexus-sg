
import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

export type ToastType = 'default' | 'success' | 'destructive' | 'info';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastType;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (props: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children?: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, title, description, variant };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      dismiss(id);
    }, 3000);
  }, [dismiss]);

  const value = useMemo(() => ({
    toasts,
    toast,
    dismiss
  }), [toasts, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
