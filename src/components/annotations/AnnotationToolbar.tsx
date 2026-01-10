/**
 * Annotation Toolbar - Tool palette for annotation editor
 * Part 3 of Field Photo Documentation System
 */

import { 
  MousePointer2, 
  ArrowRight, 
  Minus, 
  Square, 
  Circle, 
  Type, 
  Pencil, 
  Ruler,
  Undo2,
  Redo2,
  Trash2,
  Save,
  Loader2,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AnnotationToolType, ANNOTATION_COLORS } from '@/types/annotations';

interface AnnotationToolbarProps {
  activeTool: AnnotationToolType;
  onToolChange: (tool: AnnotationToolType) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSave: () => void;
  onExport?: () => void;
  isSaving: boolean;
  isExporting?: boolean;
  disabled?: boolean;
}

const TOOLS: { id: AnnotationToolType; icon: React.ComponentType<{ className?: string }>; label: string; shortcut?: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow', shortcut: 'A' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'circle', icon: Circle, label: 'Circle', shortcut: 'C' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'freehand', icon: Pencil, label: 'Freehand', shortcut: 'D' },
  { id: 'measurement', icon: Ruler, label: 'Measurement' },
];

export function AnnotationToolbar({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onSave,
  onExport,
  isSaving,
  isExporting = false,
  disabled = false,
}: AnnotationToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t bg-card">
      {/* Tool buttons */}
      <div className="flex items-center gap-1">
        {TOOLS.map(({ id, icon: Icon, label, shortcut }) => (
          <Button
            key={id}
            variant={activeTool === id ? 'default' : 'ghost'}
            size="icon"
            className={cn(
              'h-9 w-9',
              activeTool === id && 'bg-primary text-primary-foreground'
            )}
            onClick={() => onToolChange(id)}
            disabled={disabled}
            title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {/* Settings */}
      <div className="flex items-center gap-4">
        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              disabled={disabled}
            >
              <div
                className="h-4 w-4 rounded-full border border-border"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">Color</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="center">
            <div className="grid grid-cols-5 gap-1">
              {ANNOTATION_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                    color === c ? 'border-foreground' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => onColorChange(c)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Stroke width */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Width:</span>
          <Slider
            value={[strokeWidth]}
            onValueChange={([v]) => onStrokeWidthChange(v)}
            min={1}
            max={20}
            step={1}
            className="w-20"
            disabled={disabled}
          />
          <span className="text-xs w-4">{strokeWidth}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onUndo}
          disabled={!canUndo || disabled}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onRedo}
          disabled={!canRedo || disabled}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:text-destructive"
          onClick={onClear}
          disabled={disabled}
          title="Clear all"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-9 gap-2 ml-2"
          onClick={onSave}
          disabled={isSaving || disabled}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={onExport}
            disabled={isExporting || disabled}
            title="Export as image"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
