'use client';

import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useEffect, useState } from 'react';

export default function Header() {
  const { user, signOut, isLoading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50); // Slightly faster than page content
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <header className={`bg-white border-b-2 border-black py-4 px-6 sticky top-0 z-10 transition-all duration-500 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <h1 className="text-xl font-bold tracking-tight text-black">Agility</h1>
          </Link>
        </div>
        <div className="flex items-center space-x-3">
          {!isLoading && (
            <>
              {user ? (
                <>
                  <Link href="/workflow">
                    <button className="p-2 border-2 border-black rounded-md hover:bg-gray-50 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                      </svg>
                    </button>
                  </Link>
                  <button 
                    className="p-2 border-2 border-black rounded-md hover:bg-gray-50 transition-colors"
                    onClick={signOut}
                    title="Sign Out"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                  </button>
                </>
              ) : (
                <Link href="/auth/signin">
                  <button className="px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 transition-colors">
                    Sign In
                  </button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
} 