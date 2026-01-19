import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spa Staff Portal",
  description: "Attendance Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
