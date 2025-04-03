'use client'
import React from 'react';
import { Workflow } from '@/app/types';

interface WorkflowTemplateProps {
  name: string;
  description: string;
  template: Workflow;
  onDragStart: (e: React.DragEvent, template: Workflow) => void;
}

export default function WorkflowTemplate({ 
  name, 
  description, 
  template, 
  onDragStart 
}: WorkflowTemplateProps) {
  return (
    <div 
      className="p-4 bg-white border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-move hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow"
      draggable
      onDragStart={(e) => onDragStart(e, template)}
    >
      <div className="flex items-center mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="15" y1="3" x2="15" y2="21"></line>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="21" y2="15"></line>
        </svg>
        <h3 className="font-medium text-black">{name}</h3>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
      <div className="mt-2 text-xs text-gray-500">
        {template.elements.length} agents • {template.connections.length} connections
      </div>
    </div>
  );
} 