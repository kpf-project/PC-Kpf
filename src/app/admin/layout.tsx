"use client";

import type { ReactNode } from "react";
import SiteNav from "@/components/SiteNav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#eef5ff] via-[#e9f1ff] to-[#f8fbff] print:min-h-0 print:overflow-visible print:bg-white print:p-0">
      <div className="pointer-events-none absolute inset-0 hidden lg:block print:hidden" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(62% 58% at 52% -8%, rgba(96, 165, 250, 0.18), transparent),
              radial-gradient(60% 55% at 90% 90%, rgba(129, 140, 248, 0.16), transparent),
              radial-gradient(48% 55% at -8% 42%, rgba(255, 255, 255, 0.36), transparent)
            `,
          }}
        />
      </div>

      <SiteNav />

      {/* Main content wrapper with padding for fixed header */}
      <div className="relative z-10 px-1.5 pt-28 pb-10 sm:px-4 sm:pt-28 lg:px-10 lg:pt-[120px] print:p-0 print:pt-0">
        <div className="mx-auto w-full max-w-none sm:max-w-[1600px] print:max-w-none">
          {/* Content container with reduced padding for mobile */}
          <main className="relative overflow-x-hidden rounded-2xl bg-white/97 px-2.5 py-4 sm:rounded-3xl sm:border sm:border-white/70 sm:px-6 sm:py-6 lg:p-8 sm:shadow-[0_50px_180px_-120px_rgba(37,99,235,0.65)] backdrop-blur-none lg:backdrop-blur-sm print:overflow-visible print:border-none print:shadow-none print:bg-white print:backdrop-blur-none print:p-0 print:m-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
