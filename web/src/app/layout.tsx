import type { Metadata } from "next";
import "./globals.css";
import { AppFooter } from "@/components/app-footer";
import { AppNav } from "@/components/app-nav";

export const metadata: Metadata = {
  title: "WhatsApp AI — Admin",
  description: "Configure the AI prompt, manage knowledge, and chat live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <AppNav />
          <main className="app-main">{children}</main>
          <AppFooter />
        </div>
      </body>
    </html>
  );
}
