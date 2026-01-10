/**
 * Measurement Tool - Draw measurement lines with length display
 * Part of Field Photo Documentation System
 * 
 * Updated to use Canvas Abstraction Layer
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { MeasurementAnnotation, MeasurementUnit } from '@/types/annotations';
import type { CanvasPointerEvent, CanvasPoint } from '@/types/canvas-events';

interface UseMeasurementToolProps {
  stageRef: React.RefObject<Konva.Stage>;
  color: string;
  strokeWidth: number;
  unit: MeasurementUnit;
  scale?: number; // Pixels per unit (e.g., 100 pixels = 1 meter)
  onComplete: (annotation: Omit<MeasurementAnnotation, 'id'>) => void;
}

interface MeasurementToolState {
  isDrawing: boolean;
  preview: {
    x: number;
    y: number;
    points: number[];
    length: number;
  } | null;
}

interface MeasurementToolHandlers {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseUp: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handlePointerDown: (e: CanvasPointerEvent) => void;
  handlePointerMove: (e: CanvasPointerEvent) => void;
  handlePointerUp: (e: CanvasPointerEvent) => void;
  state: MeasurementToolState;
}

export function useMeasurementTool({
  stageRef,
  color,
  strokeWidth,
  unit,
  scale = 1, // Default: 1 pixel = 1 unit
  onComplete,
}: UseMeasurementToolProps): MeasurementToolHandlers {
  const [state, setState] = useState<MeasurementToolState>({
    isDrawing: false,
    preview: null,
  });
  
  const startPointRef = useRef<CanvasPoint | null>(null);

  const getPointerPosition = useCallback((): CanvasPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    const scaleVal = stage.scaleX();
    return {
      x: pos.x / scaleVal,
      y: pos.y / scaleVal,
    };
  }, [stageRef]);

  const calculateLength = useCallback((dx: number, dy: number): number => {
    const pixelLength = Math.sqrt(dx * dx + dy * dy);
    return pixelLength / scale;
  }, [scale]);

  // Abstract handler using CanvasPointerEvent
  const handlePointerDown = useCallback((e: CanvasPointerEvent) => {
    startPointRef.current = { x: e.x, y: e.y };
    setState({
      isDrawing: true,
      preview: {
        x: e.x,
        y: e.y,
        points: [0, 0, 0, 0],
        length: 0,
      },
    });
  }, []);

  const handlePointerMove = useCallback((e: CanvasPointerEvent) => {
    if (!state.isDrawing || !startPointRef.current) return;

    const start = startPointRef.current;
    
    let endX = e.x;
    let endY = e.y;
    
    // If shift is held, constrain to horizontal/vertical
    if (e.shiftKey) {
      const dx = Math.abs(e.x - start.x);
      const dy = Math.abs(e.y - start.y);
      if (dx > dy) {
        endY = start.y; // Horizontal
      } else {
        endX = start.x; // Vertical
      }
    }

    const dx = endX - start.x;
    const dy = endY - start.y;
    const length = calculateLength(dx, dy);

    setState({
      isDrawing: true,
      preview: {
        x: start.x,
        y: start.y,
        points: [0, 0, dx, dy],
        length,
      },
    });
  }, [state.isDrawing, calculateLength]);

  const handlePointerUp = useCallback((e: CanvasPointerEvent) => {
    if (!state.isDrawing || !state.preview) {
      setState({ isDrawing: false, preview: null });
      return;
    }

    const { x, y, points, length } = state.preview;

    // Only create if measurement has meaningful length
    if (length > 0.1) {
      const annotation: Omit<MeasurementAnnotation, 'id'> = {
        type: 'measurement',
        x,
        y,
        points,
        length,
        unit,
        pixelsPerUnit: scale,
        color,
        strokeWidth,
        rotation: 0,
      };

      onComplete(annotation);
    }

    setState({ isDrawing: false, preview: null });
    startPointRef.current = null;
  }, [state.isDrawing, state.preview, color, strokeWidth, unit, scale, onComplete]);

  // Konva-specific handlers (adapters)
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;
    handlePointerDown({ ...createBaseEvent(e), x: pos.x, y: pos.y });
  }, [getPointerPosition, handlePointerDown]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;
    handlePointerMove({ ...createBaseEvent(e), x: pos.x, y: pos.y });
  }, [getPointerPosition, handlePointerMove]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;
    handlePointerUp({ ...createBaseEvent(e), x: pos.x, y: pos.y });
  }, [getPointerPosition, handlePointerUp]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    state,
  };
}

// Helper to create base event properties
function createBaseEvent(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): Omit<CanvasPointerEvent, 'x' | 'y'> {
  const nativeEvent = e.evt;
  const mouseEvent = nativeEvent as MouseEvent;
  return {
    nativeEvent,
    shiftKey: mouseEvent.shiftKey ?? false,
    ctrlKey: mouseEvent.ctrlKey ?? false,
    metaKey: mouseEvent.metaKey ?? false,
    altKey: mouseEvent.altKey ?? false,
    targetId: null,
    isBackground: true,
    preventDefault: () => nativeEvent.preventDefault(),
  };
}

/**
 * Format measurement value with appropriate precision
 */
export function formatMeasurement(value: number, unit: MeasurementUnit): string {
  let precision = 1;
  let displaySuffix = unit as string;

  switch (unit) {
    case 'px':
      precision = 0;
      break;
    case 'in':
      precision = 2;
      displaySuffix = '"';
      break;
    case 'cm':
      precision = 1;
      break;
    case 'ft':
      precision = 2;
      displaySuffix = "'";
      break;
    case 'm':
      precision = 2;
      break;
  }

  return `${value.toFixed(precision)}${displaySuffix}`;
}
