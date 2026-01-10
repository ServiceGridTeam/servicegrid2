import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TagColor } from '@/hooks/useTags';

interface TagChipProps {
  name: string;
  color: TagColor;
  size?: 'sm' | 'md' | 'lg';
  removable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

const colorClasses: Record<TagColor, string> = {
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5 gap-0.5',
  md: 'text-sm px-2 py-0.5 gap-1',
  lg: 'text-sm px-2.5 py-1 gap-1.5',
};

export function TagChip({
  name,
  color,
  size = 'md',
  removable = false,
  onRemove,
  onClick,
  selected = false,
  className,
}: TagChipProps) {
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'inline-flex items-center font-medium rounded-full border transition-all',
        colorClasses[color],
        sizeClasses[size],
        onClick && 'cursor-pointer hover:opacity-80',
        selected && 'ring-2 ring-primary ring-offset-1',
        className
      )}
    >
      {name}
      {removable && (
        <button
          type="button"
          onClick={handleRemove}
          className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 -mr-0.5 transition-colors"
        >
          <X className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        </button>
      )}
    </span>
  );
}
