import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spa Staff Portal",
  description: "Attendance Management",
};

import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning className="h-full">
      <body className="antialiased h-full">
        {children}
        <Toaster richColors position="top-right" />
        <footer className="fixed bottom-0 right-0 p-1 bg-black/80 text-white text-[10px] z-[100] pointer-events-none opacity-50">
          Build: {new Date().toISOString().split('T')[1].split('.')[0]} (Ver 0.1.5-CHECK)
        </footer>
      </body>
    </html>
  );
}
