"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Setup" },
  { href: "/conversations", label: "Live chat" },
  { href: "/knowledge", label: "Knowledge" },
];

interface AppNavUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export function AppNav({ user }: { user: AppNavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

  return (
    <header className="app-nav" role="banner">
      <h1>WhatsApp AI</h1>
      <nav role="navigation" aria-label="Primary">
        {links.map((l) => {
          const isActive =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="nav-spacer" />
      <div className="user-menu">
        <button
          type="button"
          className="user-chip"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="user-avatar" />
          ) : (
            <span className="user-avatar fallback">{initial}</span>
          )}
          <span className="user-name">{user.name || user.email}</span>
        </button>
        {menuOpen && (
          <div className="user-popover" role="menu">
            <div className="user-popover-head">
              <div className="user-popover-name">{user.name || "Signed in"}</div>
              <div className="user-popover-email">{user.email}</div>
            </div>
            <button
              type="button"
              role="menuitem"
              className="ghost user-popover-action"
              onClick={signOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
