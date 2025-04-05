import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { runWorkflow } from '@/app/lib/workflowRunner';

interface GmailReaderConfigProps {
  elementId: string;
  onClose: () => void;
}

export default function GmailReaderConfig({ elementId, onClose }: GmailReaderConfigProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState('');
  const [maxResults, setMaxResults] = useState(5);
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  
  const { session } = useAuth();
  
  // Check if Gmail is already authorized
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!session?.access_token) return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-gmail-credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get-credentials'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.isAuthorized) {
          setIsAuthorized(true);
          setUserEmail(data.email || 'Your Gmail Account');
        }
      } catch (err) {
        console.log('No Gmail authorization found or error checking authorization');
      }
    };
    
    checkAuthorization();
  }, [session]);

  // Load saved configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!session?.access_token) return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-gmail-credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get-config',
            elementId,
            agentType: 'gmail_reader'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.config) {
          if (data.config.fromEmail) setFromEmail(data.config.fromEmail);
          if (data.config.maxResults) setMaxResults(data.config.maxResults);
          if (data.config.onlyUnread !== undefined) setOnlyUnread(data.config.onlyUnread);
        }
      } catch (err) {
        console.log('No saved configuration found or error loading configuration');
      }
    };
    
    loadConfig();
  }, [session, elementId]);
  
  // Save configuration
  const saveConfiguration = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to save configuration');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-gmail-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'save-config',
          elementId,
          agentType: 'gmail_reader',
          config: {
            fromEmail: fromEmail.trim(),
            maxResults,
            onlyUnread,
            gmail_authorized: isAuthorized
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
  
  // Start the OAuth flow
  const authorizeGmail = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to authorize Gmail');
      return;
    }
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-oauth?action=authorize&state=${elementId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start Gmail authorization');
      }
      
      // Redirect to Google's authorization page
      window.location.href = data.authUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to start Gmail authorization');
    }
  };
  
  // Read emails from Gmail
  const readEmails = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to read emails');
      return;
    }
    
    if (!isAuthorized) {
      setError('You must authorize Gmail first');
      return;
    }
    
    if (!fromEmail.trim()) {
      setError('Sender email address is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setMessages([]);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/read-gmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          elementId,
          fromEmail: fromEmail.trim(),
          maxResults,
          onlyUnread
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to read emails');
      }
      
      setMessages(data.messages || []);
      if (data.messages.length === 0) {
        setError(`No emails found from ${fromEmail}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to read emails');
    } finally {
      setIsLoading(false);
    }
  };

  const testWorkflow = async () => {
    await runWorkflow(elementId, session, setIsWorkflowRunning);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4 text-black">Gmail Reader Configuration</h2>
      
      {/* Authorization Status */}
      <div className={`mb-4 p-4 rounded-md border ${isAuthorized ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center">
              {isAuthorized ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <p className="font-medium text-blue-800">Connected to Gmail</p>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                  <p className="font-medium text-amber-800">Gmail connection required</p>
                </>
              )}
            </div>
            {isAuthorized && userEmail && (
              <p className="text-sm text-blue-700 mt-1 ml-5">
                Using account: <span className="font-medium">{userEmail}</span>
              </p>
            )}
          </div>
          <button
            onClick={authorizeGmail}
            className={`px-3 py-1.5 text-white text-sm font-medium rounded-md ${
              isAuthorized 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isAuthorized ? 'Reconnect Account' : 'Connect Gmail'}
          </button>
        </div>
      </div>
      
      {/* Email Search Form */}
      <div className="space-y-4 mb-6 p-4 border border-gray-200 rounded-md bg-white">
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Search for emails from</label>
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="sender@example.com"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Maximum results</label>
          <input
            type="number"
            value={maxResults}
            onChange={(e) => setMaxResults(parseInt(e.target.value) || 5)}
            min="1"
            max="50"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="onlyUnread"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="onlyUnread" className="ml-2 text-sm font-medium text-black">Only show unread emails</label>
        </div>
        
        {/* Save Configuration Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={saveConfiguration}
            disabled={isSaving || !fromEmail.trim()}
            className={`px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 ${
              (isSaving || !fromEmail.trim()) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
        
        {/* Save Success Message */}
        {isSaved && (
          <div className="mt-2 text-sm text-green-600">
            Configuration saved successfully!
          </div>
        )}
      </div>
      
      {/* Action Button */}
      <div className="mb-4">
        <button
          onClick={readEmails}
          disabled={isLoading || !isAuthorized || !fromEmail.trim()}
          className={`w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 ${
            (isLoading || !isAuthorized || !fromEmail.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </span>
          ) : (
            'Test Agent'
          )}
        </button>
      </div>
      
      <div className="mb-4 mt-2">
        <button
          onClick={testWorkflow}
          disabled={isWorkflowRunning || !isAuthorized || !fromEmail.trim()}
          className={`w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 ${
            (isWorkflowRunning || !isAuthorized || !fromEmail.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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
      
      {/* Email Results */}
      {messages.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-md font-medium mb-3">Emails from {fromEmail}</h3>
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="p-3 border border-gray-200 rounded-md bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="font-medium text-blue-900">{message.subject}</div>
                <div className="text-xs text-gray-600">{new Date(message.date).toLocaleString()}</div>
                <div className="mt-2 text-sm text-gray-800">{message.snippet}...</div>
                <details className="mt-2">
                  <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">View full message</summary>
                  <div className="mt-2 p-3 bg-blue-50 text-sm whitespace-pre-line border border-blue-100 rounded text-gray-800">
                    {message.body}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 