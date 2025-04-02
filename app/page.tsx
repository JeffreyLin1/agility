'use client';

import Link from 'next/link';
import { Header } from './components/Layout';
import { Button } from './components/ui';
import { useAuth } from './context/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

export default function Home() {
  const { user, isLoading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  useEffect(() => {
    // Simple fade-in animation
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const handleWaitlistSignup = async (e) => {
    e.preventDefault();
    
    if (!email || isSubmitting) return;
    
    setIsSubmitting(true);
    setSubmitStatus(null);
    
    try {
      // Insert email into waitlist table
      const { error } = await supabase
        .from('waitlist')
        .insert([{ email }]);
      
      if (error) throw error;
      
      setSubmitStatus({ type: 'success', message: 'You\'ve been added to the waitlist!' });
      setEmail('');
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      setSubmitStatus({ 
        type: 'error', 
        message: error.code === '23505' 
          ? 'This email is already on our waitlist.' 
          : 'Something went wrong. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6 flex flex-col items-center justify-center bg-white">
        {/* Main content */}
        <div className="max-w-3xl text-center">
          <h1 
            className={`text-5xl font-bold tracking-tight text-black mb-6 transition-all duration-700 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            Agility
          </h1>
          <div 
            className={`w-24 h-1 bg-black mx-auto mb-6 transition-all duration-700 delay-100 transform ${
              isVisible ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
            }`}
          ></div>
          <p 
            className={`text-xl text-gray-700 mb-8 transition-all duration-700 delay-200 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            Create, visualize, and share AI agent workflows with an intuitive drag-and-drop interface.
          </p>
          <div 
            className={`flex flex-col items-center justify-center transition-all duration-700 delay-300 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            <form onSubmit={handleWaitlistSignup} className="w-full max-w-md mb-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Joining...' : 'Join the Waitlist'}
                </Button>
              </div>
            </form>
            
            {submitStatus && (
              <div 
                className={`text-sm font-medium p-3 rounded-md w-full max-w-md ${
                  submitStatus.type === 'success' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {submitStatus.message}
              </div>
            )}
            
            <p className="text-sm text-gray-500 mt-2">
              Be the first to know when we launch. No spam, ever.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
