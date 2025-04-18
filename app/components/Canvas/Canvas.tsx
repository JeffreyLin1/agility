'use client'
import { useState, useRef, useEffect } from 'react';
import { Agent, Workflow, WorkflowElement, Connection } from '@/app/types';
import WorkflowNode from './WorkflowNode';
import ConnectionLine from './ConnectionLine';
import { useAuth } from '@/app/context/AuthContext';
import ConfigSidebar from '../Agents/ConfigSidebar';
import { useToast } from '../ui/Toast';
import { v4 as uuidv4 } from 'uuid';

interface CanvasProps {
  workflow: Workflow;
  onWorkflowChange?: (workflow: Workflow) => void;
}

export default function Canvas({ workflow, onWorkflowChange }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [connectionSourcePos, setConnectionSourcePos] = useState<{ x: number, y: number } | null>(null);
  const [tempConnectionTarget, setTempConnectionTarget] = useState<{ x: number, y: number } | null>(null);
  
  // AI chat state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // Add this new state to track whether the AI prompt is visible
  const [isAiPromptVisible, setIsAiPromptVisible] = useState(false);
  
  // Add these state variables to the Canvas component
  const [configSidebarOpen, setConfigSidebarOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  // Add these new state variables to your Canvas component
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { session } = useAuth();
  const { showToast } = useToast();
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Check if this is a template drop
    const templateData = e.dataTransfer.getData('application/json-template');
    if (templateData) {
      handleTemplateDrop(e);
      return;
    }
    
    try {
      // Get the agent data from the drag event
      const agentData = e.dataTransfer.getData('application/json');
      if (!agentData) return;
      
      const agent = JSON.parse(agentData) as Agent;
      
      // Calculate position relative to the canvas, accounting for pan
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      
      // Calculate the position in the panned coordinate system
      const x = e.clientX - canvasRect.left - panOffset.x;
      const y = e.clientY - canvasRect.top - panOffset.y;
      
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
  
  const handleElementDelete = (elementId: string) => {
    if (!onWorkflowChange) return;
    
    const updatedElements = workflow.elements.filter(
      element => element.id !== elementId
    );
    
    // Also remove any connections involving this element
    const updatedConnections = workflow.connections.filter(
      connection => 
        connection.sourceId !== elementId && 
        connection.targetId !== elementId
    );
    
    onWorkflowChange({
      ...workflow,
      elements: updatedElements,
      connections: updatedConnections
    });
  };

  const handleElementPositionChange = (elementId: string, newPosition: { x: number, y: number }) => {
    if (!onWorkflowChange) return;
    
    const updatedElements = workflow.elements.map(element => 
      element.id === elementId 
        ? { ...element, position: newPosition } 
        : element
    );
    
    onWorkflowChange({
      ...workflow,
      elements: updatedElements
    });
  };
  
  // Connection handlers
  const handleConnectionStart = (elementId: string, position: { x: number, y: number }) => {
    setIsConnecting(true);
    setConnectionSource(elementId);
    setConnectionSourcePos(position);
    setTempConnectionTarget(position); // Initialize with the source position
  };
  
  const handleConnectionEnd = async (targetId: string | null) => {
    if (connectionSource && targetId && connectionSource !== targetId) {
      // Create a new connection
      const newConnection: Connection = {
        id: `connection-${Date.now()}`,
        sourceId: connectionSource,
        targetId: targetId,
        type: 'default'
      };
      
      // Update the workflow with the new connection
      if (onWorkflowChange) {
        onWorkflowChange({
          ...workflow,
          connections: [...workflow.connections, newConnection]
        });
      }
    }
    
    // Reset connection state
    setIsConnecting(false);
    setConnectionSource(null);
    setConnectionSourcePos(null);
    setTempConnectionTarget(null);
  };
  
  const handleConnectionDelete = (connectionId: string) => {
    if (!onWorkflowChange) return;
    
    const updatedConnections = workflow.connections.filter(
      connection => connection.id !== connectionId
    );
    
    onWorkflowChange({
      ...workflow,
      connections: updatedConnections
    });
  };
  
  // Canvas panning handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only start panning with left mouse button and not when connecting
    if (e.button === 0 && !isConnecting) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };
  
  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      
      setPanOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (isConnecting) {
      // Update temp connection target position for drawing the line
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (canvasRect) {
        setTempConnectionTarget({
          x: e.clientX - canvasRect.left - panOffset.x,
          y: e.clientY - canvasRect.top - panOffset.y
        });
      }
    }
  };
  
  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    
    // If we're connecting and mouse is released not on a node, cancel the connection
    if (isConnecting) {
      setIsConnecting(false);
      setConnectionSource(null);
      setConnectionSourcePos(null);
      setTempConnectionTarget(null);
    }
  };
  
  const handleCanvasClick = () => {
    // Cancel connection on canvas click
    if (isConnecting) {
      setIsConnecting(false);
      setConnectionSource(null);
      setConnectionSourcePos(null);
      setTempConnectionTarget(null);
    }
  };
  
  useEffect(() => {
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleCanvasMouseMove);
      window.removeEventListener('mouseup', handleCanvasMouseUp);
    };
  }, [isPanning, isConnecting, panStart, panOffset, connectionSource]);

  // Calculate grid offset to ensure the grid always appears to extend infinitely
  const gridOffsetX = panOffset.x % 20;
  const gridOffsetY = panOffset.y % 20;
  
  // Get element positions for connections
  const getElementPosition = (elementId: string) => {
    const element = workflow.elements.find(el => el.id === elementId);
    return element ? element.position : { x: 0, y: 0 };
  };

  // Function to generate a workflow using OpenAI via Supabase Edge Function
  const generateWorkflow = async (prompt: string) => {
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      if (!session?.access_token) {
        showToast('You must be logged in to generate workflows', 'error');
        return;
      }
      
      // Call the Supabase Edge Function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-workflow`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ prompt }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update the workflow with the generated data
      if (onWorkflowChange) {
        onWorkflowChange(data.workflow);
      }
      setAiPrompt('');
      setIsAiPromptVisible(false);
    } catch (error: any) {
      console.error('Error generating workflow:', error);
      setGenerationError(error.message || 'Failed to generate workflow');
    } finally {
      setIsGenerating(false);
    }
  };

  // Update the positionWorkflowElements function to create a horizontal layout
  const positionWorkflowElements = (elements: WorkflowElement[]) => {
    return elements.map((element, index) => {
      return {
        ...element,
        position: {
          x: 200 + (index * 250), // Position horizontally with spacing
          y: 300 // All at the same vertical position
        }
      };
    });
  };

  // Add this function to toggle the AI prompt visibility
  const toggleAiPrompt = () => {
    setIsAiPromptVisible(!isAiPromptVisible);
    // Focus the input when it becomes visible
    if (!isAiPromptVisible) {
      setTimeout(() => {
        const inputElement = document.getElementById('ai-prompt-input');
        if (inputElement) {
          inputElement.focus();
        }
      }, 100);
    }
  };

  // Add this function to handle element selection
  const handleElementSelect = (elementId: string, agentId: string) => {
    setSelectedElement(elementId);
    setSelectedAgentId(agentId);
    setConfigSidebarOpen(true);
  };

  // Modify the saveWorkflow function
  const saveWorkflow = async () => {
    if (!session?.access_token) {
      showToast('You must be logged in to save a workflow', 'error');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Origin': window.location.origin
        },
        body: JSON.stringify({
          action: 'save',
          workflowData: workflow
        })
      });
      
      if (!response) {
        throw new Error('Network error: No response received');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // If the response includes a workflow ID, update the state
      if (data.workflow && data.workflow.id) {
        const savedWorkflowId = data.workflow.id;
        setWorkflowId(savedWorkflowId);
        
        // Save the connections to the agent_connections table
        console.log('Saving workflow connections:', workflow.connections.length);
        
        // For each connection in the workflow
        for (const connection of workflow.connections) {
          console.log('Saving connection:', connection.sourceId, '->', connection.targetId);
          
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-connections`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              workflowId: savedWorkflowId,
              sourceElementId: connection.sourceId,
              targetElementId: connection.targetId
            })
          });
        }
        console.log('Connections saved successfully');
      }
      
      showToast('Workflow saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving workflow:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save workflow', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Modify the loadWorkflow function
  const loadWorkflow = async () => {
    if (!session?.access_token) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'load'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load workflow');
      }
      
      // Check if we have workflow data and update the state
      if (data.workflow && data.workflow.data) {
        // Update the workflowId state
        if (data.workflow.id) {
          setWorkflowId(data.workflow.id);
        }
        
        // Update the workflow with the loaded data
        if (onWorkflowChange) {
          onWorkflowChange(data.workflow.data);
        }
      }
    } catch (err: any) {
      console.error('Error loading workflow:', err);
      showToast(err.message || 'Failed to load workflow', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Inside the Canvas component, add this function to handle template drops
  const handleTemplateDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      // Get the template data from the drag event
      const templateData = e.dataTransfer.getData('application/json-template');
      if (!templateData) return;
      
      const template = JSON.parse(templateData) as Workflow;
      
      // Calculate position relative to the canvas, accounting for pan
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      
      // Calculate the drop position in the panned coordinate system
      const dropX = e.clientX - canvasRect.left - panOffset.x;
      const dropY = e.clientY - canvasRect.top - panOffset.y;
      
      // Find the top-left position of the template
      const minX = Math.min(...template.elements.map(el => el.position.x));
      const minY = Math.min(...template.elements.map(el => el.position.y));
      
      // Create a map of old element IDs to new element IDs
      const idMap = new Map<string, string>();
      
      // Create new elements with adjusted positions
      const newElements = template.elements.map(element => {
        const newId = `element-${uuidv4()}`;
        idMap.set(element.id, newId);
        
        return {
          ...element,
          id: newId,
          position: {
            x: element.position.x - minX + dropX,
            y: element.position.y - minY + dropY
          }
        };
      });
      
      // Create new connections with updated element IDs
      const newConnections = template.connections.map(connection => {
        return {
          id: `connection-${uuidv4()}`,
          sourceId: idMap.get(connection.sourceId) || '',
          targetId: idMap.get(connection.targetId) || '',
          type: connection.type
        };
      });
      
      // Update the workflow with the new elements and connections
      if (onWorkflowChange) {
        onWorkflowChange({
          ...workflow,
          elements: [...workflow.elements, ...newElements],
          connections: [...workflow.connections, ...newConnections]
        });
      }
    } catch (error) {
      console.error('Error handling template drop:', error);
    }
  };

  // Add this useEffect to load the workflow when the component mounts
  useEffect(() => {
    // Only attempt to load if the user is logged in
    if (session?.access_token) {
      loadWorkflow();
    }
  }, [session]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        {isConnecting && (
          <div className="bg-white px-4 py-2 rounded-md border-2 border-black shadow-md">
            <p className="text-sm font-medium text-black">
              {connectionSource ? "Drag to a target node or release to cancel" : "Select a source node"}
            </p>
          </div>
        )}
      </div>
      
      {/* AI Workflow Generator Button - positioned next to the agents sidebar */}
      <div className="absolute top-4 left-4 z-20">
        <button 
          className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 transition-all"
          onClick={toggleAiPrompt}
          title="Ask AI to generate a workflow"
          style={{ backgroundColor: 'white' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-pulse"></span>
        </button>
      </div>
      
      {/* AI Workflow Generator - only show when visible */}
      {isAiPromptVisible && (
        <div className="absolute top-4 left-1/2 z-20 transform -translate-x-1/2 flex flex-col space-y-2">
          <div className="bg-white border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 flex items-center">
            <input
              id="ai-prompt-input"
              type="text"
              placeholder="Describe a workflow to generate..."
              className="flex-1 px-3 py-2 text-base text-black font-medium border-none outline-none w-96"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isGenerating) {
                  generateWorkflow(aiPrompt);
                } else if (e.key === 'Escape') {
                  toggleAiPrompt();
                }
              }}
              disabled={isGenerating}
            />
            <button
              className={`ml-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-md 
                ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
              onClick={(e) => {
                e.preventDefault();
                generateWorkflow(aiPrompt);
              }}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate"
              )}
            </button>
            <button
              className="ml-2 px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100"
              onClick={toggleAiPrompt}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Add the ConfigSidebar component */}
      <ConfigSidebar 
        isOpen={configSidebarOpen}
        onClose={() => setConfigSidebarOpen(false)}
        elementId={selectedElement}
        agentId={selectedAgentId}
      />
      
      {/* Add this to your toolbar JSX */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
        <button
          onClick={saveWorkflow}
          disabled={isSaving}
          className={`px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
            isSaving ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: 'white', color: 'black' }}
        >
          {isSaving ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            "Save Workflow"
          )}
        </button>
      </div>
      
      <div 
        className="absolute inset-0 bg-white overflow-hidden cursor-grab"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onClick={handleCanvasClick}
        style={{ cursor: isPanning ? 'grabbing' : isConnecting ? 'crosshair' : 'grab' }}
      >
        {/* Grid background - using fixed positioning and modulo offset for infinite appearance */}
        <div 
          className="absolute inset-0 w-full h-full" 
          style={{
            backgroundImage: 'linear-gradient(var(--grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
            '--grid-color': 'rgba(0, 0, 0, 0.1)'
          } as React.CSSProperties}>
        </div>
        
        {/* Canvas content - workflow elements and connections */}
        <div 
          className="absolute inset-0 w-full h-full"
          ref={contentRef}
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          {/* SVG layer for connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Existing connections */}
            {workflow.connections.map(connection => {
              const sourcePos = getElementPosition(connection.sourceId);
              const targetPos = getElementPosition(connection.targetId);
              
              return (
                <ConnectionLine 
                  key={connection.id}
                  connection={connection}
                  sourcePosition={sourcePos}
                  targetPosition={targetPos}
                  onDelete={() => handleConnectionDelete(connection.id)}
                />
              );
            })}
            
            {/* Temporary connection line while connecting */}
            {isConnecting && connectionSourcePos && tempConnectionTarget && (
              <g className="connection-line-dragging">
                {/* Generate greater-than signs for the temporary connection */}
                {(() => {
                  const angle = Math.atan2(
                    tempConnectionTarget.y - connectionSourcePos.y, 
                    tempConnectionTarget.x - connectionSourcePos.x
                  );
                  
                  const distance = Math.sqrt(
                    Math.pow(tempConnectionTarget.x - connectionSourcePos.x, 2) + 
                    Math.pow(tempConnectionTarget.y - connectionSourcePos.y, 2)
                  );
                  
                  const arrowSize = 12; // Match the size in ConnectionLine
                  const arrowSpacing = arrowSize * 1.1; // Match the spacing in ConnectionLine
                  const numArrows = Math.floor(distance / arrowSpacing) - 1;
                  
                  const arrows = [];
                  for (let i = 1; i <= numArrows; i++) {
                    const ratio = i * arrowSpacing / distance;
                    const x = connectionSourcePos.x + (tempConnectionTarget.x - connectionSourcePos.x) * ratio;
                    const y = connectionSourcePos.y + (tempConnectionTarget.y - connectionSourcePos.y) * ratio;
                    
                    arrows.push(
                      <text 
                        key={i}
                        x="0"
                        y="0"
                        fontSize={arrowSize * 1.5}
                        fontFamily="monospace"
                        fontWeight="bold"
                        fill="#3b82f6" // Blue color for the temporary connection
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`translate(${x}, ${y}) rotate(${angle * 180 / Math.PI})`}
                      >
                        &gt;
                      </text>
                    );
                  }
                  
                  return arrows;
                })()}
                
                {/* Animated circle at the end of the line */}
                <circle 
                  cx={tempConnectionTarget.x} 
                  cy={tempConnectionTarget.y} 
                  r="6" 
                  fill="#3b82f6"
                  className="animate-pulse"
                />
              </g>
            )}
          </svg>
          
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
                onPositionChange={handleElementPositionChange}
                onDelete={() => handleElementDelete(element.id)}
                onConnectionStart={handleConnectionStart}
                onConnectionEnd={handleConnectionEnd}
                isConnecting={isConnecting}
                isConnectionSource={connectionSource === element.id}
                isConnectionTarget={isConnecting && connectionSource !== element.id}
                onSelect={handleElementSelect}
              />
            ))
          )}
        </div>
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-50">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-10 w-10 text-black mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-black font-medium">Loading your workflow...</p>
          </div>
        </div>
      )}
    </div>
  );
} 