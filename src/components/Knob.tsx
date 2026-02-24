import React, { useState, useRef, useCallback } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  step?: number;
}

export function Knob({ label, value, min, max, onChange, step = 0.01 }: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);
  const knobRef = useRef<HTMLDivElement>(null);

  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135; // -135° to +135°

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
    e.preventDefault();
  }, [value]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = startY - e.clientY; // Inverted for natural feel
    const sensitivity = (max - min) / 200; // Adjust sensitivity
    const newValue = Math.max(min, Math.min(max, startValue + deltaY * sensitivity));
    
    onChange(Math.round(newValue / step) * step);
  }, [isDragging, startY, startValue, min, max, onChange, step]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const formatValue = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    if (val >= 1) return val.toFixed(1);
    return val.toFixed(2);
  };

  return (
    <div className="flex flex-col items-center">
      <label className="text-sm mb-2 text-gray-300">{label}</label>
      <div
        ref={knobRef}
        className="relative w-16 h-16 cursor-pointer select-none"
        onMouseDown={handleMouseDown}
      >
        {/* Knob body */}
        <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 rounded-full shadow-lg border-2 border-gray-500">
          {/* Knob indicator */}
          <div
            className="absolute top-1 left-1/2 w-1 h-6 bg-white rounded-full transform -translate-x-1/2 origin-bottom"
            style={{
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              transformOrigin: '50% 100%',
            }}
          />
        </div>
        
        {/* Value display */}
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-300 whitespace-nowrap">
          {formatValue(value)}
        </div>
      </div>
    </div>
  );
}
