import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLockup } from "./brand";

export function AuthLayout({
  illustration,
  heading,
  bullets,
  footnote,
  children,
}: {
  illustration: ReactNode;
  heading: string;
  bullets?: string[];
  footnote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-landing p-3 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-3xl lg:grid-cols-[1fr_1.1fr] sm:min-h-[calc(100vh-3rem)]">
        <div className="relative flex flex-col justify-between gap-8 p-6 text-sidebar-foreground sm:p-10">
          <Link to="/">
            <BrandLockup />
          </Link>
          <div className="hidden justify-center lg:flex">{illustration}</div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{heading}</h2>
            {bullets && (
              <ul className="mt-4 space-y-2.5">
                {bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sidebar-foreground/90">
                    <CheckCircle2 className="h-5 w-5 text-brand-sky" aria-hidden /> {b}
                  </li>
                ))}
              </ul>
            )}
            {footnote}
          </div>
        </div>
        <div className="flex items-center justify-center bg-card p-6 sm:p-12 lg:rounded-3xl">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F] transition hover:bg-[#F8F8F8] disabled:opacity-60"
    >
      <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
      Continue with Google
    </button>
  );
}
