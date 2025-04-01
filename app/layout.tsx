import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
