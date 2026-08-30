"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";

interface DropdownItem {
 label: string;
 value: string;
 icon?: ReactNode;
 disabled?: boolean;
 danger?: boolean;
}

interface DropdownProps {
 trigger: ReactNode;
 items: DropdownItem[];
 onSelect: (value: string) => void;
 placeholder?: string;
 value?: string;
 className?: string;
}

export function Dropdown({ trigger, items, onSelect, placeholder, value, className = "" }: DropdownProps) {
 const [isOpen, setIsOpen] = useState(false);
 const dropdownRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
   if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
    setIsOpen(false);
   }
  }

  if (isOpen) {
   document.addEventListener("mousedown", handleClickOutside);
  }
  return () => document.removeEventListener("mousedown", handleClickOutside);
 }, [isOpen]);

 const selectedItem = items.find((item) => item.value === value);

 return (
  <div className="relative" ref={dropdownRef}>
   <button
    onClick={() => setIsOpen(!isOpen)}
    className={`btn-secondary w-full justify-between ${className}`}
    aria-haspopup="true"
    aria-expanded={isOpen}
   >
    <span>{selectedItem?.label || placeholder || "Select..."}</span>
    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
   </button>

   {isOpen && (
    <div className="dropdown-menu" role="menu">
     {items.map((item) => (
      <button
       key={item.value}
       onClick={() => {
        onSelect(item.value);
        setIsOpen(false);
       }}
       disabled={item.disabled}
       className={`dropdown-item w-full text-left ${item.danger ? "text-printflow-error" : ""} ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
       role="menuitem"
      >
       {item.icon && <span>{item.icon}</span>}
       <span className="flex-1">{item.label}</span>
       {value === item.value && <Check className="w-4 h-4 text-printflow-primary" />}
      </button>
     ))}
    </div>
   )}
  </div>
 );
}