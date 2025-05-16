
"use client"

import type { ElementType } from 'react';
import React, { useState, useEffect, useRef } from 'react';
import type { LucideProps } from 'lucide-react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DropdownSearchItem {
  id: string;
  name: string;
}

interface DropdownSearchProps {
  items: DropdownSearchItem[];
  selectedItem: DropdownSearchItem | null;
  onSelectItem: (item: DropdownSearchItem | null) => void;
  placeholder?: string;
  icon?: ElementType<LucideProps>;
  label?: string;
  id?: string;
  required?: boolean;
}

export function DropdownSearch({
  items,
  selectedItem,
  onSelectItem,
  placeholder = "اختر...",
  icon: Icon,
  label,
  id,
  required
}: DropdownSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (item: DropdownSearchItem) => {
    onSelectItem(item);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectItem(null);
    setIsOpen(false);
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">{label} {required && <span className="text-destructive">*</span>}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />}
        <Input
          id={id}
          type="text"
          value={selectedItem ? selectedItem.name : ''}
          onClick={() => setIsOpen(!isOpen)}
          readOnly
          placeholder={placeholder}
          className={cn("w-full cursor-pointer", Icon ? "ps-10" : "ps-3", selectedItem && "pe-10")}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        />
        <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center">
          {selectedItem && (
            <Button variant="ghost" size="icon" className="h-7 w-7 me-1" onClick={handleClear} aria-label="Clear selection">
              <X className="h-4 w-4" />
            </Button>
          )}
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full ps-10"
                autoFocus
              />
            </div>
          </div>
          <ScrollArea className="max-h-60">
            {filteredItems.length > 0 ? (
              filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                    selectedItem?.id === item.id && "bg-accent text-accent-foreground"
                  )}
                  role="option"
                  aria-selected={selectedItem?.id === item.id}
                >
                  {item.name}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted