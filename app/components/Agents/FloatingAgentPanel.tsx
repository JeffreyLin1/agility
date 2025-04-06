import { useState, useEffect } from 'react';
import { Agent, Workflow } from '@/app/types';
import AgentList from './AgentList';
import WorkflowTemplate from '../Templates/WorkflowTemplate';

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

interface FloatingAgentPanelProps {
  agents: Agent[];
  onAgentDragStart: (e: React.DragEvent, agent: Agent) => void;
  onTemplateDragStart: (e: React.DragEvent, template: Workflow) => void;
}

export default function FloatingAgentPanel({ agents, onAgentDragStart, onTemplateDragStart }: FloatingAgentPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('agents');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 300); // Slightly delayed after page load
    
    return () => clearTimeout(timer);
  }, []);
  
  // Filter agents based on search query
  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Define tabs
  const tabs = [
    { id: 'agents', label: 'Agents', icon: '👤' },
    { id: 'templates', label: 'Templates', icon: '📋' },
    { id: 'favorites', label: 'Favorites', icon: '⭐' },
  ];

  // Define templates
  const templates = [textGeneratorChain];
  
  return (
    <div 
      className={`absolute left-4 top-20 z-10 bg-white border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-500 ${
        isCollapsed ? 'w-12' : 'w-72'
      } ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}
    >
      <div className="flex justify-between items-center p-2 border-b-2 border-black">
        {!isCollapsed && <h3 className="font-bold text-black">{tabs.find(tab => tab.id === activeTab)?.label}</h3>}
        <button 
          className="ml-auto p-1 hover:bg-gray-100 rounded"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7"></polyline>
              <polyline points="18 17 13 12 18 7"></polyline>
            </svg>
          )}
        </button>
      </div>
      
      {/* Tab buttons on the side */}
      <div className="absolute -right-11 top-12 flex flex-col space-y-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`w-10 h-10 rounded-tr-md rounded-br-md border-2 border-l-0 border-black flex items-center justify-center transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-black font-bold border-l-white -ml-[4px] z-10' 
                : 'bg-white text-black hover:bg-gray-100'
            }`}
            style={{ backgroundColor: 'white', color: 'black' }}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            {tab.id === 'agents' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21v-2a7 7 0 0 0-14 0v2" />
              </svg>
            )}
            {tab.id === 'templates' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            )}
            {tab.id === 'favorites' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
          </button>
        ))}
      </div>
      
      {!isCollapsed && activeTab === 'agents' && (
        <>
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                </svg>
              </div>
              <input 
                type="search" 
                className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-black focus:border-black" 
                placeholder="Search agents..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Agent list - height set to show approximately 4 agents */}
          <div className="max-h-[520px] overflow-y-auto">
            <AgentList 
              agents={filteredAgents} 
              onAgentDragStart={onAgentDragStart}
            />
            {filteredAgents.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                No agents found matching "{searchQuery}"
              </div>
            )}
          </div>
        </>
      )}
      
      {!isCollapsed && activeTab === 'templates' && (
        <div className="p-3 space-y-3 max-h-[520px] overflow-y-auto">
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
      )}
      
      {!isCollapsed && activeTab === 'favorites' && (
        <div className="p-4">
          <h4 className="font-semibold mb-2 text-black">Favorites</h4>
          <p className="text-gray-600">Your favorite agents will appear here.</p>
        </div>
      )}
      
      {isCollapsed && (
        <div className="p-2 flex flex-col items-center space-y-4 max-h-[320px] overflow-y-auto">
          {agents.map(agent => (
            <div 
              key={agent.id}
              className="w-8 h-8 rounded-full border border-black flex items-center justify-center cursor-grab"
              style={{ backgroundColor: agent.color || '#ffffff' }}
              draggable
              onDragStart={(e) => onAgentDragStart(e, agent)}
              title={agent.name}
            >
              {agent.icon ? (
                <span>{agent.icon}</span>
              ) : (
                <span className="text-xs font-bold text-black">{agent.name.charAt(0)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 