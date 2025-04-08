'use client';

import Link from 'next/link';
import { Header } from './components/Layout';
import { Button } from './components/ui';
import { useAuth } from './context/AuthContext';
import { useState, useEffect } from 'react';
import { FormEvent } from 'react';

export default function Home() {
  const { user, isLoading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Simple fade-in animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero section - only title and button */}
      <main className="flex-1 flex flex-col items-center justify-center bg-white">
        <div className="text-center max-w-4xl px-6"> 
          <h1 
            className={`text-7xl font-bold tracking-tight text-black mb-8 transition-all duration-700 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            Agility
          </h1>
          <div 
            className={`w-32 h-1.5 bg-black mx-auto mb-12 transition-all duration-700 delay-100 transform ${
              isVisible ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
            }`}
          ></div>
          <p 
            className={`text-2xl text-gray-700 mb-12 transition-all duration-700 delay-200 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            Create, visualize, and share AI agent workflows with an intuitive drag-and-drop interface.
          </p>
          <div 
            className={`transition-all duration-700 delay-300 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            <Link href="/workflow">
              <button 
                className="px-12 py-5 bg-black text-white font-medium rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)] active:translate-y-[3px] active:translate-x-[3px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] transition-all text-xl"
                style={{backgroundColor: 'white', color: 'black'}}
              >
                Try the Workflow Builder
              </button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
