import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://sudhev1881-eng.github.io/daily-builds";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
