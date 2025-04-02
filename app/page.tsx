'use client';

import Link from 'next/link';
import { Header } from './components/Layout';
import { Button } from './components/ui';
import { useAuth } from './context/AuthContext';

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6 flex flex-col items-center justify-center bg-white">
        <div className="max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight text-black mb-6">
            Agility
          </h1>
          <div className="w-24 h-1 bg-black mx-auto mb-6"></div>
          <p className="text-xl text-gray-700 mb-8">
            Create, visualize, and share AI agent workflows with an intuitive drag-and-drop interface.
          </p>
          <div className="flex justify-center space-x-4">
            {!isLoading && (
              user ? (
                <Link href="/workflow">
                  <Button variant="primary" size="lg">
                    Go to Workflow Editor
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/signin">
                    <Button variant="primary" size="lg">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button variant="secondary" size="lg">
                      Create Account
                    </Button>
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
