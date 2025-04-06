import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { AgentOutputStructure } from '@/app/types';
import { 
  textGeneratorOutputStructure, 
  gmailReaderOutputStructure,
  discordMessengerOutputStructure,
  githubReaderOutputStructure
} from '@/app/constants/agentOutputStructures';

interface InputStructureDisplayProps {
  elementId: string;
  onInsertField?: (fieldPath: string) => void;
}

export default function InputStructureDisplay({ elementId, onInsertField }: InputStructureDisplayProps) {
  const [inputStructure, setInputStructure] = useState<AgentOutputStructure | null>(null);
  const [sourceElementName, setSourceElementName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { session } = useAuth();
  
  useEffect(() => {
    const fetchInputStructure = async () => {
      if (!session?.access_token || !elementId) {
        console.log('Missing session or elementId', { session: !!session, elementId });
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Fetch all connections for the user
        console.log('Fetching connections for element:', elementId);
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-connections`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        const data = await response.json();
        console.log('Connections response:', data);
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch connections');
        }
        
        // Find connections where this element is the target
        const incomingConnection = data.connections?.find(
          (connection: any) => connection.target_element_id === elementId
        );
        console.log('Found incoming connection:', incomingConnection);
        
        if (!incomingConnection) {
          // No incoming connections
          setInputStructure(null);
          setSourceElementName(null);
          setIsLoading(false);
          return;
        }
        
        // Get the source element details
        const sourceElementId = incomingConnection.source_element_id;
        
        if (!sourceElementId) {
          throw new Error('Source element ID not found in connection');
        }
        
        // Fetch the workflow to get element details
        const workflowResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-workflows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'load'
          })
        });
        
        const workflowData = await workflowResponse.json();
        
        if (!workflowResponse.ok) {
          throw new Error(workflowData.error || 'Failed to fetch workflow');
        }
        
        // Find the source element in the workflow
        const sourceElement = workflowData.workflow?.data?.elements?.find(
          (element: any) => element.id === sourceElementId
        );
        
        if (!sourceElement) {
          throw new Error('Source element not found in workflow');
        }
        
        setSourceElementName(sourceElement.data.name);
        
        // Determine the output structure based on the agent type
        let outputStructure: AgentOutputStructure | null = null;
        
        if (sourceElement.data.name === 'Text Generator') {
          outputStructure = textGeneratorOutputStructure;
        } else if (sourceElement.data.name === 'Gmail Reader') {
          outputStructure = gmailReaderOutputStructure;
        } else if (sourceElement.data.name === 'Discord Messenger') {
          outputStructure = discordMessengerOutputStructure;
        } else if (sourceElement.data.name === 'GitHub Reader') {
          outputStructure = githubReaderOutputStructure;
        }
        
        setInputStructure(outputStructure);
      } catch (err: any) {
        console.error('Error fetching input structure:', err);
        setError(err.message || 'Failed to fetch input structure');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInputStructure();
  }, [session, elementId]);
  
  const handleFieldClick = (fieldName: string) => {
    if (onInsertField) {
      onInsertField(`{{input.${fieldName}}}`);
    }
  };
  
  if (isLoading) {
    return <div className="text-sm text-black mb-5">Loading input structure...</div>;
  }
  
  if (!inputStructure) {
    return <div className="text-sm text-black mb-5">No incoming connections found.</div>;
  }
  
  return (
    <div className="mt-4 mb-6 border-2 border-black rounded-sm p-4 bg-white">
      <h3 className="text-md font-bold mb-2 text-black uppercase text-sm">
        Input from {sourceElementName}
      </h3>
      <p className="text-sm text-black mb-3">{inputStructure.description}</p>
      
      <div className="flex flex-wrap gap-2 mb-3">
        {inputStructure.fields.map((field) => (
          <button
            key={field.name}
            onClick={() => handleFieldClick(field.name)}
            className="px-3 py-1.5 bg-white !bg-white border-2 border-black rounded-sm text-sm hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            style={{ backgroundColor: 'white' }}
            title={field.description || field.name}
          >
            <span className="font-mono text-black">{field.name}</span>
            <span className="text-xs text-black bg-gray-100 px-1.5 py-0.5 rounded-sm border border-black">
              {field.type}
            </span>
            {field.required && (
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full" title="Required"></span>
            )}
          </button>
        ))}
      </div>
      
      <div className="mt-3 text-xs text-black">
        <p>Click on a field to insert it into your content.</p>
      </div>
    </div>
  );
} 