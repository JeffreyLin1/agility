'use client'
import React from 'react';
import { Workflow } from '@/app/types';
import WorkflowTemplate from './WorkflowTemplate';

// Define our template workflows
const textGeneratorChain: Workflow = {
  id: 'template-text-generator-chain',
  name: 'Text Generator Chain',
  elements: [
    {
      id: 'template-element-1',
      type: 'agent',
      agentId: '1', // Text Generator
      position: { x: 200, y: 200 },
      data: {
        name: 'Text Generator',
        description: 'Generates initial text',
        color: '#f0f9ff',
        icon: 'text'
      }
    },
    {
      id: 'template-element-2',
      type: 'agent',
      agentId: '1', // Text Generator
      position: { x: 450, y: 200 },
      data: {
        name: 'Text Generator',
        description: 'Refines the text',
        color: '#f0f9ff',
        icon: 'text'
      }
    }
  ],
  connections: [
    {
      id: 'template-connection-1',
      sourceId: 'template-element-1',
      targetId: 'template-element-2',
      type: 'default'
    }
  ]
};

interface TemplatesPanelProps {
  onTemplateDragStart: (e: React.DragEvent, template: Workflow) => void;
}

export default function TemplatesPanel({ onTemplateDragStart }: TemplatesPanelProps) {
  const templates = [textGeneratorChain];
  
  return (
    <div className="absolute top-20 right-4 z-10 w-64 bg-white border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
      <div className="p-3 border-b-2 border-black bg-gray-50">
        <h2 className="font-medium text-black">Templates</h2>
      </div>
      <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
        {templates.map((template) => (
          <WorkflowTemplate
            key={template.id}
            name={template.name}
            description="Chain two text generators together"
            template={template}
            onDragStart={onTemplateDragStart}
          />
        ))}
      </div>
    </div>
  );
} 