import type { Metadata } from "next";
import Image from "next/image";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "SurfCast",
  description:
    "Tides, surf and sun for your beach — scrollable wave-line tide charts, hourly surf, ocean temp & UV.",
};

export default function Page() {
  return (
    <main
      className="mx-auto w-full max-w-[560px] flex-1 px-5 pb-16"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)",
        paddingLeft: "calc(env(safe-area-inset-left) + 1.25rem)",
        paddingRight: "calc(env(safe-area-inset-right) + 1.25rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 4rem)",
      }}
    >
      <Dashboard />

      {/* Credit — the colored wordmark on sunrise, the white one on deeptide. */}
      <footer className="mt-10 flex justify-center">
        <a
          href="https://coastn.co"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Built by Coast'n"
          className="group inline-flex items-center gap-2 text-muted transition-colors hover:text-text"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
            Built by
          </span>
          <Image
            src="/coastn-logo.png"
            alt=""
            width={70}
            height={29}
            className="h-[29px] w-auto opacity-60 transition-opacity group-hover:opacity-100 dark:hidden"
          />
          <Image
            src="/coastn-logo-white.png"
            alt=""
            width={70}
            height={29}
            className="hidden h-[29px] w-auto opacity-60 transition-opacity group-hover:opacity-100 dark:block"
          />
        </a>
      </footer>
    </main>
  );
}
