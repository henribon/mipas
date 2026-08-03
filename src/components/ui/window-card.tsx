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
        'rounded-lg neon-borda [--neon-fill:var(--surface)]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-line/60">
          {title && <span className="truncate text-[12px] font-semibold text-sub">{title}</span>}
          {actions && <span className="ml-auto flex items-center gap-1">{actions}</span>}
        </div>
      )}
      <div className={cn('card__content overflow-hidden rounded-[inherit]', bodyClassName)}>{children}</div>
    </div>
  );
}

export default WindowCard;
