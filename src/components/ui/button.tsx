import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonProps = {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  tooltip?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const VARIANTES = {
  primary: 'bg-coral text-white hover:opacity-85',
  secondary: 'bg-cream text-ink hover:opacity-80',
  ghost: 'bg-transparent text-coral border border-line hover:bg-cream',
};

export function Button({
  children,
  icon,
  tooltip,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'group relative inline-flex items-center justify-center gap-1.5',
        'rounded-3xl px-8 py-4 font-semibold shadow-md transition',
        'disabled:opacity-50 disabled:cursor-default',
        disabled ? '' : 'cursor-pointer',
        VARIANTES[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {tooltip && !disabled && (
        <span
          className={cn(
            'pointer-events-none absolute -bottom-full left-1/2 -translate-x-1/2',
            'rounded-md px-2 py-2 text-xs font-medium whitespace-nowrap',
            'bg-paper/90 text-ink shadow-lg',
            'opacity-0 transition-opacity group-hover:opacity-100',
          )}
        >
          {tooltip}
        </span>
      )}
    </button>
  );
}

export default Button;
