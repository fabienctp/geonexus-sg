
import React from 'react';
import { Input } from './ui/input';

export const ColorPicker = ({ color, onChange, disabled }: { color: string, onChange: (c: string) => void, disabled?: boolean }) => (
  <div className="flex items-center gap-2">
    <input 
      type="color" 
      value={color} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      className="h-8 w-8 rounded border p-0 cursor-pointer disabled:opacity-50"
    />
    <Input 
      value={color} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      className="w-24 font-mono text-xs" 
    />
  </div>
);
