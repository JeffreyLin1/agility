import { Agent } from '@/app/types';
import AgentCard from './AgentCard';

interface AgentListProps {
  agents: Agent[];
  onAgentSelect?: (agent: Agent) => void;
  onAgentDragStart?: (e: React.DragEvent, agent: Agent) => void;
}

export default function AgentList({ agents, onAgentSelect, onAgentDragStart }: AgentListProps) {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold mb-6 border-b border-gray-200 pb-2 text-black">Agents</h2>
      {agents.length === 0 ? (
        <p className="text-black">No agents available</p>
      ) : (
        agents.map((agent) => (
          <AgentCard 
            key={agent.id} 
            agent={agent} 
            onClick={() => onAgentSelect && onAgentSelect(agent)}
            onDragStart={onAgentDragStart}
          />
        ))
      )}
    </div>
  );
} 