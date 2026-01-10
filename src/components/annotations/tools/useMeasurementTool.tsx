/**
 * Measurement Tool - Draw measurement lines with length display
 * Part of Field Photo Documentation System
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { MeasurementAnnotation, MeasurementUnit } from '@/types/annotations';

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
  
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const getPointerPosition = useCallback(() => {
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

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;

    startPointRef.current = pos;
    setState({
      isDrawing: true,
      preview: {
        x: pos.x,
        y: pos.y,
        points: [0, 0, 0, 0],
        length: 0,
      },
    });
  }, [getPointerPosition]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !startPointRef.current) return;

    const pos = getPointerPosition();
    if (!pos) return;

    const start = startPointRef.current;
    const isShiftHeld = (e.evt as MouseEvent).shiftKey;
    
    let endX = pos.x;
    let endY = pos.y;
    
    // If shift is held, constrain to horizontal/vertical
    if (isShiftHeld) {
      const dx = Math.abs(pos.x - start.x);
      const dy = Math.abs(pos.y - start.y);
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
  }, [state.isDrawing, getPointerPosition, calculateLength]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
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

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    state,
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
