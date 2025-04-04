'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

export default function GmailOAuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const [status, setStatus] = useState('Processing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state'); // This should be the elementId
      const error = searchParams.get('error');

      if (error) {
        setStatus('Authorization failed');
        setError(error);
        return;
      }

      if (!code) {
        setStatus('Authorization failed');
        setError('No authorization code received');
        return;
      }

      if (!session?.access_token) {
        setStatus('Authorization failed');
        setError('You must be logged in to complete the authorization');
        return;
      }

      try {
        // Call the edge function to handle the callback
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-oauth?action=callback&code=${code}&state=${state}`,
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
          throw new Error(data.error || 'Failed to complete Gmail authorization');
        }

        setStatus('Authorization successful!');
        
        // Redirect back to the workflow page after a short delay
        setTimeout(() => {
          router.push('/workflow');
        }, 2000);
      } catch (err: any) {
        setStatus('Authorization failed');
        setError(err.message || 'Failed to complete Gmail authorization');
      }
    };

    handleCallback();
  }, [searchParams, session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-4">Gmail Authorization</h1>
        
        <div className="text-center mb-4">
          <p className="text-lg font-medium">{status}</p>
          {error && (
            <p className="mt-2 text-red-600">{error}</p>
          )}
        </div>
        
        {!error && (
          <div className="flex justify-center">
            <svg className="animate-spin h-8 w-8 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        
        {error && (
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/workflow')}
              className="px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800"
            >
              Return to Workflow
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 