import React from 'react';
import { cn } from '@/lib/utils';

const LUPA = (
  <svg className="pointer-events-none absolute left-4 h-4 w-4 fill-sub" aria-hidden="true" viewBox="0 0 24 24">
    <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
  </svg>
);

export type SearchBarProps = {
  value?: string;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
  className?: string;
};

export function SearchBar({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Buscar',
  autoFocus,
  readOnly,
  onClick,
  className = '',
}: SearchBarProps) {
  return (
    <div
      onClick={onClick}
      className={cn('group relative flex items-center leading-7', readOnly && 'cursor-pointer', className)}
    >
      {LUPA}
      <input
        type="search"
        value={value}
        readOnly={readOnly}
        autoFocus={autoFocus}
        onChange={e => onChange?.(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit?.(); }}
        placeholder={placeholder}
        className={cn(
          'h-10 w-full rounded-lg border-2 border-transparent bg-cream pl-10 pr-4 leading-7',
          'text-[15px] font-semibold text-ink outline-none',
          'placeholder:font-medium placeholder:text-sub',
          'shadow-[0_0_5px_var(--busca-brilho),0_0_0_10px_var(--busca-halo)]',
          'transition duration-300 focus:border-coral',
          readOnly && 'cursor-pointer',
        )}
      />
    </div>
  );
}

export default SearchBar;
