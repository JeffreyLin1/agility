import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import InputStructureDisplay from './InputStructureDisplay';
import { runWorkflow } from '@/app/lib/workflowRunner';

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
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { session } = useAuth();
  
  // Update API provider when model changes
  useEffect(() => {
    if (selectedModel.includes('claude')) {
      setApiProvider('anthropic');
    } else {
      setApiProvider('openai');
    }
  }, [selectedModel]);
  
  // Handle inserting field into prompt
  const handleInsertField = (fieldPath: string) => {
    if (promptTextareaRef.current) {
      const textarea = promptTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // Insert the field at cursor position or replace selected text
      const newPrompt = prompt.substring(0, start) + fieldPath + prompt.substring(end);
      setPrompt(newPrompt);
      
      // Focus the textarea and set cursor position after the inserted field
      setTimeout(() => {
        textarea.focus();
        const newCursorPosition = start + fieldPath.length;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    } else {
      // If ref not available, just append to the end
      setPrompt(prompt + fieldPath);
    }
  };
  
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
        
        if (data.prompt) {
          setPrompt(data.prompt);
        }
      } catch (err) {
        // If no key is found, that's okay
        console.log('No saved API key found or error loading key');
      }
    };
    
    loadConfig();
  }, [session, elementId]);
  
  // Save the configuration (API key, model, and prompt) using the Edge Function
  const saveConfiguration = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    
    if (!session?.access_token) {
      setError('You must be logged in to save configuration');
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
          model: selectedModel,
          prompt: prompt
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  const testAgent = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      // Use the prompt directly without enhancing it with Gmail data
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
      }
    } catch (err: any) {
      setError(err.message || 'Failed to test agent');
    } finally {
      setIsLoading(false);
    }
  };
  
  const testWorkflow = async () => {
    await runWorkflow(elementId, session, setIsWorkflowRunning);
  };
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-black">Text Generator Configuration</h2>
      
      {/* Input Structure Display */}
      <InputStructureDisplay elementId={elementId} onInsertField={handleInsertField} />
      
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
        />
      </div>
      
      {/* Model Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Prompt Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prompt
        </label>
        <textarea
          ref={promptTextareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here. Click on input fields above to insert them."
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
        />
      </div>
      
      {/* Save Configuration Button */}
      <div className="mb-4">
        <button
          onClick={saveConfiguration}
          disabled={isSaving || !apiKey.trim()}
          className={`w-full px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 ${
            (isSaving || !apiKey.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
        {isSaved && (
          <div className="mt-2 text-sm text-green-600">
            Configuration saved successfully!
          </div>
        )}
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
          {isLoading ? 'Loading...' : 'Test Agent'}
        </button>
      </div>
      
      {/* Test Workflow Button */}
      <div className="mb-4 mt-2">
        <button
          onClick={testWorkflow}
          disabled={isWorkflowRunning || !apiKey.trim() || !prompt.trim()}
          className={`w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 ${
            (isWorkflowRunning || !apiKey.trim() || !prompt.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isWorkflowRunning ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running Workflow...
            </span>
          ) : (
            'Test Workflow'
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
        <div className="mb-4">
          <h3 className="text-md font-medium mb-2 text-black">Generated Text</h3>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md whitespace-pre-line text-black">
            {response}
          </div>
        </div>
      )}
    </div>
  );
}