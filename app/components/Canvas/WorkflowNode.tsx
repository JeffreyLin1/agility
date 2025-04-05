import { useState, useRef, useEffect } from 'react';
import { WorkflowElement } from '@/app/types';
import TextGeneratorConfig from '../Agents/TextGeneratorConfig';

interface WorkflowNodeProps {
  element: WorkflowElement;
  onPositionChange?: (id: string, position: { x: number, y: number }) => void;
  onDelete?: () => void;
  onConnectionStart?: (elementId: string, position: { x: number, y: number }) => void;
  onConnectionEnd?: (elementId: string | null) => void;
  isConnecting: boolean;
  isConnectionSource: boolean;
  isConnectionTarget: boolean;
  onSelect?: (elementId: string, agentId: string) => void;
}

export default function WorkflowNode({ 
  element, 
  onPositionChange,
  onDelete,
  onConnectionStart,
  onConnectionEnd,
  isConnecting,
  isConnectionSource,
  isConnectionTarget,
  onSelect
}: WorkflowNodeProps) {
  const { position, data } = element;
  const nodeRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHandleDragging, setIsHandleDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const baseWidth = 220;
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!nodeRef.current) return;
    
    // If we're in connecting mode, don't start dragging
    if (isConnecting && !isConnectionSource) {
      e.stopPropagation();
      return;
    }
    
    // Calculate the offset from the cursor to the element's center
    const rect = nodeRef.current.getBoundingClientRect();
    const offsetX = e.clientX - (rect.left + rect.width / 2);
    const offsetY = e.clientY - (rect.top + rect.height / 2);
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
    
    // Prevent text selection during drag
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to prevent canvas dragging
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onPositionChange) return;
    
    // Get the canvas element (parent of parent)
    const canvasElement = nodeRef.current?.parentElement?.parentElement;
    if (!canvasElement) return;
    
    const canvasRect = canvasElement.getBoundingClientRect();
    
    // Get the current pan offset from the transform style of the content container
    const contentContainer = nodeRef.current?.parentElement;
    const transformStyle = contentContainer ? getComputedStyle(contentContainer).transform : '';
    const matrix = new DOMMatrix(transformStyle);
    const panOffsetX = matrix.e;
    const panOffsetY = matrix.f;
    
    // Calculate new position in canvas coordinates
    const x = e.clientX - canvasRect.left - panOffsetX;
    const y = e.clientY - canvasRect.top - panOffsetY;
    
    // Apply the drag offset
    onPositionChange(element.id, { 
      x: x - dragOffset.x, 
      y: y - dragOffset.y 
    });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Handle connection handle drag
  const handleConnectionHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!handleRef.current) return;
    
    setIsHandleDragging(true);
    
    // Get the position of the handle in canvas coordinates
    const handleRect = handleRef.current.getBoundingClientRect();
    const handleCenterX = handleRect.left + handleRect.width / 2;
    const handleCenterY = handleRect.top + handleRect.height / 2;
    
    // Start the connection
    if (onConnectionStart) {
      const canvasElement = nodeRef.current?.parentElement?.parentElement;
      if (canvasElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        
        // Get the current pan offset from the transform style of the content container
        const contentContainer = nodeRef.current?.parentElement;
        const transformStyle = contentContainer ? getComputedStyle(contentContainer).transform : '';
        const matrix = new DOMMatrix(transformStyle);
        const panOffsetX = matrix.e;
        const panOffsetY = matrix.f;
        
        // Calculate handle position in canvas coordinates
        const handlePosX = handleCenterX - canvasRect.left - panOffsetX;
        const handlePosY = handleCenterY - canvasRect.top - panOffsetY;
        
        onConnectionStart(element.id, { x: handlePosX, y: handlePosY });
      }
    }
  };
  
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
  }, [isDragging, element.id, onPositionChange]);
  
  // Get the background color based on the agent color
  const getCardBackgroundColor = () => {
    if (!data.color) {
      return '#ffffff';
    }
    
    // Lighten the color for the card background
    return data.color;
  };
  
  // Add a mouseup event handler to the node
  const handleNodeMouseUp = (e: React.MouseEvent) => {
    if (isConnecting && !isConnectionSource && onConnectionEnd) {
      e.stopPropagation();
      onConnectionEnd(element.id);
    }
  };
  
  // Add these handlers to track drag state
  const handleDragStart = () => {
    setIsDragging(true);
  };
  
  const handleDragEnd = () => {
    // Use setTimeout to ensure this runs after the click handler
    setTimeout(() => {
      setIsDragging(false);
    }, 0);
  };
  
  // Modify the click handler to check if we're dragging
  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If we're in connecting mode, handle connection
    if (isConnecting) {
      if (onConnectionEnd) {
        onConnectionEnd(element.id);
      }
      return;
    }
    
    // Don't open config if this was the end of a drag operation
    if (isDragging) {
      return;
    }
    
    // Otherwise, select the node for configuration
    if (onSelect) {
      // Check if this is a configurable agent (Text Generator or Gmail Sender)
      if (element.agentId === '1' || element.agentId === '2' || element.agentId === '3') {
        onSelect(element.id, element.agentId);
      }
    }
  };
  
  return (
    <>
      <div
        ref={nodeRef}
        className={`absolute bg-white border-2 ${
          isConnectionTarget ? 'border-blue-500' : 
          isConnectionSource ? 'border-green-500' : 
          'border-black'
        } rounded-md ${
          isDragging 
            ? 'shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] rotate-1' 
            : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        } cursor-move overflow-hidden transition-all duration-75`}
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${baseWidth}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: isDragging ? 100 : 1,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleNodeClick}
        onMouseUp={handleNodeMouseUp}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Connection handle */}
        <div 
          ref={handleRef}
          className={`absolute -right-3 top-1/2 w-6 h-6 rounded-full bg-white border-2 
            ${isConnecting && isConnectionSource ? 'border-green-500' : 
              isConnecting ? 'border-blue-500' : 'border-black'} 
            transform -translate-y-1/2 cursor-grab z-10 hover:scale-110 transition-transform
            ${isHandleDragging ? 'scale-110' : ''}`}
          onMouseDown={handleConnectionHandleMouseDown}
          style={{
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
        
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
            {onDelete && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 