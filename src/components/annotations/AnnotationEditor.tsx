/**
 * Annotation Editor - Full-screen modal for annotating photos
 * Part 3 of Field Photo Documentation System
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Arrow, Text } from 'react-konva';
import useImage from 'use-image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAnnotationLock } from '@/hooks/useAnnotationLock';
import { useSaveAnnotation, useAnnotation } from '@/hooks/useAnnotations';
import { usePhotoWatcher } from '@/hooks/usePhotoWatcher';
import { AnnotationToolbar } from './AnnotationToolbar';
import { useArrowTool } from './tools/useArrowTool';
import { useTextTool } from './tools/useTextTool';
import {
  AnnotationData,
  AnnotationObject,
  AnnotationToolType,
  DEFAULT_ANNOTATION_DATA,
  DEFAULT_EDITOR_SETTINGS,
  MAX_UNDO_STEPS,
  AUTO_SAVE_INTERVAL_MS,
} from '@/types/annotations';
import { validateAnnotationData, sanitizeAnnotationData } from '@/lib/annotationValidation';
import Konva from 'konva';

interface AnnotationEditorProps {
  mediaId: string;
  mediaUrl: string;
  readOnly?: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export function AnnotationEditor({
  mediaId,
  mediaUrl,
  readOnly = false,
  onClose,
  onSave,
}: AnnotationEditorProps) {
  // Load existing annotation
  const { data: existingAnnotation, isLoading: isLoadingAnnotation } = useAnnotation(mediaId);
  
  // Lock management (only if not read-only)
  const {
    lockState,
    isAcquiring,
    acquireLock,
    releaseLock,
  } = useAnnotationLock(mediaId, {
    autoAcquire: !readOnly,
    onLockDenied: (holderName) => {
      toast.error(`Photo is being edited by ${holderName}`);
    },
    onLockLost: () => {
      toast.error('Your editing session was lost. Changes may not be saved.');
    },
  });

  // Save mutation
  const saveAnnotation = useSaveAnnotation();

  // Photo watcher for deletion detection
  usePhotoWatcher(mediaId, {
    onDeleted: () => {
      toast.error('Photo was deleted');
      onClose();
    },
  });

  // Canvas state
  const [image] = useImage(mediaUrl, 'anonymous');
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);

  // Annotation state
  const [annotationData, setAnnotationData] = useState<AnnotationData>(DEFAULT_ANNOTATION_DATA);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationToolType>('select');
  const [color, setColor] = useState(DEFAULT_EDITOR_SETTINGS.color);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_EDITOR_SETTINGS.strokeWidth);
  const [fontSize, setFontSize] = useState(DEFAULT_EDITOR_SETTINGS.fontSize);

  // History state
  const [history, setHistory] = useState<AnnotationData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from existing annotation
  useEffect(() => {
    if (existingAnnotation?.annotation_data) {
      const data = existingAnnotation.annotation_data as unknown as AnnotationData;
      setAnnotationData(data);
      setHistory([data]);
      setHistoryIndex(0);
    }
  }, [existingAnnotation]);

  // Calculate stage size based on container and image
  useEffect(() => {
    if (!containerRef.current || !image) return;

    const containerWidth = containerRef.current.clientWidth - 32; // padding
    const containerHeight = containerRef.current.clientHeight - 120; // toolbar space

    const imageAspect = image.width / image.height;
    const containerAspect = containerWidth / containerHeight;

    let width, height;
    if (imageAspect > containerAspect) {
      width = containerWidth;
      height = containerWidth / imageAspect;
    } else {
      height = containerHeight;
      width = containerHeight * imageAspect;
    }

    const newScale = width / image.width;
    setStageSize({ width, height });
    setScale(newScale);
    
    // Update canvas dimensions in annotation data
    setAnnotationData(prev => ({
      ...prev,
      canvas: { width: image.width, height: image.height, scale: newScale },
    }));
  }, [image, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);

  // Add object to canvas
  const addObject = useCallback((object: AnnotationObject) => {
    setAnnotationData(prev => {
      const newData = {
        ...prev,
        objects: [...prev.objects, object],
      };
      
      // Add to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newData);
      if (newHistory.length > MAX_UNDO_STEPS) {
        newHistory.shift();
      }
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setHasUnsavedChanges(true);
      
      return newData;
    });
  }, [history, historyIndex]);

  // Update object
  const updateObject = useCallback((id: string, updates: Partial<AnnotationObject>) => {
    setAnnotationData(prev => {
      const newData = {
        ...prev,
        objects: prev.objects.map(obj =>
          obj.id === id ? { ...obj, ...updates } : obj
        ) as AnnotationObject[],
      };
      setHasUnsavedChanges(true);
      return newData;
    });
  }, []);

  // Delete selected objects
  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    setAnnotationData(prev => {
      const newData = {
        ...prev,
        objects: prev.objects.filter(obj => !selectedIds.includes(obj.id)),
      };
      
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newData);
      if (newHistory.length > MAX_UNDO_STEPS) {
        newHistory.shift();
      }
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setHasUnsavedChanges(true);
      
      return newData;
    });
    setSelectedIds([]);
  }, [selectedIds, history, historyIndex]);

  // Undo/Redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setAnnotationData(history[newIndex]);
    setHasUnsavedChanges(true);
    setSelectedIds([]);
  }, [canUndo, history, historyIndex]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setAnnotationData(history[newIndex]);
    setHasUnsavedChanges(true);
    setSelectedIds([]);
  }, [canRedo, history, historyIndex]);

  // Clear all
  const clearAll = useCallback(() => {
    const newData = {
      ...annotationData,
      objects: [],
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setAnnotationData(newData);
    setHasUnsavedChanges(true);
    setSelectedIds([]);
  }, [annotationData, history, historyIndex]);

  // Save annotation
  const handleSave = useCallback(async () => {
    if (readOnly || !lockState.isOwnLock) return;

    setIsSaving(true);
    try {
      const sanitized = sanitizeAnnotationData(annotationData);
      const validation = validateAnnotationData(sanitized);
      
      if (!validation.valid) {
        toast.error('Invalid annotation data', {
          description: validation.errors.join(', '),
        });
        return;
      }

      await saveAnnotation.mutateAsync({
        mediaId,
        annotationData: sanitized,
      });

      setHasUnsavedChanges(false);
      toast.success('Annotations saved');
      onSave?.();
    } catch (error) {
      console.error('Failed to save annotation:', error);
      toast.error('Failed to save annotations');
    } finally {
      setIsSaving(false);
    }
  }, [annotationData, mediaId, readOnly, lockState.isOwnLock, saveAnnotation, onSave]);

  // Auto-save
  useEffect(() => {
    if (!hasUnsavedChanges || readOnly || !lockState.isOwnLock) return;

    const timer = setTimeout(() => {
      handleSave();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, readOnly, lockState.isOwnLock, handleSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      } else if (e.key === 'v') {
        setActiveTool('select');
      } else if (e.key === 'a') {
        setActiveTool('arrow');
      } else if (e.key === 't') {
        setActiveTool('text');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSave, deleteSelected, onClose]);

  // Tool hooks
  const arrowTool = useArrowTool({
    stageRef,
    scale,
    color,
    strokeWidth,
    onComplete: addObject,
  });

  const textTool = useTextTool({
    stageRef,
    scale,
    color,
    fontSize,
    onComplete: addObject,
  });

  // Stage event handlers
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Deselect when clicking on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedIds([]);
    }

    if (readOnly || !lockState.isOwnLock) return;

    if (activeTool === 'arrow') {
      arrowTool.handleMouseDown(e);
    } else if (activeTool === 'text') {
      textTool.handleMouseDown(e);
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly || !lockState.isOwnLock) return;

    if (activeTool === 'arrow') {
      arrowTool.handleMouseMove(e);
    }
  };

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly || !lockState.isOwnLock) return;

    if (activeTool === 'arrow') {
      arrowTool.handleMouseUp(e);
    }
  };

  // Handle close with unsaved changes warning
  const handleClose = useCallback(async () => {
    if (hasUnsavedChanges && !readOnly) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }

    if (lockState.isOwnLock) {
      await releaseLock();
    }

    onClose();
  }, [hasUnsavedChanges, readOnly, lockState.isOwnLock, releaseLock, onClose]);

  const isLocked = !readOnly && !lockState.isOwnLock && lockState.isLocked;
  const isEditable = !readOnly && lockState.isOwnLock;

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-background border-none rounded-none">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
            <div className="flex items-center gap-2">
              <span className="font-medium">Annotation Editor</span>
              {hasUnsavedChanges && (
                <span className="text-xs text-muted-foreground">• Unsaved changes</span>
              )}
              {isLocked && (
                <span className="text-xs text-destructive">
                  Locked by {lockState.lockHolderName}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Canvas container */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center bg-muted/50 overflow-hidden p-4"
          >
            {isLoadingAnnotation || isAcquiring ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{isAcquiring ? 'Acquiring lock...' : 'Loading...'}</span>
              </div>
            ) : (
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onTouchStart={handleStageMouseDown}
                onTouchMove={handleStageMouseMove}
                onTouchEnd={handleStageMouseUp}
                className={cn(
                  'bg-white shadow-lg',
                  !isEditable && 'cursor-not-allowed'
                )}
              >
                {/* Background image layer */}
                <Layer>
                  {image && (
                    <KonvaImage
                      image={image}
                      width={stageSize.width}
                      height={stageSize.height}
                    />
                  )}
                </Layer>

                {/* Annotations layer */}
                <Layer>
                  {/* Render existing annotations */}
                  {annotationData.objects.map((obj) => {
                    // Render based on type - simplified for now
                    if (obj.type === 'arrow') {
                      const arrow = obj as import('@/types/annotations').ArrowAnnotation;
                      return (
                        <Arrow
                          key={obj.id}
                          id={obj.id}
                          points={arrow.points.map((p) => p * scale)}
                          stroke={arrow.color}
                          strokeWidth={arrow.strokeWidth}
                          fill={arrow.color}
                          pointerLength={arrow.pointerLength || 10}
                          pointerWidth={arrow.pointerWidth || 10}
                          onClick={() => activeTool === 'select' && setSelectedIds([obj.id])}
                          onTap={() => activeTool === 'select' && setSelectedIds([obj.id])}
                          draggable={isEditable && activeTool === 'select'}
                        />
                      );
                    }
                    if (obj.type === 'text') {
                      const text = obj as import('@/types/annotations').TextAnnotation;
                      return (
                        <Text
                          key={obj.id}
                          id={obj.id}
                          x={text.x * scale}
                          y={text.y * scale}
                          text={text.text}
                          fontSize={text.fontSize * scale}
                          fill={text.color}
                          onClick={() => activeTool === 'select' && setSelectedIds([obj.id])}
                          onTap={() => activeTool === 'select' && setSelectedIds([obj.id])}
                          draggable={isEditable && activeTool === 'select'}
                          onDragEnd={(e) => {
                            const node = e.target;
                            updateObject(obj.id, {
                              x: node.x() / scale,
                              y: node.y() / scale,
                            });
                          }}
                        />
                      );
                    }
                    return null;
                  })}

                  {/* Drawing preview */}
                  {arrowTool.previewElement}
                  {textTool.previewElement}
                </Layer>
              </Stage>
            )}
          </div>

          {/* Toolbar */}
          {!readOnly && (
            <AnnotationToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              color={color}
              onColorChange={setColor}
              strokeWidth={strokeWidth}
              onStrokeWidthChange={setStrokeWidth}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onClear={clearAll}
              onSave={handleSave}
              isSaving={isSaving}
              disabled={!isEditable}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
