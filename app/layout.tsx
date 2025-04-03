import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Workflow Builder',
  description: 'Build and manage your workflows',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
