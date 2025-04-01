import { Agent } from '@/app/types';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent, agent: Agent) => void;
}

export default function AgentCard({ agent, onClick, onDragStart }: AgentCardProps) {
  return (
    <div 
      className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all rounded-sm"
      onClick={onClick}
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, agent)}
    >
      <div className="flex items-center space-x-3">
        <div 
          className="w-12 h-12 flex items-center justify-center border border-black rounded"
          style={{ backgroundColor: agent.color || '#ffffff' }}
        >
          {agent.icon ? (
            <span>{agent.icon}</span>
          ) : (
            <span className="text-xl font-bold">{agent.name.charAt(0)}</span>
          )}
        </div>
        <div>
          <h3 className="font-bold text-black">{agent.name}</h3>
          <p className="text-sm text-black">{agent.description}</p>
        </div>
      </div>
    </div>
  );
} 