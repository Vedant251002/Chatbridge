"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Setup" },
  { href: "/conversations", label: "Live chat" },
  { href: "/knowledge", label: "Knowledge" },
];

export function AppNav() {
  const pathname = usePathname();
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
    </header>
  );
}
