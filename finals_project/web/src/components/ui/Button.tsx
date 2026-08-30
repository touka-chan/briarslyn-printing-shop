"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: "primary" | "secondary" | "ghost" | "danger";
 size?: "sm" | "md" | "lg";
 loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
 ({ variant = "primary", size = "md", loading, disabled, children, className = "", ...props }, ref) => {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
   primary: "text-printflow-on-primary bg-printflow-primary hover:bg-printflow-primary-container focus:ring-printflow-primary",
   secondary: "text-printflow-on-surface bg-printflow-surface-container border border-printflow-outline-variant hover:bg-printflow-surface-container-high focus:ring-printflow-primary",
   ghost: "text-printflow-on-surface-variant hover:bg-printflow-surface-container-high focus:ring-printflow-primary",
   danger: "text-white bg-printflow-error hover:bg-printflow-error/90 focus:ring-printflow-error",
  };

  const sizeClasses = {
   sm: "px-3 py-1.5 text-xs gap-1.5",
   md: "px-5 py-2.5 text-sm gap-2",
   lg: "px-6 py-3 text-base gap-2",
  };

  return (
   <button
    ref={ref}
    className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    disabled={disabled || loading}
    {...props}
   >
    {loading && (
     <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
     </svg>
    )}
    {children}
   </button>
  );
 }
);

Button.displayName = "Button";