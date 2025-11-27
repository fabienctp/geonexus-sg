import React from 'react';
import { useToast } from './use-toast';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Toaster: React.FC = () => {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-md p-4 pointer-events-none">
      {toasts.map((t) => {
        const variant = t.variant || 'default';
        
        const styles = {
            default: "bg-background/80 backdrop-blur-md text-foreground border-border/50",
            success: "bg-green-500/85 backdrop-blur-md text-white border-green-500/30",
            destructive: "bg-destructive/85 backdrop-blur-md text-destructive-foreground border-destructive/30",
            info: "bg-blue-500/85 backdrop-blur-md text-white border-blue-500/30"
        };

        const variantClass = styles[variant as keyof typeof styles] || styles.default;

        return (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all animate-in slide-in-from-right-full duration-300",
            variantClass
          )}
        >
          <div className="mt-0.5 shrink-0">
            {variant === 'destructive' ? <AlertCircle className="h-5 w-5" /> :
             variant === 'success' ? <CheckCircle className="h-5 w-5" /> :
             <Info className={cn("h-5 w-5", variant === 'info' ? "text-white" : "text-primary")} />}
          </div>
          
          <div className="grid gap-1">
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            {t.description && <div className="text-sm opacity-90">{t.description}</div>}
          </div>

          <button
            onClick={() => dismiss(t.id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-50 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )})}
    </div>
  );
};