import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://owmeter.dev";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/*/dashboard/", "/*/login"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
