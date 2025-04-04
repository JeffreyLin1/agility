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
            keyType: 'gmail',
            elementId
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.refreshToken) {
          setIsAuthorized(true);
          setUserEmail(data.email);
        }
      } catch (err) {
        console.error('Error checking Gmail authorization:', err);
      }
    };
    
    checkAuthorization();
  }, [session, elementId]);
  
  // Authorize Gmail
  const authorizeGmail = async () => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-oauth`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.authUrl) {
        // Open the authorization URL in a new window
        window.open(`${data.authUrl}&state=${elementId}`, '_blank');
      } else {
        setError(data.error || 'Failed to start Gmail authorization');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authorize Gmail');
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
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Gmail Reader Configuration</h2>
      
      {!isAuthorized ? (
        <div className="mb-4">
          <p className="mb-2">You need to authorize access to your Gmail account.</p>
          <button 
            onClick={authorizeGmail}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Authorize Gmail
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-green-600 mb-2">
            ✓ Gmail authorized for {userEmail}
          </p>
          <button 
            onClick={authorizeGmail}
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            Change account
          </button>
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Read emails from:
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="sender@example.com"
            className="w-full p-2 border rounded mt-1"
            disabled={!isAuthorized || isLoading}
          />
        </label>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Maximum number of emails:
          <input
            type="number"
            value={maxResults}
            onChange={(e) => setMaxResults(parseInt(e.target.value) || 5)}
            min="1"
            max="50"
            className="w-full p-2 border rounded mt-1"
            disabled={!isAuthorized || isLoading}
          />
        </label>
      </div>
      
      <div className="mb-4">
        <label className="flex items-center text-sm font-medium">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
            className="mr-2"
            disabled={!isAuthorized || isLoading}
          />
          Only show unread emails
        </label>
      </div>
      
      <button
        onClick={readEmails}
        disabled={!isAuthorized || isLoading || !fromEmail.trim()}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Loading...' : 'Read Emails'}
      </button>
      
      {error && (
        <div className="mt-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {messages.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Emails from {fromEmail}</h3>
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="p-3 border rounded">
                <div className="font-medium">{message.subject}</div>
                <div className="text-sm text-gray-500">{new Date(message.date).toLocaleString()}</div>
                <div className="mt-2 text-sm whitespace-pre-line">{message.snippet}...</div>
                <details className="mt-2">
                  <summary className="text-sm text-blue-500 cursor-pointer">View full message</summary>
                  <div className="mt-2 p-2 bg-gray-50 text-sm whitespace-pre-line">
                    {message.body}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-800"
        >
          Close
        </button>
      </div>
    </div>
  );
} 