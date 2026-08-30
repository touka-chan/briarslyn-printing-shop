"use client";

import { useEffect, ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
 isOpen: boolean;
 onClose: () => void;
 title: string;
 description?: string;
 icon?: ReactNode;
 children: ReactNode;
 footer?: ReactNode;
 size?: "sm" | "md" | "lg" | "xl";
 closeOnOverlayClick?: boolean;
}

export function Modal({
 isOpen,
 onClose,
 title,
 description,
 icon,
 children,
 footer,
 size = "md",
 closeOnOverlayClick = true,
}: ModalProps) {
 useEffect(() => {
  if (!isOpen) return;
  document.body.style.overflow = "hidden";
  const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
  window.addEventListener("keydown", onEsc);
  return () => {
   document.body.style.overflow = "unset";
   window.removeEventListener("keydown", onEsc);
  };
 }, [isOpen, onClose]);

 if (!isOpen) return null;

 const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
 };

 return (
  <div className="modal-overlay" onClick={closeOnOverlayClick ? onClose : undefined}>
   <div
    className={`modal-content ${sizeClasses[size]}`}
    onClick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
   >
    <div className="modal-header">
     <div className="flex gap-3 min-w-0 flex-1">
      {icon && <div className="w-9 h-9 rounded-lg bg-printflow-primary-fixed/20 text-printflow-primary flex items-center justify-center shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
       <h2 id="modal-title" className="text-[17px] font-semibold tracking-tight text-printflow-on-surface leading-5">{title}</h2>
       {description && <p className="text-[13px] leading-4 text-printflow-on-surface-variant mt-1">{description}</p>}
      </div>
     </div>
     <button
      onClick={onClose}
      className="shrink-0 w-8 h-8 rounded-full bg-printflow-surface-container hover:bg-printflow-surface-container-high text-printflow-on-surface-variant hover:text-printflow-on-surface flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-printflow-primary focus:ring-offset-2"
      aria-label="Close modal"
     >
      <X className="w-4 h-4" />
     </button>
    </div>
    <div className="modal-body">
     {children}
    </div>
    {footer && (
     <div className="modal-footer">
      {footer}
     </div>
    )}
   </div>
  </div>
 );
}
