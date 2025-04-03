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
        
        setResponse(data.choices[0]?.message?.content || 'No response generated');
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
        
        setResponse(data.content[0]?.text || 'No response generated');
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
      
      {/* Model Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
        >
          {AVAILABLE_MODELS.map(model => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {apiProvider === 'openai' 
            ? 'Requires OpenAI API key' 
            : 'Requires Anthropic API key'}
        </p>
      </div>
      
      {/* API Key Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {apiProvider === 'openai' ? 'OpenAI API Key' : 'Anthropic API Key'}
        </label>
        <div className="relative">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveApiKey}
            disabled={isSaving}
            className={`px-3 py-1 text-sm font-medium rounded-md bg-black text-white hover:bg-gray-800 ${
              isSaving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save Configuration'}
          </button>
        </div>
      </div>
      
      {/* Prompt Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Test Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
        />
      </div>
      
      {/* Test Button */}
      <div className="mb-4">
        <button
          onClick={testAgent}
          disabled={isLoading}
          className={`w-full px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Testing...
            </span>
          ) : (
            'Test Agent'
          )}
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
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Response
          </label>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap text-black">{response}</p>
          </div>
        </div>
      )}
    </div>
  );
}