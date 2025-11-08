import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Chat Frontend",
  description: "Chat app powered by NestJS + Next.js",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
