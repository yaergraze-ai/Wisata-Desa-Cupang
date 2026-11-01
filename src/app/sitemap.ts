import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();

  const pages = [
    {
      pathId: "",
      pathEn: "/en",
      priority: 1.0,
      changeFrequency: "daily" as const,
    },
    {
      pathId: "/jalur",
      pathEn: "/en/jalur",
      priority: 0.9,
      changeFrequency: "weekly" as const,
    },
    {
      pathId: "/syarat-ketentuan",
      pathEn: "/en/syarat-ketentuan",
      priority: 0.5,
      changeFrequency: "monthly" as const,
    },
    {
      pathId: "/kebijakan-privasi",
      pathEn: "/en/kebijakan-privasi",
      priority: 0.5,
      changeFrequency: "monthly" as const,
    },
    {
      pathId: "/masuk",
      pathEn: "/en/masuk",
      priority: 0.6,
      changeFrequency: "monthly" as const,
    },
    {
      pathId: "/daftar",
      pathEn: "/en/daftar",
      priority: 0.6,
      changeFrequency: "monthly" as const,
    },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    // Indonesian entry (default)
    entries.push({
      url: `${baseUrl}${page.pathId || "/"}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          id: `${baseUrl}${page.pathId || "/"}`,
          en: `${baseUrl}${page.pathEn}`,
          "x-default": `${baseUrl}${page.pathId || "/"}`,
        },
      },
    });

    // English entry
    entries.push({
      url: `${baseUrl}${page.pathEn}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          id: `${baseUrl}${page.pathId || "/"}`,
          en: `${baseUrl}${page.pathEn}`,
          "x-default": `${baseUrl}${page.pathId || "/"}`,
        },
      },
    });
  }

  return entries;
}
