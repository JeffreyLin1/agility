'use client';

import Link from 'next/link';
import Image from 'next/image';
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
      <main className="flex-1 flex flex-col items-center bg-white pb-24">
        <div className="text-center max-w-4xl px-6 py-20"> 
          <h1 
            className={`text-7xl font-bold tracking-tight text-gray-900 mb-8 transition-all duration-700 transform ${
              isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
            }`}
          >
            Transform Your Workflow
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
        </div>

        {/* Feature sections */}
        <div className={`w-full max-w-7xl mx-auto px-6 transition-all duration-700 delay-400 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}>
          {/* Feature 1 */}
          <div className="flex flex-col lg:flex-row items-center justify-between py-20 border-t border-gray-200">
            <div className="lg:w-1/2 lg:pr-16 mb-10 lg:mb-0">
              <h2 className="text-4xl font-bold mb-6 text-gray-900">
                <span className="text-gray-900">1.</span> Visual Workflow Design
              </h2>
              <p className="text-xl text-gray-700 mb-6">
                Perfect your automation without complexity. Create beautiful workflows with intuitive tools designed for creators, not technical experts.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-700 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">Simple drag-and-drop tools optimized for workflow design</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-700 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">Works with mouse, trackpad, or touch input</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-700 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">Make targeted edits without starting over</span>
                </li>
              </ul>
            </div>
            <div className="lg:w-1/2 bg-gray-100 rounded-lg shadow-lg overflow-hidden">
              <div className="relative h-[350px] w-[full]">
                <Image
                  src="/images/landing/demo.gif"
                  alt="Visual Workflow Designer Demo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="p-3 bg-gray-200">
                <span className="text-sm text-gray-600 font-medium">Visual Workflow Designer</span>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col-reverse lg:flex-row items-center justify-between py-20 border-t border-gray-200">
            <div className="lg:w-1/2 bg-gray-100 rounded-lg shadow-lg overflow-hidden">
              <div className="relative h-[450px] w-full">
                <Image
                  src="/images/landing/aidemo.gif"
                  alt="AI Agent Integration Demo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="p-3 bg-gray-200">
                <span className="text-sm text-gray-600 font-medium">Made with Agility</span>
              </div>
            </div>
            <div className="lg:w-1/2 lg:pl-16 mb-10 lg:mb-0">
              <h2 className="text-4xl font-bold mb-6 text-gray-900">
                <span className="text-gray-900">2.</span> AI Agent Integration
              </h2>
              <p className="text-xl text-gray-700 mb-6">
                From simple workflows to complex AI agent orchestration in seconds. Our platform understands your intent and creates professional-quality automation without the steep learning curve.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-700 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">Transform text prompts into fully-realized workflows</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-700 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">Accurate interpretation of your automation intent</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-700 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">No complex programming skills required</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col lg:flex-row items-center justify-between py-20 border-t border-gray-200">
            <div className="lg:w-1/2 lg:pr-16 mb-10 lg:mb-0">
              <h2 className="text-4xl font-bold mb-6 text-gray-900">
                <span className="text-gray-900">3.</span> Seamless Deployment
              </h2>
              <p className="text-xl text-gray-700 mb-6">
                Deploy your workflows with one click. Monitor performance, iterate quickly, and scale effortlessly as your needs grow.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-500 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">One-click deployment to production</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-500 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">Real-time monitoring and analytics</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-500 mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="text-gray-700">Easily share and collaborate with your team</span>
                </li>
              </ul>
            </div>
            <div className="lg:w-1/2 bg-gray-100 rounded-lg shadow-lg overflow-hidden">
              <div className="relative h-[350px] w-full">
                <Image
                  src="/images/landing/template.png"
                  alt="Deployment Dashboard Demo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="p-3 bg-gray-200">
                <span className="text-sm text-gray-600 font-medium">Deployment Dashboard</span>
              </div>
            </div>
          </div>

          
        </div>
        <div 
            className={`transition-all duration-700 delay-300 transform${
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
      </main>
    </div>
  );
}
