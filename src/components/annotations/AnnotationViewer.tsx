/**
 * Annotation Viewer - Read-only viewer for annotated photos
 * Part 3 of Field Photo Documentation System
 */

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Arrow, Text, Line, Rect, Circle, Ellipse } from 'react-konva';
import useImage from 'use-image';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnnotation } from '@/hooks/useAnnotations';
import {
  AnnotationData,
  ArrowAnnotation,
  TextAnnotation,
  LineAnnotation,
  RectAnnotation,
  CircleAnnotation,
  EllipseAnnotation,
  FreehandAnnotation,
} from '@/types/annotations';
import Konva from 'konva';

interface AnnotationViewerProps {
  mediaId: string;
  mediaUrl: string;
  className?: string;
  showControls?: boolean;
}

export function AnnotationViewer({
  mediaId,
  mediaUrl,
  className,
  showControls = true,
}: AnnotationViewerProps) {
  const { data: annotation } = useAnnotation(mediaId);
  const [image] = useImage(mediaUrl, 'anonymous');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  
  const [stageSize, setStageSize] = useState({ width: 400, height: 300 });
  const [scale, setScale] = useState(1);
  const [viewScale, setViewScale] = useState(1);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Calculate stage size based on container and image
  useEffect(() => {
    if (!containerRef.current || !image) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

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
  }, [image, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);

  const annotationData = annotation?.annotation_data as unknown as AnnotationData | undefined;

  // Zoom controls
  const handleZoomIn = () => setViewScale(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setViewScale(prev => Math.max(prev / 1.2, 0.5));
  const handleResetZoom = () => {
    setViewScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Pan handling
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setPosition({
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  // Download with annotations
  const handleDownload = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `annotated-photo-${mediaId}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render annotation objects
  const renderAnnotation = (obj: AnnotationData['objects'][number], index: number) => {
    const scaledProps = {
      key: obj.id || index,
      listening: false,
    };

    switch (obj.type) {
      case 'arrow': {
        const arrow = obj as ArrowAnnotation;
        return (
          <Arrow
            {...scaledProps}
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
            {...scaledProps}
            x={text.x * scale}
            y={text.y * scale}
            text={text.text}
            fontSize={(text.fontSize || 16) * scale}
            fontFamily={text.fontFamily || 'Inter'}
            fill={text.color}
          />
        );
      }
      case 'line': {
        const line = obj as LineAnnotation;
        return (
          <Line
            {...scaledProps}
            points={line.points.map(p => p * scale)}
            stroke={line.color}
            strokeWidth={line.strokeWidth}
            lineCap={line.lineCap}
            lineJoin={line.lineJoin}
            dash={line.dash}
          />
        );
      }
      case 'rect': {
        const rect = obj as RectAnnotation;
        return (
          <Rect
            {...scaledProps}
            x={rect.x * scale}
            y={rect.y * scale}
            width={rect.width * scale}
            height={rect.height * scale}
            stroke={rect.color}
            strokeWidth={rect.strokeWidth}
            fill={rect.fill}
            cornerRadius={rect.cornerRadius}
          />
        );
      }
      case 'circle': {
        const circle = obj as CircleAnnotation;
        return (
          <Circle
            {...scaledProps}
            x={circle.x * scale}
            y={circle.y * scale}
            radius={circle.radius * scale}
            stroke={circle.color}
            strokeWidth={circle.strokeWidth}
            fill={circle.fill}
          />
        );
      }
      case 'ellipse': {
        const ellipse = obj as EllipseAnnotation;
        return (
          <Ellipse
            {...scaledProps}
            x={ellipse.x * scale}
            y={ellipse.y * scale}
            radiusX={ellipse.radiusX * scale}
            radiusY={ellipse.radiusY * scale}
            stroke={ellipse.color}
            strokeWidth={ellipse.strokeWidth}
            fill={ellipse.fill}
          />
        );
      }
      case 'freehand': {
        const freehand = obj as FreehandAnnotation;
        return (
          <Line
            {...scaledProps}
            points={freehand.points.map(p => p * scale)}
            stroke={freehand.color}
            strokeWidth={freehand.strokeWidth}
            lineCap={freehand.lineCap || 'round'}
            lineJoin={freehand.lineJoin || 'round'}
            tension={freehand.tension || 0.5}
          />
        );
      }
      default:
        return null;
    }
  };

  const hasAnnotations = annotationData && annotationData.objects.length > 0;

  return (
    <div 
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={viewScale}
        scaleY={viewScale}
        x={position.x}
        y={position.y}
        draggable={viewScale > 1}
        onDragEnd={handleDragEnd}
      >
        {/* Background image */}
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
        {showAnnotations && annotationData && (
          <Layer>
            {annotationData.objects.map(renderAnnotation)}
          </Layer>
        )}
      </Stage>

      {/* Controls overlay */}
      {showControls && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1 border">
          {hasAnnotations && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowAnnotations(!showAnnotations)}
              title={showAnnotations ? 'Hide annotations' : 'Show annotations'}
            >
              {showAnnotations ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleResetZoom}
            title="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Annotation indicator */}
      {hasAnnotations && (
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
          {annotationData.objects.length} annotation{annotationData.objects.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
