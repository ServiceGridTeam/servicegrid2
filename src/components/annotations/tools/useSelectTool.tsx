/**
 * Select Tool - Selection, movement, and deletion of annotation objects
 * Part of Field Photo Documentation System
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { AnnotationObject } from '@/types/annotations';

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
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const originalPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const getPointerPosition = useCallback(() => {
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

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;

    const clickedObject = findObjectAtPoint(pos.x, pos.y);
    const isShiftHeld = (e.evt as MouseEvent).shiftKey;

    if (clickedObject) {
      // Clicked on an object
      if (isShiftHeld) {
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
        dragStartRef.current = pos;
        
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
  }, [getPointerPosition, findObjectAtPoint, selectedIds, setSelectedIds, annotations]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDragging || !dragStartRef.current) return;

    const pos = getPointerPosition();
    if (!pos) return;

    const dx = pos.x - dragStartRef.current.x;
    const dy = pos.y - dragStartRef.current.y;

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
  }, [isDragging, getPointerPosition, selectedIds, updateObject]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
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
