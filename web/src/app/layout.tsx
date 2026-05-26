import type { Metadata } from "next";
import "./globals.css";
import { AppFooter } from "@/components/app-footer";
import { AppNav } from "@/components/app-nav";
import { ConfirmHost } from "@/components/confirm-dialog";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "WhatsApp AI — Admin",
  description: "Configure the AI prompt, manage knowledge, and chat live.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          {user && <AppNav user={user} />}
          <main className="app-main">{children}</main>
          <AppFooter />
        </div>
        <ConfirmHost />
      </body>
    </html>
  );
}
