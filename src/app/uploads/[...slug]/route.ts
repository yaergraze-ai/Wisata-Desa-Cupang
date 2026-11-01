import { NextResponse, type NextRequest } from "next/server";
import { getStorageProvider } from "@/server/integrations/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return new NextResponse("File tidak ditemukan", { status: 404 });
  }

  const storageKey = slug.join("/");
  const storage = getStorageProvider();

  try {
    const file = await storage.get(storageKey);
    if (!file) {
      return new NextResponse("File tidak ditemukan", { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat berkas";
    return new NextResponse(message, { status: 500 });
  }
}
