import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';

interface TextGeneratorConfigProps {
  elementId: string;
  onClose?: () => void;
}

// Define available models
const AVAILABLE_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
];

export default function TextGeneratorConfig({ elementId, onClose }: TextGeneratorConfigProps) {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [apiProvider, setApiProvider] = useState('openai'); // 'openai' or 'anthropic'
  const [connectedAgentData, setConnectedAgentData] = useState<any[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  
  const { session } = useAuth();
  
  // Update API provider when model changes
  useEffect(() => {
    if (selectedModel.includes('claude')) {
      setApiProvider('anthropic');
    } else {
      setApiProvider('openai');
    }
  }, [selectedModel]);
  
  // Load the API key and model using the Edge Function
  useEffect(() => {
    const loadConfig = async () => {
      if (!session?.access_token) return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-api-keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get',
            elementId
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load API key');
        }
        
        if (data.apiKey) {
          setApiKey(data.apiKey);
        }
        
        if (data.model) {
          setSelectedModel(data.model);
        }
      } catch (err) {
        // If no key is found, that's okay
        console.log('No saved API key found or error loading key');
      }
    };
    
    loadConfig();
  }, [session, elementId]);
  
  // Load connected agent data
  useEffect(() => {
    const fetchConnectedAgentData = async () => {
      if (!session?.access_token || !elementId) return;
      
      setIsLoadingConnections(true);
      
      try {
        // Get the workflow ID from the element ID (assuming format is "workflowId-elementId")
        const workflowId = elementId.split('-')[0];
        
        // First, get all connections where this element is the target
        const connectionsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-connections?workflowId=${workflowId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        
        if (!connectionsResponse.ok) {
          throw new Error('Failed to fetch connections');
        }
        
        const connectionsData = await connectionsResponse.json();
        const connections = connectionsData.connections || [];
        
        // Filter connections where this element is the target
        const incomingConnections = connections.filter(
          (conn: any) => conn.target_element_id === elementId
        );
        
        if (incomingConnections.length === 0) {
          setConnectedAgentData([]);
          return;
        }
        
        // Get the source element IDs
        const sourceElementIds = incomingConnections.map((conn: any) => conn.source_element_id);
        
        // Fetch agent outputs for these source elements
        const outputsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agent-outputs`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              workflowId,
              elementIds: sourceElementIds,
            }),
          }
        );
        
        if (!outputsResponse.ok) {
          throw new Error('Failed to fetch agent outputs');
        }
        
        const outputsData = await outputsResponse.json();
        setConnectedAgentData(outputsData.outputs || []);
        
        // If we have Gmail Reader data, update the prompt
        const gmailReaderOutputs = outputsData.outputs.filter(
          (output: any) => output.output_data.type === 'gmail_reader'
        );
        
        if (gmailReaderOutputs.length > 0) {
          // Create a formatted string of email data
          let emailContent = "Here are the emails I've read:\n\n";
          
          gmailReaderOutputs.forEach((output: any) => {
            const messages = output.output_data.messages || [];
            
            messages.forEach((message: any, index: number) => {
              emailContent += `Email ${index + 1}:\n`;
              emailContent += `From: ${message.from}\n`;
              emailContent += `Subject: ${message.subject}\n`;
              emailContent += `Date: ${message.date}\n`;
              emailContent += `Content: ${message.body || message.snippet}\n\n`;
            });
          });
          
          // Update the prompt with the email content
          setPrompt(prevPrompt => {
            // If there's already content, append to it
            if (prevPrompt.trim()) {
              return `${emailContent}\n\nPlease analyze the above emails and respond to the following:\n\n${prevPrompt}`;
            }
            // Otherwise, just set a default prompt
            return `${emailContent}\n\nPlease analyze these emails and provide a summary of their content.`;
          });
        }
      } catch (error) {
        console.error('Error fetching connected agent data:', error);
      } finally {
        setIsLoadingConnections(false);
      }
    };
    
    fetchConnectedAgentData();
  }, [session, elementId]);
  
  // Save the API key and model using the Edge Function
  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    
    if (!session?.access_token) {
      setError('You must be logged in to save an API key');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'save',
          elementId,
          apiKey,
          model: selectedModel
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save API key');
      }
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };
  
  const testAgent = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    
    if (!prompt.trim()) {
      setError('Prompt is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      let response;
      let data;
      
      if (apiProvider === 'openai') {
        // Call OpenAI API
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500
          })
        });
        
        data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to generate text');
        }
        
        const generatedText = data.choices[0]?.message?.content || 'No response generated';
        setResponse(generatedText);
        
        // Store the output for other agents to use
        if (session?.access_token) {
          const workflowId = elementId.split('-')[0];
          
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agent-outputs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              action: 'save',
              workflowId,
              elementId,
              outputData: {
                type: 'text_generator',
                text: generatedText,
                metadata: {
                  model: selectedModel,
                  prompt,
                  timestamp: new Date().toISOString()
                }
              }
            })
          });
        }
      } else if (apiProvider === 'anthropic') {
        // Call Anthropic API
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500
          })
        });
        
        data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to generate text');
        }
        
        const generatedText = data.content[0]?.text || 'No response generated';
        setResponse(generatedText);
        
        // Store the output for other agents to use
        if (session?.access_token) {
          const workflowId = elementId.split('-')[0];
          
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agent-outputs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              action: 'save',
              workflowId,
              elementId,
              outputData: {
                type: 'text_generator',
                text: generatedText,
                metadata: {
                  model: selectedModel,
                  prompt,
                  timestamp: new Date().toISOString()
                }
              }
            })
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to test agent');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="font-bold text-lg text-black">Text Generator</h3>
        <p className="text-sm text-gray-600">Configure your Text Generator agent</p>
      </div>
      
      {/* Connected Agent Data */}
      {connectedAgentData.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center mb-2">
            <svg className="h-5 w-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-blue-800">Connected Agent Data Available</span>
          </div>
          <p className="text-sm text-blue-700">
            This agent is receiving data from {connectedAgentData.length} connected agent(s). 
            The prompt has been pre-filled with this data.
          </p>
        </div>
      )}
      
      {/* Model Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* API Key Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {apiProvider === 'openai' ? 'OpenAI API Key' : 'Anthropic API Key'}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`Enter your ${apiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveApiKey}
            disabled={isSaving || !apiKey.trim()}
            className={`px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 ${
              (isSaving || !apiKey.trim()) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
        {isSaved && (
          <div className="mt-2 text-sm text-green-600">
            API key saved successfully!
          </div>
        )}
      </div>
      
      {/* Prompt Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here"
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Test Button */}
      <div className="mb-4">
        <button
          onClick={testAgent}
          disabled={isLoading || !apiKey.trim() || !prompt.trim()}
          className={`w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 ${
            (isLoading || !apiKey.trim() || !prompt.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Generating...' : 'Generate Text'}
        </button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {/* Response Output */}
      {response && (
        <div className="mb-4">
          <h3 className="text-md font-medium mb-2">Generated Text</h3>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md whitespace-pre-line">
            {response}
          </div>
        </div>
      )}
    </div>
  );
}