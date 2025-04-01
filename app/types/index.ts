export interface Agent {
  id: string;
  name: string;
  description: string;
  color?: string;
  icon?: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowElement {
  id: string;
  type: 'agent';
  agentId: string;
  position: Position;
  data: {
    name: string;
    description: string;
    color?: string;
    icon?: string;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  elements: WorkflowElement[];
  connections: Connection[];
} 