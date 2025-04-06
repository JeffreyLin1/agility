import { useState, useEffect } from 'react';
import TextGeneratorConfig from './TextGeneratorConfig';
import GmailSenderConfig from './GmailSenderConfig';
import GmailReaderConfig from './GmailReaderConfig';
import DiscordMessengerConfig from './DiscordMessengerConfig';
import GitHubReaderConfig from './GitHubReaderConfig';
import { availableAgents } from '@/app/lib/agents';

interface ConfigSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  elementId: string | null;
  agentId: string | null;
}

export default function ConfigSidebar({ isOpen, onClose, elementId, agentId }: ConfigSidebarProps) {
  // Find the agent's color based on agentId
  const agentColor = agentId 
    ? availableAgents.find(agent => agent.id === agentId)?.color || '#ffffff'
    : '#ffffff';
  
  const agentName = agentId
    ? availableAgents.find(agent => agent.id === agentId)?.name || 'Unknown Agent'
    : 'Agent Config';
  
  const renderAgentConfig = () => {
    if (!elementId) return null;
    
    switch (agentId) {
      case '1':
        return <TextGeneratorConfig elementId={elementId} onClose={onClose} />;
      case '2':
        return <GmailSenderConfig elementId={elementId} onClose={onClose} />;
      case '3':
        return <GmailReaderConfig elementId={elementId} onClose={onClose} />;
      case '4':
        return <DiscordMessengerConfig elementId={elementId} onClose={onClose} />;
      case '5':
        return <GitHubReaderConfig elementId={elementId} onClose={onClose} />;
      default:
        return <div className="p-4 font-mono">Unknown agent type</div>;
    }
  };

  return (
    <div 
      className={`fixed right-0 top-0 h-full bg-white border-l-4 border-black shadow-lg z-30 transition-all duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ width: '400px' }}
    >
      <div 
        className="flex justify-between items-center p-4 border-b-4 border-black"
        style={{ backgroundColor: agentColor }}
      >
        <h2 className="font-bold text-lg text-black font-mono uppercase tracking-wide">{agentName}</h2>
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center border-2 border-black hover:bg-opacity-20 hover:bg-black"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div 
        className="p-4 overflow-y-auto" 
        style={{ 
          height: 'calc(100% - 70px)',
          backgroundColor: agentColor,
          backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,1) 15%)'
        }}
      >
        {renderAgentConfig()}
        
        {isOpen && (!elementId || (agentId !== '1' && agentId !== '2' && agentId !== '3' && agentId !== '4' && agentId !== '5')) && (
          <div className="flex items-center justify-center h-full">
            <p className="text-black font-mono border-2 border-black p-4 bg-yellow-100">No configuration available for this agent</p>
          </div>
        )}
      </div>
    </div>
  );
} 