import React from 'react';
import { cn } from '@/lib/utils';

export type WindowCardProps = {
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  onClick?: (ev: React.MouseEvent) => void;
  onContextMenu?: (ev: React.MouseEvent) => void;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
};

export function WindowCard({
  children,
  className = '',
  bodyClassName = '',
  onClick,
  onContextMenu,
  title,
  actions,
  style,
}: WindowCardProps) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={style}
      className={cn(
        'bg-surface rounded-lg overflow-hidden border border-line',
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
      <div className={cn('card__content', bodyClassName)}>{children}</div>
    </div>
  );
}

export default WindowCard;
