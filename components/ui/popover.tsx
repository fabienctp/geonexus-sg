
import React, { useState, useRef, useEffect, useContext, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

interface PopoverContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}

const PopoverContext = React.createContext<PopoverContextType>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null }
});

export const Popover: React.FC<{ children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void, className?: string }> = ({ children, open: controlledOpen, onOpenChange, className }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  
  const setOpen = (newOpen: boolean | ((prev: boolean) => boolean)) => {
    if (!isControlled) {
       setInternalOpen(newOpen);
    }
    if (onOpenChange) {
      onOpenChange(typeof newOpen === 'function' ? newOpen(open) : newOpen);
    }
  };

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className={cn("relative inline-block", className)}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger = ({ children, asChild, className }: { children?: React.ReactNode, asChild?: boolean, className?: string }) => {
  const { open, setOpen, triggerRef } = useContext(PopoverContext);
  
  const handleClick = (e: React.MouseEvent) => {
    setOpen(!open);
  };

  // Function to merge refs
  const setRef = (element: HTMLElement | null) => {
    triggerRef.current = element;
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      className: cn((children.props as any).className, className),
      'aria-expanded': open,
      ref: setRef
    });
  }

  return (
    <button 
      ref={setRef}
      onClick={handleClick} 
      className={cn("outline-none", className)} 
      aria-expanded={open}
    >
      {children}
    </button>
  );
};

export const PopoverContent = ({ 
  children, 
  className, 
  align = 'start',
  sideOffset = 4
}: { 
  children?: React.ReactNode, 
  className?: string, 
  align?: 'start' | 'center' | 'end',
  sideOffset?: number
}) => {
  const { open, setOpen, triggerRef } = useContext(PopoverContext);
  const contentRef = useRef<HTMLDivElement>(null);
  // Coords now supports both top and bottom positioning
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    opacity: number;
    transformOrigin: string;
  }>({ top: 0, left: 0, width: 0, maxHeight: 300, opacity: 0, transformOrigin: 'top' });

  // Handle Click Outside (Portal-aware)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!open) return;
      const target = event.target as Node;
      
      // If click is inside content or trigger, ignore
      if (contentRef.current && contentRef.current.contains(target)) return;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      
      setOpen(false);
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen, triggerRef]);

  // Positioning Logic
  useLayoutEffect(() => {
    if (open && triggerRef.current && contentRef.current) {
      const updatePosition = () => {
        const triggerRect = triggerRef.current!.getBoundingClientRect();
        const contentHeight = contentRef.current!.scrollHeight; 
        
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Horizontal Positioning (Fixed Left)
        let left = triggerRect.left;
        // If overflowing right, align end
        if (left + triggerRect.width > viewportWidth - 10) {
             // Not fully implemented alignment logic for X, assuming width matches trigger for now
             // or basic bounds checking could be added here.
        }
        
        const width = triggerRect.width;
        
        // Vertical Positioning
        const spaceBelow = viewportHeight - triggerRect.bottom - 10; // 10px buffer
        const spaceAbove = triggerRect.top - 10;

        let top: number | undefined = triggerRect.bottom + sideOffset;
        let bottom: number | undefined = undefined;
        let maxHeight = spaceBelow;
        let transformOrigin = 'top';

        // Flip Logic: If content is taller than space below AND there is more space above
        if (contentHeight > spaceBelow && spaceAbove > spaceBelow) {
           // Flip to Above
           // We anchor to bottom: The bottom of the popover is at the top of the trigger
           // CSS Bottom = ViewportHeight - TriggerTop + Offset
           bottom = viewportHeight - triggerRect.top + sideOffset;
           top = undefined;
           
           maxHeight = spaceAbove;
           transformOrigin = 'bottom';
        }

        setCoords({
          top,
          bottom,
          left,
          width,
          maxHeight,
          opacity: 1,
          transformOrigin
        });
      };

      // Initial calc
      updatePosition();
      
      // Re-calculate on scroll/resize to stick to trigger
      // Use capture for scroll to handle internal scrolling containers
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
         window.removeEventListener('resize', updatePosition);
         window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
       if (!open) setCoords(prev => ({ ...prev, opacity: 0 }));
    }
  }, [open, sideOffset, align]);

  if (!open) return null;

  // Render via Portal to body to escape overflow clipping
  // Using position: fixed ensures we stay relative to viewport, simplifying calculation
  return createPortal(
    <div
      ref={contentRef}
      style={{
        position: 'fixed',
        top: coords.top,
        bottom: coords.bottom,
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
        opacity: coords.opacity,
        transformOrigin: coords.transformOrigin,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column'
      }}
      className={cn(
        "rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95",
        className
      )}
    >
      {children}
    </div>,
    document.body
  );
};
