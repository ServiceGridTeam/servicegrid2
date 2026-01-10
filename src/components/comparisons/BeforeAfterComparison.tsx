/**
 * Before/After Comparison Viewer
 * Supports slider, side-by-side, and fade display modes
 */

import { useState, useRef, useCallback } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComparisonDisplayMode } from '@/types/annotations';

interface BeforeAfterComparisonProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  displayMode?: ComparisonDisplayMode;
  onModeChange?: (mode: ComparisonDisplayMode) => void;
  className?: string;
  showModeToggle?: boolean;
}

export function BeforeAfterComparison({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Before',
  afterLabel = 'After',
  displayMode = 'slider',
  onModeChange,
  className,
  showModeToggle = true,
}: BeforeAfterComparisonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fadeOpacity, setFadeOpacity] = useState(0.5);
  
  // Slider position (0-100)
  const sliderX = useMotionValue(50);
  const springX = useSpring(sliderX, { stiffness: 500, damping: 35 });
  const clipPath = useTransform(springX, (x) => `inset(0 ${100 - x}% 0 0)`);

  const handleSliderDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const clampedX = Math.max(0, Math.min(100, x));
    
    sliderX.set(clampedX);
  }, [sliderX]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleSliderDrag(e);
  }, [handleSliderDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    handleSliderDrag(e);
  }, [isDragging, handleSliderDrag]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // Snap to 0, 50, or 100 if close
    const current = sliderX.get();
    if (current < 10) sliderX.set(0);
    else if (current > 90) sliderX.set(100);
    else if (current > 45 && current < 55) sliderX.set(50);
  }, [isDragging, sliderX]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    handleSliderDrag(e);
  }, [handleSliderDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    handleSliderDrag(e);
  }, [isDragging, handleSliderDrag]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const current = sliderX.get();
    if (current < 10) sliderX.set(0);
    else if (current > 90) sliderX.set(100);
    else if (current > 45 && current < 55) sliderX.set(50);
  }, [sliderX]);

  return (
    <div className={cn('space-y-3', className)}>
      {showModeToggle && (
        <Tabs 
          value={displayMode} 
          onValueChange={(v) => onModeChange?.(v as ComparisonDisplayMode)}
          className="w-fit"
        >
          <TabsList className="h-8">
            <TabsTrigger value="slider" className="text-xs px-3 h-6">Slider</TabsTrigger>
            <TabsTrigger value="side_by_side" className="text-xs px-3 h-6">Side by Side</TabsTrigger>
            <TabsTrigger value="fade" className="text-xs px-3 h-6">Fade</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {displayMode === 'slider' && (
        <div
          ref={containerRef}
          className="relative aspect-video rounded-lg overflow-hidden cursor-ew-resize select-none bg-muted"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* After image (background) */}
          <img
            src={afterUrl}
            alt={afterLabel}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
          
          {/* Before image (clipped) */}
          <motion.div
            className="absolute inset-0"
            style={{ clipPath }}
          >
            <img
              src={beforeUrl}
              alt={beforeLabel}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </motion.div>

          {/* Slider handle */}
          <motion.div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
            style={{ left: springX.get() + '%', x: '-50%' }}
          >
            {/* Handle grip */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-4 bg-muted-foreground/50 rounded-full" />
                <div className="w-0.5 h-4 bg-muted-foreground/50 rounded-full" />
              </div>
            </div>
          </motion.div>

          {/* Labels */}
          <Badge className="absolute top-3 left-3 pointer-events-none bg-background/80">
            {beforeLabel}
          </Badge>
          <Badge className="absolute top-3 right-3 pointer-events-none bg-background/80">
            {afterLabel}
          </Badge>
        </div>
      )}

      {displayMode === 'side_by_side' && (
        <div className="grid grid-cols-2 gap-2 rounded-lg overflow-hidden">
          <div className="relative aspect-video bg-muted">
            <img
              src={beforeUrl}
              alt={beforeLabel}
              className="w-full h-full object-cover"
            />
            <Badge className="absolute top-2 left-2 bg-background/80">
              {beforeLabel}
            </Badge>
          </div>
          <div className="relative aspect-video bg-muted">
            <img
              src={afterUrl}
              alt={afterLabel}
              className="w-full h-full object-cover"
            />
            <Badge className="absolute top-2 right-2 bg-background/80">
              {afterLabel}
            </Badge>
          </div>
        </div>
      )}

      {displayMode === 'fade' && (
        <div className="space-y-2">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            {/* Before image */}
            <img
              src={beforeUrl}
              alt={beforeLabel}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* After image with opacity */}
            <motion.img
              src={afterUrl}
              alt={afterLabel}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: fadeOpacity }}
            />
            {/* Labels */}
            <Badge 
              className="absolute top-3 left-3 pointer-events-none bg-background/80"
              style={{ opacity: 1 - fadeOpacity + 0.3 }}
            >
              {beforeLabel}
            </Badge>
            <Badge 
              className="absolute top-3 right-3 pointer-events-none bg-background/80"
              style={{ opacity: fadeOpacity + 0.3 }}
            >
              {afterLabel}
            </Badge>
          </div>
          {/* Opacity slider */}
          <div className="flex items-center gap-3 px-2">
            <span className="text-xs text-muted-foreground w-12">{beforeLabel}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={fadeOpacity}
              onChange={(e) => setFadeOpacity(parseFloat(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-xs text-muted-foreground w-12 text-right">{afterLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
