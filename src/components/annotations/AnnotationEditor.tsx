/**
 * Annotation Editor - Full-screen modal for annotating photos
 * Part 3 of Field Photo Documentation System
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Arrow, Text, Line, Rect, Circle, Group } from 'react-konva';
import useImage from 'use-image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2, History } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAnnotationLock } from '@/hooks/useAnnotationLock';
import { useSaveAnnotation, useAnnotation } from '@/hooks/useAnnotations';
import { usePhotoWatcher } from '@/hooks/usePhotoWatcher';
import { useExportAnnotation } from '@/hooks/useExportAnnotation';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationHistoryPanel } from './AnnotationHistoryPanel';
import { 
  useArrowTool, 
  useTextTool, 
  useLineTool, 
  useRectTool, 
  useCircleTool, 
  useFreehandTool, 
  useMeasurementTool,
  useSelectTool 
} from './tools';
import {
  AnnotationData,
  AnnotationObject,
  AnnotationToolType,
  ArrowAnnotation,
  TextAnnotation,
  LineAnnotation,
  RectAnnotation,
  CircleAnnotation,
  FreehandAnnotation,
  MeasurementAnnotation,
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

  // Export functionality
  const { exportAnnotation, downloadRendered, isExporting } = useExportAnnotation({
    onSuccess: (url) => {
      downloadRendered(url, `annotated-${mediaId}.svg`);
    },
  });

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
  const transformerRef = useRef<Konva.Transformer>(null);
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
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

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

    const containerWidth = containerRef.current.clientWidth - 32;
    const containerHeight = containerRef.current.clientHeight - 120;

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
    
    setAnnotationData(prev => ({
      ...prev,
      canvas: { width: image.width, height: image.height, scale: newScale },
    }));
  }, [image, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);

  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    
    const selectedNodes = selectedIds
      .map(id => stage.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];
    
    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds]);

  // Add object to canvas
  const addObject = useCallback((object: AnnotationObject) => {
    setAnnotationData(prev => {
      const newData = {
        ...prev,
        objects: [...prev.objects, object],
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

  // Handle export - save first if needed, then export
  const handleExport = useCallback(async () => {
    if (!existingAnnotation?.id) {
      toast.error('Please save annotation first');
      return;
    }

    // Save if there are unsaved changes
    if (hasUnsavedChanges) {
      await handleSave();
    }

    await exportAnnotation(existingAnnotation.id);
  }, [existingAnnotation?.id, hasUnsavedChanges, handleSave, exportAnnotation]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (showHistoryPanel) {
          setShowHistoryPanel(false);
        } else {
          handleClose();
        }
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
      } else if (e.key === 'r') {
        setActiveTool('rect');
      } else if (e.key === 'c') {
        setActiveTool('circle');
      } else if (e.key === 'l') {
        setActiveTool('line');
      } else if (e.key === 'd') {
        setActiveTool('freehand');
      } else if (e.key === 'm') {
        setActiveTool('measurement');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSave, deleteSelected, showHistoryPanel]);

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

  // Wrapper to add IDs to tool-generated annotations
  const handleLineComplete = useCallback((annotation: Omit<LineAnnotation, 'id'>) => {
    addObject({ ...annotation, id: crypto.randomUUID() } as LineAnnotation);
  }, [addObject]);

  const handleRectComplete = useCallback((annotation: Omit<RectAnnotation, 'id'>) => {
    addObject({ ...annotation, id: crypto.randomUUID() } as RectAnnotation);
  }, [addObject]);

  const handleCircleComplete = useCallback((annotation: Omit<CircleAnnotation, 'id'>) => {
    addObject({ ...annotation, id: crypto.randomUUID() } as CircleAnnotation);
  }, [addObject]);

  const handleFreehandComplete = useCallback((annotation: Omit<FreehandAnnotation, 'id'>) => {
    addObject({ ...annotation, id: crypto.randomUUID() } as FreehandAnnotation);
  }, [addObject]);

  const handleMeasurementComplete = useCallback((annotation: Omit<MeasurementAnnotation, 'id'>) => {
    addObject({ ...annotation, id: crypto.randomUUID() } as MeasurementAnnotation);
  }, [addObject]);

  const lineTool = useLineTool({
    stageRef,
    color,
    strokeWidth,
    onComplete: handleLineComplete,
  });

  const rectTool = useRectTool({
    stageRef,
    color,
    strokeWidth,
    onComplete: handleRectComplete,
  });

  const circleTool = useCircleTool({
    stageRef,
    color,
    strokeWidth,
    onComplete: handleCircleComplete,
  });

  const freehandTool = useFreehandTool({
    stageRef,
    color,
    strokeWidth,
    onComplete: handleFreehandComplete,
  });

  const measurementTool = useMeasurementTool({
    stageRef,
    color,
    strokeWidth,
    unit: 'px',
    onComplete: handleMeasurementComplete,
  });

  const selectTool = useSelectTool({
    stageRef,
    annotations: annotationData.objects,
    selectedIds,
    setSelectedIds,
    updateObject,
    deleteSelected,
  });

  const isEditable = !readOnly && lockState.isOwnLock;

  // Stage event handlers - delegate to active tool
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly || !lockState.isOwnLock) return;

    // Deselect when clicking on empty area with select tool
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty && activeTool === 'select') {
      setSelectedIds([]);
    }

    switch (activeTool) {
      case 'select':
        selectTool.handleMouseDown(e);
        break;
      case 'arrow':
        arrowTool.handleMouseDown(e);
        break;
      case 'text':
        textTool.handleMouseDown(e);
        break;
      case 'line':
        lineTool.handleMouseDown(e);
        break;
      case 'rect':
        rectTool.handleMouseDown(e);
        break;
      case 'circle':
        circleTool.handleMouseDown(e);
        break;
      case 'freehand':
        freehandTool.handleMouseDown(e);
        break;
      case 'measurement':
        measurementTool.handleMouseDown(e);
        break;
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly || !lockState.isOwnLock) return;

    switch (activeTool) {
      case 'select':
        selectTool.handleMouseMove(e);
        break;
      case 'arrow':
        arrowTool.handleMouseMove(e);
        break;
      case 'line':
        lineTool.handleMouseMove(e);
        break;
      case 'rect':
        rectTool.handleMouseMove(e);
        break;
      case 'circle':
        circleTool.handleMouseMove(e);
        break;
      case 'freehand':
        freehandTool.handleMouseMove(e);
        break;
      case 'measurement':
        measurementTool.handleMouseMove(e);
        break;
    }
  };

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly || !lockState.isOwnLock) return;

    switch (activeTool) {
      case 'select':
        selectTool.handleMouseUp(e);
        break;
      case 'arrow':
        arrowTool.handleMouseUp(e);
        break;
      case 'line':
        lineTool.handleMouseUp(e);
        break;
      case 'rect':
        rectTool.handleMouseUp(e);
        break;
      case 'circle':
        circleTool.handleMouseUp(e);
        break;
      case 'freehand':
        freehandTool.handleMouseUp(e);
        break;
      case 'measurement':
        measurementTool.handleMouseUp(e);
        break;
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

  // Render annotation objects
  const renderAnnotationObject = (obj: AnnotationObject) => {
    const isSelected = selectedIds.includes(obj.id);
    
    const handleObjectClick = () => {
      if (activeTool === 'select' && isEditable) {
        setSelectedIds([obj.id]);
      }
    };

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      updateObject(obj.id, {
        x: node.x() / scale,
        y: node.y() / scale,
      });
    };

    const commonProps = {
      id: obj.id,
      onClick: handleObjectClick,
      onTap: handleObjectClick,
      draggable: isEditable && activeTool === 'select',
      onDragEnd: handleDragEnd,
    };

    switch (obj.type) {
      case 'arrow': {
        const arrow = obj as ArrowAnnotation;
        return (
          <Arrow
            key={obj.id}
            {...commonProps}
            points={arrow.points.map(p => p * scale)}
            stroke={arrow.color}
            strokeWidth={arrow.strokeWidth}
            fill={arrow.color}
            pointerLength={arrow.pointerLength || 10}
            pointerWidth={arrow.pointerWidth || 10}
          />
        );
      }
      case 'text': {
        const text = obj as TextAnnotation;
        return (
          <Text
            key={obj.id}
            {...commonProps}
            x={text.x * scale}
            y={text.y * scale}
            text={text.text}
            fontSize={text.fontSize * scale}
            fill={text.color}
            fontFamily={text.fontFamily || 'Inter'}
          />
        );
      }
      case 'line': {
        const line = obj as LineAnnotation;
        return (
          <Line
            key={obj.id}
            {...commonProps}
            points={line.points.map(p => p * scale)}
            stroke={line.color}
            strokeWidth={line.strokeWidth}
            lineCap={line.lineCap || 'round'}
            lineJoin={line.lineJoin || 'round'}
            dash={line.dash}
          />
        );
      }
      case 'rect': {
        const rect = obj as RectAnnotation;
        return (
          <Rect
            key={obj.id}
            {...commonProps}
            x={rect.x * scale}
            y={rect.y * scale}
            width={rect.width * scale}
            height={rect.height * scale}
            stroke={rect.color}
            strokeWidth={rect.strokeWidth}
            fill={rect.fill || 'transparent'}
            cornerRadius={rect.cornerRadius}
          />
        );
      }
      case 'circle': {
        const circle = obj as CircleAnnotation;
        return (
          <Circle
            key={obj.id}
            {...commonProps}
            x={circle.x * scale}
            y={circle.y * scale}
            radius={circle.radius * scale}
            stroke={circle.color}
            strokeWidth={circle.strokeWidth}
            fill={circle.fill || 'transparent'}
          />
        );
      }
      case 'freehand': {
        const freehand = obj as FreehandAnnotation;
        return (
          <Line
            key={obj.id}
            {...commonProps}
            points={freehand.points.map(p => p * scale)}
            stroke={freehand.color}
            strokeWidth={freehand.strokeWidth}
            tension={freehand.tension || 0.5}
            lineCap={freehand.lineCap || 'round'}
            lineJoin={freehand.lineJoin || 'round'}
          />
        );
      }
      case 'measurement': {
        const measurement = obj as MeasurementAnnotation;
        const [x1, y1, x2, y2] = measurement.points;
        const midX = ((x1 + x2) / 2) * scale;
        const midY = ((y1 + y2) / 2) * scale;
        const labelText = `${measurement.length.toFixed(1)} ${measurement.unit}`;
        
        return (
          <Group key={obj.id} {...commonProps}>
            <Line
              points={measurement.points.map(p => p * scale)}
              stroke={measurement.color}
              strokeWidth={measurement.strokeWidth}
              lineCap="round"
            />
            {/* End tick marks */}
            <Line
              points={[x1 * scale - 5, y1 * scale - 5, x1 * scale + 5, y1 * scale + 5]}
              stroke={measurement.color}
              strokeWidth={measurement.strokeWidth}
            />
            <Line
              points={[x2 * scale - 5, y2 * scale - 5, x2 * scale + 5, y2 * scale + 5]}
              stroke={measurement.color}
              strokeWidth={measurement.strokeWidth}
            />
            {measurement.showLabel !== false && (
              <Text
                x={midX}
                y={midY - 20}
                text={labelText}
                fontSize={12}
                fill={measurement.color}
                align="center"
                offsetX={labelText.length * 3}
              />
            )}
          </Group>
        );
      }
      default:
        return null;
    }
  };

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
            <div className="flex items-center gap-2">
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                  className="gap-1"
                >
                  <History className="h-4 w-4" />
                  History
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex overflow-hidden">
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
                    {annotationData.objects.map(renderAnnotationObject)}

                    {/* Drawing previews from tools */}
                    {arrowTool.previewElement}
                    {textTool.previewElement}
                    {lineTool.state.isDrawing && lineTool.state.preview && (
                      <Line
                        points={lineTool.state.preview.points}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        lineCap="round"
                      />
                    )}
                    {rectTool.state.isDrawing && rectTool.state.preview && (
                      <Rect
                        x={rectTool.state.preview.x}
                        y={rectTool.state.preview.y}
                        width={rectTool.state.preview.width}
                        height={rectTool.state.preview.height}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />
                    )}
                    {circleTool.state.isDrawing && circleTool.state.preview && (
                      <Circle
                        x={circleTool.state.preview.x}
                        y={circleTool.state.preview.y}
                        radius={circleTool.state.preview.radius}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />
                    )}
                    {freehandTool.state.isDrawing && freehandTool.state.preview && (
                      <Line
                        points={freehandTool.state.preview.points}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                      />
                    )}
                    {measurementTool.state.isDrawing && measurementTool.state.preview && (
                      <Line
                        points={measurementTool.state.preview.points}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        lineCap="round"
                      />
                    )}

                    {/* Transformer for selected objects */}
                    {isEditable && activeTool === 'select' && (
                      <Transformer
                        ref={transformerRef}
                        boundBoxFunc={(oldBox, newBox) => {
                          if (newBox.width < 10 || newBox.height < 10) {
                            return oldBox;
                          }
                          return newBox;
                        }}
                      />
                    )}
                  </Layer>
                </Stage>
              )}
            </div>

            {/* History Panel */}
            <AnnotationHistoryPanel
              mediaId={mediaId}
              open={showHistoryPanel}
              onOpenChange={setShowHistoryPanel}
              onPreviewVersion={(versionData) => {
                setAnnotationData(versionData);
                setHasUnsavedChanges(true);
                const newHistory = [...history.slice(0, historyIndex + 1), versionData];
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
              }}
              currentVersion={annotationData.version}
            />
          </div>

          {/* Text input overlay for text tool */}
          {textTool.textInputOverlay}

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
              onExport={existingAnnotation?.id ? handleExport : undefined}
              isSaving={isSaving}
              isExporting={isExporting}
              disabled={!isEditable}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
