import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SurfCast — tides, surf & sun",
    short_name: "SurfCast",
    description:
      "Scrollable wave-line tide charts, hourly surf, ocean temp & UV for your beach.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4ead4",
    theme_color: "#df6a4b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
