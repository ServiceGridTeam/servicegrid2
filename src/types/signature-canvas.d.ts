declare module 'react-signature-canvas' {
  import * as React from 'react';

  export interface SignatureCanvasProps {
    velocityFilterWeight?: number;
    minWidth?: number;
    maxWidth?: number;
    minDistance?: number;
    dotSize?: number | (() => number);
    penColor?: string;
    throttle?: number;
    onEnd?: () => void;
    onBegin?: () => void;
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
    backgroundColor?: string;
    clearOnResize?: boolean;
  }

  export default class SignatureCanvas extends React.Component<SignatureCanvasProps> {
    clear(): void;
    isEmpty(): boolean;
    fromDataURL(dataURL: string, options?: { ratio?: number; width?: number; height?: number; xOffset?: number; yOffset?: number }): void;
    toDataURL(type?: string, encoderOptions?: number): string;
    fromData(pointGroups: any[]): void;
    toData(): any[];
    off(): void;
    on(): void;
    getCanvas(): HTMLCanvasElement;
    getTrimmedCanvas(): HTMLCanvasElement;
    getSignaturePad(): any;
  }
}