/**
 * Freehand Tool - Draw freehand strokes on the annotation canvas
 * Part of Field Photo Documentation System
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { FreehandAnnotation } from '@/types/annotations';

interface UseFreehandToolProps {
  stageRef: React.RefObject<Konva.Stage>;
  color: string;
  strokeWidth: number;
  onComplete: (annotation: Omit<FreehandAnnotation, 'id'>) => void;
}

interface FreehandToolState {
  isDrawing: boolean;
  preview: {
    x: number;
    y: number;
    points: number[];
  } | null;
}

interface FreehandToolHandlers {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseUp: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  state: FreehandToolState;
}

const MAX_POINTS = 10000; // Maximum points to prevent memory issues

export function useFreehandTool({
  stageRef,
  color,
  strokeWidth,
  onComplete,
}: UseFreehandToolProps): FreehandToolHandlers {
  const [state, setState] = useState<FreehandToolState>({
    isDrawing: false,
    preview: null,
  });
  
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const pointsRef = useRef<number[]>([]);

  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    const scale = stage.scaleX();
    return {
      x: pos.x / scale,
      y: pos.y / scale,
    };
  }, [stageRef]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;

    startPointRef.current = pos;
    pointsRef.current = [0, 0];
    
    setState({
      isDrawing: true,
      preview: {
        x: pos.x,
        y: pos.y,
        points: [0, 0],
      },
    });
  }, [getPointerPosition]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !startPointRef.current) return;

    const pos = getPointerPosition();
    if (!pos) return;

    // Check point limit
    if (pointsRef.current.length >= MAX_POINTS) return;

    const start = startPointRef.current;
    const relativeX = pos.x - start.x;
    const relativeY = pos.y - start.y;

    // Add point (relative to start position)
    pointsRef.current.push(relativeX, relativeY);

    setState({
      isDrawing: true,
      preview: {
        x: start.x,
        y: start.y,
        points: [...pointsRef.current],
      },
    });
  }, [state.isDrawing, getPointerPosition]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !state.preview || !startPointRef.current) {
      setState({ isDrawing: false, preview: null });
      return;
    }

    const points = pointsRef.current;

    // Only create if we have enough points
    if (points.length >= 4) {
      // Apply smoothing to the points
      const smoothedPoints = smoothPoints(points);
      
      const annotation: Omit<FreehandAnnotation, 'id'> = {
        type: 'freehand',
        x: startPointRef.current.x,
        y: startPointRef.current.y,
        points: smoothedPoints,
        color,
        strokeWidth,
        tension: 0.5, // Smooth curves
        rotation: 0,
      };

      onComplete(annotation);
    }

    setState({ isDrawing: false, preview: null });
    startPointRef.current = null;
    pointsRef.current = [];
  }, [state.isDrawing, state.preview, color, strokeWidth, onComplete]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    state,
  };
}

/**
 * Apply Ramer-Douglas-Peucker smoothing to reduce point count
 * while preserving the shape of the stroke
 */
function smoothPoints(points: number[], epsilon: number = 2): number[] {
  if (points.length <= 4) return points;

  // Convert flat array to point objects
  const pointObjects: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i += 2) {
    pointObjects.push({ x: points[i], y: points[i + 1] });
  }

  // Apply RDP algorithm
  const simplified = rdpSimplify(pointObjects, epsilon);

  // Convert back to flat array
  const result: number[] = [];
  for (const p of simplified) {
    result.push(p.x, p.y);
  }

  return result;
}

function rdpSimplify(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from line between start and end
  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIndex + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [start, end];
  }
}

function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLengthSquared = dx * dx + dy * dy;

  if (lineLengthSquared === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}
