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

export interface Connection {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    data?: any;
  }
  
  // Update the Workflow interface to include connections
  export interface Workflow {
    id: string;
    name: string;
    elements: WorkflowElement[];
    connections: Connection[];
  }
  
  // Make sure emptyWorkflow includes connections
  export const emptyWorkflow: Workflow = {
    id: 'workflow-1',
    name: 'New Workflow',
    elements: [],
    connections: []
  };

// Define output structure types for different agents
export interface AgentOutputStructure {
  type: string;
  fields: AgentOutputField[];
  description?: string;
}

export interface AgentOutputField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
}