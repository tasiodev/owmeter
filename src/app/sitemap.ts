import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://owmeter.dev";
const LOCALES = ["en", "es"] as const;

function url(path: string) {
  return `${BASE_URL}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = ["", "/ranking"];

  return LOCALES.flatMap((locale) =>
    publicPaths.map((path) => ({
      url: url(`/${locale}${path}`),
      lastModified: new Date(),
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1.0 : 0.6,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, url(`/${l}${path}`)])),
      },
    }))
  );
}
