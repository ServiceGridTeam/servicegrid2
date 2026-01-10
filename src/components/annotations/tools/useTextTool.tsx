/**
 * Text Tool Hook - Add text annotations to canvas
 * Part 3 of Field Photo Documentation System
 * 
 * Updated to use Canvas Abstraction Layer
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Text } from 'react-konva';
import Konva from 'konva';
import { TextAnnotation } from '@/types/annotations';
import type { CanvasPointerEvent, CanvasPoint } from '@/types/canvas-events';
import { generateAnnotationId, sanitizeTextContent } from '@/lib/annotationValidation';
import { adaptKonvaEvent } from '@/lib/canvas-event-adapter';

interface UseTextToolProps {
  stageRef: React.RefObject<Konva.Stage>;
  scale: number;
  color: string;
  fontSize: number;
  onComplete: (annotation: TextAnnotation) => void;
}

interface TextEditState {
  isEditing: boolean;
  x: number;
  y: number;
  text: string;
}

export function useTextTool({
  stageRef,
  scale,
  color,
  fontSize,
  onComplete,
}: UseTextToolProps) {
  const [editState, setEditState] = useState<TextEditState>({
    isEditing: false,
    x: 0,
    y: 0,
    text: '',
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const getPointerPosition = useCallback((): CanvasPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;

    const pos = stage.getPointerPosition();
    if (!pos) return null;

    // Convert to unscaled coordinates
    return {
      x: pos.x / scale,
      y: pos.y / scale,
    };
  }, [stageRef, scale]);

  const completeText = useCallback(() => {
    if (!editState.isEditing) return;

    const trimmedText = editState.text.trim();
    
    if (trimmedText.length > 0) {
      const sanitized = sanitizeTextContent(trimmedText);
      
      const textAnnotation: TextAnnotation = {
        id: generateAnnotationId(),
        type: 'text',
        x: editState.x,
        y: editState.y,
        text: sanitized,
        fontSize,
        fontFamily: 'Inter',
        color,
        strokeWidth: 0,
        fill: color,
      };

      onComplete(textAnnotation);
    }

    setEditState({
      isEditing: false,
      x: 0,
      y: 0,
      text: '',
    });
  }, [editState, fontSize, color, onComplete]);

  // Abstract handler using CanvasPointerEvent
  const handlePointerDown = useCallback((e: CanvasPointerEvent) => {
    // If already editing, complete the current text first
    if (editState.isEditing) {
      completeText();
      return;
    }

    setEditState({
      isEditing: true,
      x: e.x,
      y: e.y,
      text: '',
    });
  }, [editState.isEditing, completeText]);

  // Konva-specific handler (adapter)
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
      isBackground: true,
      preventDefault: () => e.evt.preventDefault(),
    });
  }, [getPointerPosition, handlePointerDown]);

  // Handle escape to cancel, enter to complete
  useEffect(() => {
    if (!editState.isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditState({
          isEditing: false,
          x: 0,
          y: 0,
          text: '',
        });
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        completeText();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editState.isEditing, completeText]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (editState.isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editState.isEditing]);

  // Create textarea overlay for editing
  const textInputOverlay = useMemo(() => {
    if (!editState.isEditing) return null;

    const stage = stageRef.current;
    if (!stage) return null;

    const stageContainer = stage.container();
    const stageRect = stageContainer.getBoundingClientRect();

    return (
      <textarea
        ref={textareaRef}
        value={editState.text}
        onChange={(e) => setEditState(prev => ({ ...prev, text: e.target.value }))}
        onBlur={completeText}
        placeholder="Type here..."
        style={{
          position: 'fixed',
          left: stageRect.left + editState.x * scale,
          top: stageRect.top + editState.y * scale,
          fontSize: fontSize * scale,
          fontFamily: 'Inter, sans-serif',
          color: color,
          background: 'rgba(255, 255, 255, 0.9)',
          border: '2px solid hsl(var(--primary))',
          borderRadius: '4px',
          padding: '4px 8px',
          minWidth: '100px',
          minHeight: '32px',
          resize: 'none',
          outline: 'none',
          zIndex: 9999,
        }}
      />
    );
  }, [editState, fontSize, color, scale, stageRef, completeText]);

  // Preview element (text being typed)
  const previewElement = useMemo(() => {
    if (!editState.isEditing || !editState.text) return null;

    return (
      <Text
        x={editState.x * scale}
        y={editState.y * scale}
        text={editState.text}
        fontSize={fontSize * scale}
        fontFamily="Inter"
        fill={color}
        opacity={0.5}
        listening={false}
      />
    );
  }, [editState, fontSize, color, scale]);

  return {
    // Konva-specific handler for backward compatibility
    handleMouseDown,
    handleMouseMove: () => {}, // Text tool doesn't need mouse move
    handleMouseUp: () => {}, // Text tool doesn't need mouse up
    // Abstract handler for future renderer implementations
    handlePointerDown,
    handlePointerMove: () => {},
    handlePointerUp: () => {},
    previewElement,
    textInputOverlay,
    isEditing: editState.isEditing,
    completeText,
  };
}
