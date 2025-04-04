'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

function CallbackHandler() {
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const router = useRouter();
  const { session } = useAuth();
  const [status, setStatus] = useState('Processing...');
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [isWaitingForSession, setIsWaitingForSession] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    url: '',
    searchParams: {},
    sessionStatus: 'unknown'
  });

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setStatus('Authorization failed');
        setError(errorParam);
        return;
      }

      if (!code) {
        setStatus('Authorization failed');
        setError('No authorization code received');
        return;
      }

      // Check if session is available
      if (!session?.access_token) {
        setIsWaitingForSession(true);
        setStatus('Waiting for authentication...');
        return;
      }

      setIsWaitingForSession(false);
      
      try {
        console.log("Exchanging code for tokens via POST...");
        
        // Call the edge function to handle the callback
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-oauth`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              action: 'callback',
              code: code,
              state: state || ''
            })
          }
        );

        // Log the request details for debugging
        console.log("Request sent with:", {
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-oauth`,
          method: 'POST',
          action: 'callback',
          codeLength: code?.length,
          statePresent: !!state
        });

        const data = await response.json();
        console.log("Response:", data);

        if (!response.ok) {
          setDetails(data.details || null);
          throw new Error(data.error || 'Failed to complete Gmail authorization');
        }

        // Check if the authorization was already processed
        if (data.alreadyProcessed) {
          setStatus('Authorization already completed!');
        } else {
          setStatus('Authorization successful!');
        }
        
        // Redirect back to the workflow page after a short delay
        setTimeout(() => {
          router.push('/workflow');
        }, 3000);
      } catch (err: any) {
        console.error("Error:", err);
        setStatus('Authorization failed');
        setError(err.message || 'Failed to complete Gmail authorization');
      }
    };

    handleCallback();
  }, [searchParams, session, router]);

  // If we're waiting for session, check again when session changes
  useEffect(() => {
    if (isWaitingForSession && session?.access_token) {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      
      if (code) {
        // Re-trigger the callback handling
        const handleSessionAvailable = async () => {
          setIsWaitingForSession(false);
          setStatus('Processing...');
          
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-oauth`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  action: 'callback',
                  code: code,
                  state: state || ''
                })
              }
            );

            const data = await response.json();

            if (!response.ok) {
              setDetails(data.details || null);
              throw new Error(data.error || 'Failed to complete Gmail authorization');
            }

            // Check if the authorization was already processed
            if (data.alreadyProcessed) {
              setStatus('Authorization already completed!');
            } else {
              setStatus('Authorization successful!');
            }
            
            setTimeout(() => {
              router.push('/workflow');
            }, 3000);
          } catch (err: any) {
            setStatus('Authorization failed');
            setError(err.message || 'Failed to complete Gmail authorization');
          }
        };
        
        handleSessionAvailable();
      }
    }
  }, [session, isWaitingForSession, searchParams, router]);

  useEffect(() => {
    // Capture debug information
    if (typeof window !== 'undefined') {
      setDebugInfo({
        url: window.location.href,
        searchParams: Object.fromEntries(new URLSearchParams(window.location.search).entries()),
        sessionStatus: session ? 'authenticated' : 'not authenticated'
      });
    }
  }, [session]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-4">Gmail Authorization</h1>
        
        <div className="text-center mb-4">
          <p className="text-lg font-medium">{status}</p>
          {error && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
              {details && (
                <pre className="mt-2 text-xs overflow-auto max-h-40 bg-gray-100 p-2 rounded">
                  {JSON.stringify(details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
        
        {!error && status !== 'Authorization successful!' && (
          <div className="flex justify-center">
            <svg className="animate-spin h-8 w-8 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        
        <div className="mt-4 text-center">
          <button
            onClick={() => router.push('/workflow')}
            className="px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800"
          >
            Return to Workflow
          </button>
        </div>
        
        {/* Debug information */}
        <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600">
          <p>Code: {searchParams.get('code') ? '✓ Present' : '✗ Missing'}</p>
          <p>State: {searchParams.get('state') ? '✓ Present' : '✗ Missing'}</p>
          <p>Session: {session?.access_token ? '✓ Authenticated' : '✗ Not authenticated'}</p>
          <p>User: {session?.user?.email || 'Not available'}</p>
        </div>

        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h3 className="text-sm font-medium mb-2">Debug Information:</h3>
          <pre className="text-xs overflow-auto max-h-40">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function GmailOAuthCallback() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CallbackHandler />
    </Suspense>
  );
} 