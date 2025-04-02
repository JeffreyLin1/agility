import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from './context/AuthContext';

export const metadata: Metadata = {
  title: "Agility | AI Workflow Platform",
  description: "Create and visualize AI agent workflows with Agility",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
