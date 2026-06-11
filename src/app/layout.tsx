import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LS_THEME, DAY_START_HOUR, DAY_END_HOUR } from "@/lib/config";

// Fraunces — a warm, soft, slightly-wonky old-style serif for the vintage
// surf-brand feel (wordmark, big numbers, headings).
const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

// DM Sans — friendly, clean, rounded grotesque for the data + UI.
const sans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SurfCast — tides, surf & sun",
  description:
    "A warm, sun-faded tide, surf and marine-weather tracker for your beach. Scrollable wave-line tide charts, hourly surf, ocean temp & UV — with good-surf-day text alerts.",
  applicationName: "SurfCast",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SurfCast",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6ddbc" },
    { media: "(prefers-color-scheme: dark)", color: "#182320" },
  ],
};

// Set the theme class before first paint to avoid a flash of the wrong palette.
const themeBootstrap = `(function(){try{
  var k='${LS_THEME}';var pref=localStorage.getItem(k)||'auto';var resolved=pref;
  if(pref==='auto'){var h=new Date().getHours();resolved=(h>=${DAY_START_HOUR}&&h<${DAY_END_HOUR})?'sunrise':'deeptide';}
  if(resolved==='deeptide'){document.documentElement.classList.add('dark');}
  document.documentElement.setAttribute('data-theme',resolved);
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
