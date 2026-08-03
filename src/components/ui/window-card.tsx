import React from 'react';
import { cn } from '@/lib/utils';

export type WindowCardProps = {
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  onClick?: (ev: React.MouseEvent) => void;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
};

export function WindowCard({
  children,
  className = '',
  bodyClassName = '',
  onClick,
  title,
  actions,
  style,
}: WindowCardProps) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'bg-surface rounded-lg overflow-hidden border border-line',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 p-2 border-b border-line/60">
        <span className="bg-red-500 inline-block w-3 h-3 rounded-full shrink-0" />
        <span className="bg-yellow-500 inline-block w-3 h-3 rounded-full shrink-0" />
        <span className="bg-green-500 inline-block w-3 h-3 rounded-full shrink-0" />
        {title && (
          <span className="ml-1.5 truncate text-[12px] font-semibold text-sub">{title}</span>
        )}
        {actions && <span className="ml-auto flex items-center gap-1">{actions}</span>}
      </div>
      <div className={cn('card__content', bodyClassName)}>{children}</div>
    </div>
  );
}

export default WindowCard;
