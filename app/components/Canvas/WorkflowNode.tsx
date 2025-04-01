import { useState, useRef, useEffect } from 'react';
import { WorkflowElement } from '@/app/types';

interface WorkflowNodeProps {
  element: WorkflowElement;
  isSelected: boolean;
  onClick: () => void;
  onPositionChange?: (id: string, position: { x: number, y: number }) => void;
}

export default function WorkflowNode({ 
  element, 
  isSelected, 
  onClick,
  onPositionChange 
}: WorkflowNodeProps) {
  const { position, data } = element;
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!nodeRef.current) return;
    
    // Calculate the offset from the cursor to the element's top-left corner
    const rect = nodeRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
    
    // Prevent text selection during drag
    e.preventDefault();
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onPositionChange || !nodeRef.current) return;
    
    const canvasRect = nodeRef.current.parentElement?.parentElement?.getBoundingClientRect();
    if (!canvasRect) return;
    
    // Calculate new position based on cursor position minus the offset
    // This ensures the cursor stays at the same relative position on the card
    const x = e.clientX - canvasRect.left - dragOffset.x + (nodeRef.current.offsetWidth / 2);
    const y = e.clientY - canvasRect.top - dragOffset.y + (nodeRef.current.offsetHeight / 2);
    
    onPositionChange(element.id, { x, y });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Add and remove event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);
  
  // Generate a lighter version of the color for the card background
  const getCardBackgroundColor = () => {
    if (!data.color) return '#ffffff';
    
    // If color is already in hex format, use it directly
    if (data.color.startsWith('#')) {
      return data.color;
    }
    
    return data.color;
  };
  
  return (
    <div
      ref={nodeRef}
      className={`absolute w-48 bg-white border-2 ${isSelected ? 'border-blue-500' : 'border-black'} rounded-md ${
        isDragging 
          ? 'shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] rotate-1 scale-105' 
          : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
      } cursor-move overflow-hidden transition-all duration-75`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: isDragging ? 100 : (isSelected ? 10 : 1)
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Card header with color and icon */}
      <div 
        className="w-full py-2 px-3 border-b-2 border-black flex items-center justify-between"
        style={{ backgroundColor: getCardBackgroundColor() }}
      >
        <h3 className="font-bold text-black text-sm">{data.name}</h3>
        <div 
          className="w-8 h-8 flex items-center justify-center border border-black rounded-full bg-white"
        >
          {data.icon ? (
            <span>{data.icon}</span>
          ) : (
            <span className="text-sm font-bold">{data.name.charAt(0)}</span>
          )}
        </div>
      </div>
      
      {/* Card body */}
      <div className="p-3">
        <p className="text-xs text-black">{data.description}</p>
      </div>
      
      {/* Card footer */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        <span className="text-xs font-medium text-gray-600">Agent</span>
        <div className="flex space-x-1">
          <div className="w-2 h-2 rounded-full bg-black"></div>
          <div className="w-2 h-2 rounded-full bg-black"></div>
          <div className="w-2 h-2 rounded-full bg-black"></div>
        </div>
      </div>
    </div>
  );
} 