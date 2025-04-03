'use client';

import { useState, useEffect } from 'react';
import { Agent, Workflow } from '../types';
import { Header } from '../components/Layout';
import { Canvas } from '../components/Canvas';
import FloatingAgentPanel from '../components/Agents/FloatingAgentPanel';
import TemplatesPanel from '@/app/components/Templates/TemplatesPanel';

// Expanded list of sample agents
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
  },
  {
    id: '5',
    name: 'Language Translator',
    description: 'Translates text between languages',
    color: '#f5f3ff'  // Light purple
  },
  {
    id: '6',
    name: 'Sentiment Analyzer',
    description: 'Analyzes sentiment in text',
    color: '#eff6ff'  // Light blue
  },
  {
    id: '7',
    name: 'Code Generator',
    description: 'Generates code based on requirements',
    color: '#ecfdf5'  // Light green
  },
  {
    id: '8',
    name: 'Speech Recognizer',
    description: 'Converts speech to text',
    color: '#fef2f2'  // Light red
  },
  {
    id: '9',
    name: 'Text Summarizer',
    description: 'Creates concise summaries of longer texts',
    color: '#fff7ed'  // Light orange
  },
  {
    id: '10',
    name: 'Entity Extractor',
    description: 'Identifies and extracts entities from text',
    color: '#f8fafc'  // Light gray
  },
  {
    id: '11',
    name: 'Image Generator',
    description: 'Creates images from text descriptions',
    color: '#f0fdfa'  // Light teal
  },
  {
    id: '12',
    name: 'Question Answerer',
    description: 'Answers questions based on context',
    color: '#faf5ff'  // Light purple
  },
  {
    id: '13',
    name: 'Data Visualizer',
    description: 'Creates visual representations of data',
    color: '#f0f9ff'  // Light blue
  },
  {
    id: '14',
    name: 'Audio Processor',
    description: 'Processes and analyzes audio files',
    color: '#f0fdf4'  // Light green
  },
  {
    id: '15',
    name: 'Document Parser',
    description: 'Extracts structured data from documents',
    color: '#fef2f2'  // Light red
  },
  {
    id: '16',
    name: 'Chatbot',
    description: 'Engages in conversational interactions',
    color: '#fffbeb'  // Light yellow
  },
  {
    id: '17',
    name: 'Video Analyzer',
    description: 'Analyzes video content and extracts information',
    color: '#f5f3ff'  // Light purple
  },
  {
    id: '18',
    name: 'Recommendation Engine',
    description: 'Provides personalized recommendations',
    color: '#eff6ff'  // Light blue
  },
  {
    id: '19',
    name: 'Knowledge Base',
    description: 'Stores and retrieves information',
    color: '#ecfdf5'  // Light green
  },
  {
    id: '20',
    name: 'Anomaly Detector',
    description: 'Identifies unusual patterns in data',
    color: '#fef2f2'  // Light red
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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const handleAgentDragStart = (e: React.DragEvent, agent: Agent) => {
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
        />
        
        {/* Templates panel */}
        <TemplatesPanel
          onTemplateDragStart={handleTemplateDragStart}
        />
      </div>
    </div>
  );
} 