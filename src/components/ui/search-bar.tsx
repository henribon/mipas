import React from 'react';
import { cn } from '@/lib/utils';

const LUPA = (
  <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none w-5 fill-sub transition">
    <path d="M16.72 17.78a.75.75 0 1 0 1.06-1.06l-1.06 1.06ZM9 14.5A5.5 5.5 0 0 1 3.5 9H2a7 7 0 0 0 7 7v-1.5ZM3.5 9A5.5 5.5 0 0 1 9 3.5V2a7 7 0 0 0-7 7h1.5ZM9 3.5A5.5 5.5 0 0 1 14.5 9H16a7 7 0 0 0-7-7v1.5Zm3.89 10.45 3.83 3.83 1.06-1.06-3.83-3.83-1.06 1.06ZM14.5 9a5.48 5.48 0 0 1-1.61 3.89l1.06 1.06A6.98 6.98 0 0 0 16 9h-1.5Zm-1.61 3.89A5.48 5.48 0 0 1 9 14.5V16a6.98 6.98 0 0 0 4.95-2.05l-1.06-1.06Z" />
  </svg>
);

export type SearchBarProps = {
  value?: string;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  botao?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
  className?: string;
};

export function SearchBar({
  value = '',
  onChange,
  onSubmit,
  placeholder = '',
  botao = 'Buscar',
  autoFocus,
  readOnly,
  onClick,
  className = '',
}: SearchBarProps) {
  return (
    <div onClick={onClick} className={cn('flex rounded-lg overflow-hidden', readOnly && 'cursor-pointer', className)}>
      <div className="flex w-10 items-center justify-center border-r border-line bg-surface p-5">
        {LUPA}
      </div>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        autoFocus={autoFocus}
        onChange={e => onChange?.(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit?.(); }}
        placeholder={placeholder}
        className={cn(
          'w-full min-w-0 bg-surface pl-2 text-base font-semibold text-ink outline-0',
          'placeholder:text-sub placeholder:font-medium',
          readOnly && 'cursor-pointer',
        )}
      />
      {onSubmit && (
        <input
          type="button"
          value={botao}
          onClick={onSubmit}
          className="cursor-pointer bg-coral px-4 font-semibold text-white transition hover:opacity-85"
        />
      )}
    </div>
  );
}

export default SearchBar;
