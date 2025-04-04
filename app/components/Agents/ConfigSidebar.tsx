import { useState, useEffect } from 'react';
import TextGeneratorConfig from './TextGeneratorConfig';
import GmailSenderConfig from './GmailSenderConfig';

interface ConfigSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  elementId: string | null;
  agentId: string | null;
}

export default function ConfigSidebar({ isOpen, onClose, elementId, agentId }: ConfigSidebarProps) {
  return (
    <div 
      className={`fixed right-0 top-0 h-full bg-white border-l-2 border-black shadow-lg z-30 transition-all duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ width: '400px' }}
    >
      <div className="flex justify-between items-center p-4 border-b-2 border-black">
        <h2 className="font-bold text-lg text-black">Agent Configuration</h2>
        <button 
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 70px)' }}>
        {isOpen && elementId && agentId === '1' && (
          <TextGeneratorConfig 
            elementId={elementId} 
            onClose={onClose} 
          />
        )}
        
        {isOpen && elementId && agentId === '21' && (
          <GmailSenderConfig 
            elementId={elementId} 
            onClose={onClose} 
          />
        )}
        
        {isOpen && (!elementId || (agentId !== '1' && agentId !== '21')) && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No configuration available for this agent</p>
          </div>
        )}
      </div>
    </div>
  );
} 