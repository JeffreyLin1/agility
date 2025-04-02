import { useState, useEffect } from 'react';
import { Agent } from '@/app/types';
import AgentList from './AgentList';

interface FloatingAgentPanelProps {
  agents: Agent[];
  onAgentDragStart: (e: React.DragEvent, agent: Agent) => void;
}

export default function FloatingAgentPanel({ agents, onAgentDragStart }: FloatingAgentPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  
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
  
  return (
    <div 
      className={`absolute left-4 top-20 z-10 bg-white border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-500 ${
        isCollapsed ? 'w-12' : 'w-72'
      } ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}
    >
      <div className="flex justify-between items-center p-2 border-b-2 border-black">
        {!isCollapsed && <h3 className="font-bold text-black">Agents</h3>}
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
      
      {!isCollapsed && (
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
                <span className="text-xs font-bold">{agent.name.charAt(0)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 