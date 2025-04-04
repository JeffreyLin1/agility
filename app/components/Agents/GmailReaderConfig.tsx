import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';

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
  
  const { session } = useAuth();
  
  // Check if Gmail is already authorized
  useEffect(() => {
    const checkAuthorization = async () => {
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
            elementId,
            keyType: 'gmail'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.refreshToken) {
          setIsAuthorized(true);
          setUserEmail(data.email || 'Your Gmail Account');
        }
      } catch (err) {
        console.log('No Gmail authorization found or error checking authorization');
      }
    };
    
    checkAuthorization();
  }, [session, elementId]);
  
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
  
  // Read emails from a specific sender
  const readEmails = async () => {
    if (!isAuthorized) {
      setError('You must authorize Gmail before reading emails');
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
      // Call your Edge Function to read emails
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/read-gmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          elementId,
          fromEmail,
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
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Gmail Reader Configuration</h2>
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          This agent allows you to read emails from your Gmail account. You'll need to authorize access to your Gmail account.
        </p>
        
        {isAuthorized ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md mb-4">
            <p className="text-green-700 font-medium">
              ✓ Gmail authorized
            </p>
            {userEmail && (
              <p className="text-sm text-green-600 mt-1">
                Connected account: {userEmail}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <button
              onClick={authorizeGmail}
              className="w-full px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800"
            >
              Authorize Gmail
            </button>
          </div>
        )}
      </div>
      
      {/* Email Reader Settings */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-md font-medium mb-3">Email Reader Settings</h3>
        
        {/* From Email Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Read emails from (sender email)
          </label>
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="sender@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
            disabled={!isAuthorized || isLoading}
          />
        </div>
        
        {/* Max Results Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Maximum number of emails
          </label>
          <input
            type="number"
            value={maxResults}
            onChange={(e) => setMaxResults(parseInt(e.target.value) || 5)}
            min="1"
            max="50"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
            disabled={!isAuthorized || isLoading}
          />
        </div>
        
        {/* Only Unread Checkbox */}
        <div className="mb-4">
          <label className="flex items-center text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(e) => setOnlyUnread(e.target.checked)}
              className="mr-2 h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
              disabled={!isAuthorized || isLoading}
            />
            Only show unread emails
          </label>
        </div>
      </div>
      
      {/* Read Emails Button */}
      <div className="mb-4">
        <button
          onClick={readEmails}
          disabled={isLoading || !isAuthorized || !fromEmail.trim()}
          className={`w-full px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 ${
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
            'Read Emails'
          )}
        </button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {/* Email Results */}
      {messages.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-md font-medium mb-3">Emails from {fromEmail}</h3>
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="p-3 border border-gray-200 rounded-md">
                <div className="font-medium">{message.subject}</div>
                <div className="text-xs text-gray-500">{new Date(message.date).toLocaleString()}</div>
                <div className="mt-2 text-sm">{message.snippet}...</div>
                <details className="mt-2">
                  <summary className="text-xs text-blue-600 cursor-pointer">View full message</summary>
                  <div className="mt-2 p-2 bg-gray-50 text-sm whitespace-pre-line border border-gray-100 rounded">
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