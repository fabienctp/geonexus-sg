import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hexToTailwindHsl(hex: string): string {
  // Remove hash if present
  hex = hex.replace(/^#/, '');
  
  // Parse r, g, b
  let r = 0, g = 0, b = 0;
  
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  // Convert to values 0-1
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  // Output strictly in format "H S% L%" as expected by the CSS variables in index.html
  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

export function getDirtyFields(original: any, current: any, labelMap?: Record<string, string>): string[] {
  if (!original && !current) return [];
  const safeOrig = original || {};
  const safeCurr = current || {};

  const changes: string[] = [];
  const keys = new Set([...Object.keys(safeOrig), ...Object.keys(safeCurr)]);
  
  keys.forEach(key => {
    // Skip internal keys if necessary
    const v1 = safeOrig[key];
    const v2 = safeCurr[key];
    
    // Deep comparison using JSON.stringify for simplicity
    if (JSON.stringify(v1) !== JSON.stringify(v2)) {
       // Ignore empty string vs undefined/null discrepancies
       const isEmpty1 = v1 === '' || v1 === null || v1 === undefined;
       const isEmpty2 = v2 === '' || v2 === null || v2 === undefined;
       if (isEmpty1 && isEmpty2) return;

       changes.push(labelMap?.[key] || key);
    }
  });
  return changes;
}