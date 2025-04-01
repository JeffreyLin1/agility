import Link from 'next/link';
import { Header } from './components/Layout';
import { Button } from './components/ui';

export default function Home() {
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
            <Link href="/workflow">
              <Button variant="primary" size="lg">
                Create New Workflow
              </Button>
            </Link>
            <Button variant="secondary" size="lg">
              View Examples
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
