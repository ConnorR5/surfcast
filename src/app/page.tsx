import type { Metadata } from "next";
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
    </main>
  );
}
