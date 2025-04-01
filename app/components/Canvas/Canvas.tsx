import { useState, useRef, useEffect } from 'react';
import { Agent, Workflow, WorkflowElement } from '@/app/types';
import CanvasToolbar from './CanvasToolbar';
import WorkflowNode from './WorkflowNode';

interface CanvasProps {
  workflow: Workflow;
  onWorkflowChange?: (workflow: Workflow) => void;
}

export default function Canvas({ workflow, onWorkflowChange }: CanvasProps) {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      // Get the agent data from the drag event
      const agentData = e.dataTransfer.getData('application/json');
      if (!agentData) return;
      
      const agent = JSON.parse(agentData) as Agent;
      
      // Calculate position relative to the canvas
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      
      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;
      
      // Create a new workflow element
      const newElement: WorkflowElement = {
        id: `element-${Date.now()}`,
        type: 'agent',
        agentId: agent.id,
        position: { x, y },
        data: {
          name: agent.name,
          description: agent.description,
          color: agent.color,
          icon: agent.icon
        }
      };
      
      // Update the workflow with the new element
      const updatedWorkflow = {
        ...workflow,
        elements: [...workflow.elements, newElement]
      };
      
      if (onWorkflowChange) {
        onWorkflowChange(updatedWorkflow);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };
  
  const handleElementSelect = (elementId: string) => {
    setSelectedElementId(elementId === selectedElementId ? null : elementId);
  };
  
  const handleElementDelete = () => {
    if (!selectedElementId || !onWorkflowChange) return;
    
    const updatedElements = workflow.elements.filter(
      element => element.id !== selectedElementId
    );
    
    // Also remove any connections involving this element
    const updatedConnections = workflow.connections.filter(
      connection => 
        connection.sourceId !== selectedElementId && 
        connection.targetId !== selectedElementId
    );
    
    onWorkflowChange({
      ...workflow,
      elements: updatedElements,
      connections: updatedConnections
    });
    
    setSelectedElementId(null);
  };

  const handleElementPositionChange = (elementId: string, newPosition: { x: number, y: number }) => {
    if (!onWorkflowChange) return;
    
    const updatedElements = workflow.elements.map(element => {
      if (element.id === elementId) {
        return {
          ...element,
          position: newPosition
        };
      }
      return element;
    });
    
    onWorkflowChange({
      ...workflow,
      elements: updatedElements
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedElementId) {
        handleElementDelete();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId]);

  return (
    <div className="flex flex-col h-full">
      <CanvasToolbar 
        workflow={workflow} 
        selectedElementId={selectedElementId}
        onWorkflowChange={onWorkflowChange}
        onElementDelete={handleElementDelete}
      />
      <div 
        className="flex-1 bg-white relative overflow-hidden border-2 border-black rounded-md"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        ref={canvasRef}
      >
        {/* Grid background */}
        <div className="absolute inset-0 w-full h-full" 
             style={{
               backgroundImage: 'linear-gradient(var(--grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)',
               backgroundSize: '20px 20px'
             }}>
        </div>
        
        {/* Canvas content - workflow elements */}
        <div className="absolute inset-0 w-full h-full">
          {workflow.elements.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-black font-medium border border-gray-300 bg-white p-4 rounded shadow-sm">
                Drag agents here to create your workflow
              </p>
            </div>
          ) : (
            workflow.elements.map(element => (
              <WorkflowNode 
                key={element.id}
                element={element}
                isSelected={element.id === selectedElementId}
                onClick={() => handleElementSelect(element.id)}
                onPositionChange={handleElementPositionChange}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
} 