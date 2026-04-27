import React from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Cari...' }) {
  return (
    <div className="px-4 py-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-muted rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}