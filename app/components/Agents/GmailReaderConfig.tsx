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
            keyType: 'gmail'
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
    } catch (err: any) {
      setError(err.message || 'Failed to read emails');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Gmail Reader Configuration</h2>
      
      {/* Authorization Status */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Status: {isAuthorized ? 'Authorized' : 'Not Authorized'}</p>
            {isAuthorized && userEmail && <p className="text-sm text-gray-600">Account: {userEmail}</p>}
          </div>
          <button
            onClick={authorizeGmail}
            className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            {isAuthorized ? 'Reauthorize' : 'Authorize Gmail'}
          </button>
        </div>
      </div>
      
      {/* Configuration Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Sender Email Address</label>
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="example@gmail.com"
            className="w-full p-2 border border-gray-300 rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">Only show emails from this address</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Maximum Results</label>
          <input
            type="number"
            value={maxResults}
            onChange={(e) => setMaxResults(parseInt(e.target.value) || 5)}
            min="1"
            max="50"
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="onlyUnread"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="onlyUnread" className="text-sm font-medium">Only show unread emails</label>
        </div>
      </div>
      
      {/* Action Button */}
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