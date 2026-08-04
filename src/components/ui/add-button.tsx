import React from 'react';
import { cn } from '@/lib/utils';

export function AddButton({
  rotulo,
  onClick,
  className = '',
}: {
  rotulo: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={rotulo}
      aria-label={rotulo}
      className={cn(
        'group inline-flex h-9 cursor-pointer items-center gap-0 overflow-hidden',
        'rounded-3xl border border-dashed border-coral/60 bg-transparent pl-2.5 pr-2.5',
        'text-coral transition-all duration-300 hover:border-solid hover:bg-cream hover:pr-3.5',
        className,
      )}
    >
      <span className="text-[17px] leading-none font-bold">+</span>
      <span
        className={cn(
          'max-w-0 overflow-hidden whitespace-nowrap text-[12.5px] font-semibold opacity-0',
          'transition-all duration-300 group-hover:ml-1.5 group-hover:max-w-[190px] group-hover:opacity-100',
          'group-focus-visible:ml-1.5 group-focus-visible:max-w-[190px] group-focus-visible:opacity-100',
        )}
      >
        {rotulo}
      </span>
    </button>
  );
}

export default AddButton;
