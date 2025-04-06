import { useState } from 'react';
import { Workflow } from '@/app/types';
import { availableAgents } from '@/app/lib/agents';

interface FloatingPanelProps {
  onAgentDragStart: (e: React.DragEvent, agent: any) => void;
  onTemplateDragStart: (e: React.DragEvent, template: Workflow) => void;
  templates: Workflow[];
}

export default function FloatingPanel({ 
  onAgentDragStart, 
  onTemplateDragStart,
  templates
}: FloatingPanelProps) {
  const [activeTab, setActiveTab] = useState<'agents' | 'templates'>('agents');
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div 
      className={`fixed left-4 top-24 bg-white border-2 border-black shadow-lg z-20 transition-all duration-300 font-mono ${
        isCollapsed ? 'w-12' : 'w-64'
      }`}
    >
      {/* Header with collapse button */}
      <div className="flex justify-between items-center border-b-2 border-black bg-white">
        {!isCollapsed && (
          <div className="flex w-full">
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex-1 py-3 px-4 font-bold text-sm uppercase ${
                activeTab === 'agents' 
                  ? 'bg-black text-white' 
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex-1 py-3 px-4 font-bold text-sm uppercase ${
                activeTab === 'templates' 
                  ? 'bg-black text-white' 
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              Templates
            </button>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-3 hover:bg-gray-100"
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7"></polyline>
              <polyline points="18 17 13 12 18 7"></polyline>
            </svg>
          )}
        </button>
      </div>

      {/* Panel content */}
      {!isCollapsed && (
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-2">
          {activeTab === 'agents' && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-black mb-2 px-2">Drag to canvas</h3>
              {availableAgents.map((agent) => (
                <div
                  key={agent.id}
                  draggable
                  onDragStart={(e) => onAgentDragStart(e, agent)}
                  className="p-3 border-2 border-black rounded-sm cursor-move hover:bg-gray-50 transition-colors"
                  style={{ backgroundColor: agent.color }}
                >
                  <div className="flex items-center">
                    <div className="mr-3">
                      {agent.icon}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{agent.name}</div>
                      <div className="text-xs">{agent.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-black mb-2 px-2">Drag to canvas</h3>
              {templates.map((template, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={(e) => onTemplateDragStart(e, template)}
                  className="p-3 border-2 border-black rounded-sm cursor-move hover:bg-gray-50 transition-colors"
                >
                  <div className="font-bold text-sm">{template.name}</div>
                  <div className="text-xs mt-1">
                    {template.elements?.length || 0} agents • {template.connections?.length || 0} connections
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-sm text-center py-4 text-gray-500">
                  No templates available
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 