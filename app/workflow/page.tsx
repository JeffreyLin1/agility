'use client';

import { useState, useEffect } from 'react';
import { Workflow } from '../types';
import { Header } from '../components/Layout';
import { Canvas } from '../components/Canvas';
import FloatingAgentPanel from '../components/Agents/FloatingAgentPanel';
import { availableAgents } from '../lib/agents';

const emptyWorkflow: Workflow = {
  id: 'new-workflow',
  name: 'New Workflow',
  elements: [],
  connections: []
};

export default function WorkflowPage() {
  const [agents] = useState(availableAgents);
  const [workflow, setWorkflow] = useState<Workflow>(emptyWorkflow);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      setIsLoading(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const handleAgentDragStart = (e: React.DragEvent, agent: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(agent));
  };
  
  const handleTemplateDragStart = (e: React.DragEvent, template: Workflow) => {
    e.dataTransfer.setData('application/json-template', JSON.stringify(template));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white relative">
      <Header />
      <div className={`flex-1 relative transition-all duration-700 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}>
        {/* The canvas now takes up the entire page below the header */}
        <Canvas 
          workflow={workflow} 
          onWorkflowChange={setWorkflow}
        />
        
        {/* Floating agent panel */}
        <FloatingAgentPanel 
          agents={agents} 
          onAgentDragStart={handleAgentDragStart}
          onTemplateDragStart={handleTemplateDragStart}
        />
      </div>
    </div>
  );
} 