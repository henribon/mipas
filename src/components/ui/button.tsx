import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonProps = {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  tooltip?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'plain';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  active?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

const VARIANTES = {
  primary: 'bg-coral text-white shadow-md hover:opacity-85',
  secondary: 'bg-cream text-ink shadow-md hover:opacity-80',
  ghost: 'bg-transparent text-sub hover:text-ink',
  outline: 'bg-surface text-coral border border-line shadow-sm hover:bg-cream',
  danger: 'bg-transparent text-[#FF6B5B] hover:bg-[#FF6B5B]/10',
  plain: 'bg-transparent text-coral hover:opacity-70',
};

const TAMANHOS = {
  xs: 'px-3 py-1.5 text-[11.5px] gap-1',
  sm: 'px-4 py-2 text-[12.5px] gap-1.5',
  md: 'px-6 py-3 text-[14px] gap-1.5',
  lg: 'px-8 py-4 text-[15px] gap-2',
  icon: 'w-9 h-9 p-0 gap-0',
};

export function Button({
  children,
  icon,
  tooltip,
  variant = 'primary',
  size = 'md',
  active = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'group relative inline-flex items-center justify-center',
        'rounded-3xl font-semibold transition',
        'disabled:opacity-45 disabled:cursor-default',
        disabled ? '' : 'cursor-pointer',
        VARIANTES[variant],
        TAMANHOS[size],
        active && 'ring-1 ring-coral',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {tooltip && !disabled && (
        <span
          className={cn(
            'pointer-events-none absolute -bottom-full left-1/2 z-50 -translate-x-1/2',
            'rounded-md px-2 py-1.5 text-[11px] font-medium whitespace-nowrap',
            'bg-cream text-ink shadow-lg',
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
