import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolvePublicOrigin } from "@/lib/public-url";
import { getWorkerFileUrl } from "@/lib/worker-url";

const Body = z.object({ r2Key: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { r2Key } = Body.parse(await req.json());

    // T-050: Use Worker Proxy instead of S3 Presigned URL
    // This solves encoding issues and allows caching.
    const url = getWorkerFileUrl(r2Key, { origin: resolvePublicOrigin(req) });

    return NextResponse.json({ url });

  } catch (error) {
    console.error("Error signing GET URL:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
