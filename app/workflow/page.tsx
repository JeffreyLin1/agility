'use client';

import { useState } from 'react';
import { Agent, Workflow } from '../types';
import { Header, Sidebar } from '../components/Layout';
import { AgentList } from '../components/Agents';
import { Canvas } from '../components/Canvas';

// Sample data for initial development
const sampleAgents: Agent[] = [
  {
    id: '1',
    name: 'Text Generator',
    description: 'Generates text based on prompts',
    color: '#f0f9ff'  // Light blue
  },
  {
    id: '2',
    name: 'Image Analyzer',
    description: 'Analyzes images and extracts information',
    color: '#f0fdf4'  // Light green
  },
  {
    id: '3',
    name: 'Data Processor',
    description: 'Processes and transforms data',
    color: '#fef2f2'  // Light red
  },
  {
    id: '4',
    name: 'Decision Maker',
    description: 'Makes decisions based on input data',
    color: '#fffbeb'  // Light yellow
  }
];

const emptyWorkflow: Workflow = {
  id: 'new-workflow',
  name: 'New Workflow',
  elements: [],
  connections: []
};

export default function WorkflowPage() {
  const [agents] = useState<Agent[]>(sampleAgents);
  const [workflow, setWorkflow] = useState<Workflow>(emptyWorkflow);

  const handleAgentDragStart = (e: React.DragEvent, agent: Agent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(agent));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <div className="flex-1 flex">
        <Sidebar>
          <AgentList 
            agents={agents} 
            onAgentDragStart={handleAgentDragStart}
          />
        </Sidebar>
        <div className="flex-1 p-6">
          <Canvas 
            workflow={workflow} 
            onWorkflowChange={setWorkflow}
          />
        </div>
      </div>
    </div>
  );
} 