
import React, { useState, useRef, useEffect, useContext } from 'react';
import { cn } from '../../lib/utils';

interface DropdownMenuContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType>({
  open: false,
  setOpen: () => {},
});

export const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = ({ children, asChild, className }: { children?: React.ReactNode, asChild?: boolean, className?: string }) => {
  const { open, setOpen } = useContext(DropdownMenuContext);
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      className: cn((children.props as any).className, className)
    });
  }

  return (
    <button onClick={handleClick} className={cn("outline-none", className)}>
      {children}
    </button>
  );
};

export const DropdownMenuContent = ({ 
  children, 
  className, 
  align = 'center',
  side = 'bottom'
}: { 
  children?: React.ReactNode, 
  className?: string, 
  align?: 'start' | 'center' | 'end',
  side?: 'top' | 'right' | 'bottom' | 'left'
}) => {
  const { open, setOpen } = useContext(DropdownMenuContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open, setOpen]);

  if (!open) return null;

  let positionStyles = "";
  if (side === 'right') {
    positionStyles = "left-full bottom-0 ml-2 mb-[-10px]"; // Specific tweak for sidebar bottom
  } else {
    positionStyles = "right-0 mt-2 origin-top-right";
  }

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        positionStyles,
        className
      )}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void }> = ({ 
  children, 
  className, 
  onClick 
}) => {
  const { setOpen } = useContext(DropdownMenuContext);

  return (
    <div
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
        setOpen(false);
      }}
    >
      {children}
    </div>
  );
};

export const DropdownMenuLabel = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>
    {children}
  </div>
);

export const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
);
