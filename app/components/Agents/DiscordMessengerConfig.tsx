import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import InputStructureDisplay from './InputStructureDisplay';
import { runWorkflow } from '@/app/lib/workflowRunner';

interface DiscordMessengerConfigProps {
  elementId: string;
  onClose?: () => void;
}

export default function DiscordMessengerConfig({ elementId, onClose }: DiscordMessengerConfigProps) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  
  const messageContentTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { session } = useAuth();
  
  // Load saved configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!session?.access_token) return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-agent-configs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get-config',
            elementId,
            agentType: 'discord_messenger'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.config) {
          if (data.config.webhookUrl) setWebhookUrl(data.config.webhookUrl);
          if (data.config.username) setUsername(data.config.username);
          if (data.config.avatarUrl) setAvatarUrl(data.config.avatarUrl);
          if (data.config.messageContent) setMessageContent(data.config.messageContent);
        }
      } catch (err) {
        console.log('No saved configuration found or error loading configuration');
      }
    };
    
    loadConfig();
  }, [session, elementId]);
  
  // Handle inserting fields from input structure
  const handleInsertField = (fieldPath: string) => {
    if (messageContentTextareaRef.current) {
      const textarea = messageContentTextareaRef.current;
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      const newValue = 
        messageContent.substring(0, startPos) + 
        `{{${fieldPath}}}` + 
        messageContent.substring(endPos);
      
      setMessageContent(newValue);
      
      // Set focus back to the textarea
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = startPos + fieldPath.length + 4; // +4 for the {{ and }}
        textarea.selectionEnd = startPos + fieldPath.length + 4;
      }, 0);
    }
  };
  
  // Save configuration
  const saveConfiguration = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to save configuration');
      return;
    }
    
    if (!webhookUrl.trim()) {
      setError('Discord webhook URL is required');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-agent-configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'save-config',
          elementId,
          agentType: 'discord_messenger',
          config: {
            webhookUrl: webhookUrl.trim(),
            username: username.trim(),
            avatarUrl: avatarUrl.trim(),
            messageContent: messageContent.trim()
          }
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
  
  // Send a test message to Discord
  const sendTestMessage = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to send messages');
      return;
    }
    
    if (!webhookUrl.trim()) {
      setError('Discord webhook URL is required');
      return;
    }
    
    if (!messageContent.trim()) {
      setError('Message content is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-discord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          elementId,
          webhookUrl: webhookUrl.trim(),
          username: username.trim(),
          avatarUrl: avatarUrl.trim(),
          content: messageContent.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send Discord message');
      }
      
      setResponse(`Message sent successfully to Discord`);
      
      // Save the configuration after successful test
      await saveConfiguration();
    } catch (err: any) {
      setError(err.message || 'Failed to send Discord message');
    } finally {
      setIsLoading(false);
    }
  };

  const testWorkflow = async () => {
    await runWorkflow(elementId, session, setIsWorkflowRunning);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4 text-black">Discord Messenger Configuration</h2>
      
      {/* Input Structure Display */}
      <InputStructureDisplay elementId={elementId} onInsertField={handleInsertField} />
      
      {/* Configuration Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Discord Webhook URL <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
          />
          <p className="mt-1 text-xs text-gray-500">
            Create a webhook in your Discord server settings and paste the URL here.
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Bot Username (Optional)</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Workflow Bot"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
          />
          <p className="mt-1 text-xs text-gray-500">
            Custom name for the webhook bot. Leave empty to use the webhook's default name.
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Avatar URL (Optional)</label>
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
          />
          <p className="mt-1 text-xs text-gray-500">
            Custom avatar image URL. Leave empty to use the webhook's default avatar.
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Message Content <span className="text-red-500">*</span></label>
          <textarea
            ref={messageContentTextareaRef}
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Enter your message content here. Click on input fields above to insert variables."
            rows={5}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
          />
        </div>
      </div>
      
      {/* Save Configuration Button */}
      <div className="mb-4">
        <button
          onClick={saveConfiguration}
          disabled={isSaving || !webhookUrl.trim()}
          className={`w-full px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 ${
            (isSaving || !webhookUrl.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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
          onClick={sendTestMessage}
          disabled={isLoading || !webhookUrl.trim() || !messageContent.trim()}
          className={`w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 ${
            (isLoading || !webhookUrl.trim() || !messageContent.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </span>
          ) : (
            'Test Agent'
          )}
        </button>
      </div>
      
      {/* Test Workflow Button */}
      <div className="mb-4 mt-2">
        <button
          onClick={testWorkflow}
          disabled={isWorkflowRunning || !webhookUrl.trim() || !messageContent.trim()}
          className={`w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 ${
            (isWorkflowRunning || !webhookUrl.trim() || !messageContent.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {/* Success Message */}
      {response && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {response}
          </div>
        </div>
      )}
    </div>
  );
} 