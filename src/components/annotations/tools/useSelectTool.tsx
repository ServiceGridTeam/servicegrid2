/**
 * Select Tool - Selection, movement, and deletion of annotation objects
 * Part of Field Photo Documentation System
 * 
 * Updated to use Canvas Abstraction Layer
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { AnnotationObject } from '@/types/annotations';
import type { CanvasPointerEvent, CanvasPoint, CanvasKeyEvent } from '@/types/canvas-events';

interface UseSelectToolProps {
  stageRef: React.RefObject<Konva.Stage>;
  annotations: AnnotationObject[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  updateObject: (id: string, updates: Partial<AnnotationObject>) => void;
  deleteSelected: () => void;
}

interface SelectToolHandlers {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseUp: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handlePointerDown: (e: CanvasPointerEvent) => void;
  handlePointerMove: (e: CanvasPointerEvent) => void;
  handlePointerUp: (e: CanvasPointerEvent) => void;
  handleCanvasKeyDown: (e: CanvasKeyEvent) => void;
}

export function useSelectTool({
  stageRef,
  annotations,
  selectedIds,
  setSelectedIds,
  updateObject,
  deleteSelected,
}: UseSelectToolProps): SelectToolHandlers {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<CanvasPoint | null>(null);
  const originalPositionsRef = useRef<Map<string, CanvasPoint>>(new Map());

  const getPointerPosition = useCallback((): CanvasPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    // Account for stage scale
    const scale = stage.scaleX();
    return {
      x: pos.x / scale,
      y: pos.y / scale,
    };
  }, [stageRef]);

  const findObjectAtPoint = useCallback((x: number, y: number): AnnotationObject | null => {
    // Check objects in reverse order (top-most first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const obj = annotations[i];
      if (isPointInObject(x, y, obj)) {
        return obj;
      }
    }
    return null;
  }, [annotations]);

  // Abstract handler using CanvasPointerEvent
  const handlePointerDown = useCallback((e: CanvasPointerEvent) => {
    const clickedObject = findObjectAtPoint(e.x, e.y);

    if (clickedObject) {
      // Clicked on an object
      if (e.shiftKey) {
        // Multi-select: toggle selection
        if (selectedIds.includes(clickedObject.id)) {
          setSelectedIds(selectedIds.filter(id => id !== clickedObject.id));
        } else {
          setSelectedIds([...selectedIds, clickedObject.id]);
        }
      } else {
        // Single select
        if (!selectedIds.includes(clickedObject.id)) {
          setSelectedIds([clickedObject.id]);
        }
        
        // Start dragging
        setIsDragging(true);
        dragStartRef.current = { x: e.x, y: e.y };
        
        // Store original positions of all selected objects
        originalPositionsRef.current.clear();
        const idsToMove = selectedIds.includes(clickedObject.id) 
          ? selectedIds 
          : [clickedObject.id];
        
        idsToMove.forEach(id => {
          const obj = annotations.find(a => a.id === id);
          if (obj) {
            originalPositionsRef.current.set(id, { x: obj.x, y: obj.y });
          }
        });
        
        if (!selectedIds.includes(clickedObject.id)) {
          setSelectedIds([clickedObject.id]);
        }
      }
    } else {
      // Clicked on empty area - deselect all
      setSelectedIds([]);
    }
  }, [findObjectAtPoint, selectedIds, setSelectedIds, annotations]);

  const handlePointerMove = useCallback((e: CanvasPointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const dx = e.x - dragStartRef.current.x;
    const dy = e.y - dragStartRef.current.y;

    // Update positions of all selected objects
    selectedIds.forEach(id => {
      const originalPos = originalPositionsRef.current.get(id);
      if (originalPos) {
        updateObject(id, {
          x: originalPos.x + dx,
          y: originalPos.y + dy,
        });
      }
    });
  }, [isDragging, selectedIds, updateObject]);

  const handlePointerUp = useCallback((e: CanvasPointerEvent) => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleCanvasKeyDown = useCallback((e: CanvasKeyEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedIds.length > 0) {
        e.preventDefault();
        deleteSelected();
      }
    }
    
    // Escape to deselect
    if (e.key === 'Escape') {
      setSelectedIds([]);
    }
  }, [selectedIds, deleteSelected, setSelectedIds]);

  // Konva-specific handlers (adapters)
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;
    
    handlePointerDown({
      x: pos.x,
      y: pos.y,
      nativeEvent: e.evt,
      shiftKey: (e.evt as MouseEvent).shiftKey ?? false,
      ctrlKey: (e.evt as MouseEvent).ctrlKey ?? false,
      metaKey: (e.evt as MouseEvent).metaKey ?? false,
      altKey: (e.evt as MouseEvent).altKey ?? false,
      targetId: null,
      isBackground: e.target === e.target.getStage(),
      preventDefault: () => e.evt.preventDefault(),
    });
  }, [getPointerPosition, handlePointerDown]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;
    
    handlePointerMove({
      x: pos.x,
      y: pos.y,
      nativeEvent: e.evt,
      shiftKey: (e.evt as MouseEvent).shiftKey ?? false,
      ctrlKey: (e.evt as MouseEvent).ctrlKey ?? false,
      metaKey: (e.evt as MouseEvent).metaKey ?? false,
      altKey: (e.evt as MouseEvent).altKey ?? false,
      targetId: null,
      isBackground: true,
      preventDefault: () => e.evt.preventDefault(),
    });
  }, [getPointerPosition, handlePointerMove]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    handlePointerUp({
      x: 0,
      y: 0,
      nativeEvent: e.evt,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      targetId: null,
      isBackground: true,
      preventDefault: () => e.evt.preventDefault(),
    });
  }, [handlePointerUp]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    handleCanvasKeyDown({
      key: e.key,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      preventDefault: () => e.preventDefault(),
    });
  }, [handleCanvasKeyDown]);

  return {
    // Konva-specific handlers for backward compatibility
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
    // Abstract handlers for future renderer implementations
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCanvasKeyDown,
  };
}

// Helper function to check if point is inside object
function isPointInObject(x: number, y: number, obj: AnnotationObject): boolean {
  const hitPadding = 10; // Extra padding for easier selection

  switch (obj.type) {
    case 'arrow':
    case 'line': {
      const points = obj.points || [0, 0, 100, 100];
      const x1 = obj.x + points[0];
      const y1 = obj.y + points[1];
      const x2 = obj.x + points[2];
      const y2 = obj.y + points[3];
      return distanceToLine(x, y, x1, y1, x2, y2) < hitPadding + (obj.strokeWidth || 2);
    }
    
    case 'rect': {
      const width = obj.width || 100;
      const height = obj.height || 100;
      return (
        x >= obj.x - hitPadding &&
        x <= obj.x + width + hitPadding &&
        y >= obj.y - hitPadding &&
        y <= obj.y + height + hitPadding
      );
    }
    
    case 'circle': {
      const radius = obj.radius || 50;
      const dx = x - obj.x;
      const dy = y - obj.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= radius + hitPadding;
    }
    
    case 'text': {
      const estimatedWidth = (obj.text?.length || 5) * (obj.fontSize || 16) * 0.6;
      const estimatedHeight = obj.fontSize || 16;
      return (
        x >= obj.x - hitPadding &&
        x <= obj.x + estimatedWidth + hitPadding &&
        y >= obj.y - hitPadding &&
        y <= obj.y + estimatedHeight + hitPadding
      );
    }
    
    case 'freehand': {
      const points = obj.points || [];
      for (let i = 0; i < points.length - 2; i += 2) {
        const x1 = obj.x + points[i];
        const y1 = obj.y + points[i + 1];
        const x2 = obj.x + points[i + 2];
        const y2 = obj.y + points[i + 3];
        if (distanceToLine(x, y, x1, y1, x2, y2) < hitPadding + (obj.strokeWidth || 2)) {
          return true;
        }
      }
      return false;
    }
    
    case 'measurement': {
      const points = obj.points || [0, 0, 100, 0];
      const x1 = obj.x + points[0];
      const y1 = obj.y + points[1];
      const x2 = obj.x + points[2];
      const y2 = obj.y + points[3];
      return distanceToLine(x, y, x1, y1, x2, y2) < hitPadding + (obj.strokeWidth || 2);
    }
    
    default:
      return false;
  }
}

// Calculate distance from point to line segment
function distanceToLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }
  
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  
  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  
  return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
}
