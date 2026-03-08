import type { MetadataRoute } from "next";
import iconLight from "@/app/icon-light.png";
import { config } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: config.appName,
    short_name: config.appName,
    description: config.appDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#fff",
    theme_color: "#fff",
    icons: [
      {
        src: iconLight.src,
        sizes: "500x500",
        type: "image/png",
      },
    ],
  };
}
