import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// export const runtime = 'edge'; // Removed to avoid bundling issues with OpenNext

const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret-token";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await params;
        // Reconstruct the R2 key from the path segments.
        // The path comes in as an array, e.g. ['applications', 'app-123', 'doc.jpg']
        // We need to join them with '/' to get the key.
        // NOTE: request.nextUrl.pathname might be double encoded if we aren't careful,
        // but params.path is usually decoded.
        // Let's rely on joining params.path.

        // HOWEVER, if the key contained encoded characters (like Thai), params.path might be decoded.
        // The signature was generated on the RAW key string.
        // We should try to use the raw KEY as much as possible.

        // Strategy:
        // 1. Reconstruct key from params (decoded).
        const r2Key = path.join("/");

        // 2. Verify Signature
        // The signature in the URL was generated using the *original* key string.
        // If the browser encoded it in the URL, that's fine, but the verification
        // happens against the string that was passed to sign().
        const searchParams = request.nextUrl.searchParams;
        const signature = searchParams.get("signature");

        if (!signature) {
            return new NextResponse("Missing signature", { status: 403 });
        }

        // Verify Signature using Web Crypto API (HMAC-SHA256)
        const encoder = new TextEncoder();
        const keyData = encoder.encode(WORKER_SECRET);
        const data = encoder.encode(r2Key);

        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);

        const computedSignature = Array.from(new Uint8Array(signatureBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        // Timing safe comparison?
        if (computedSignature !== signature) {
            console.error(`Signature mismatch for key: ${r2Key}. Expected ${computedSignature}, got ${signature}`);
            return new NextResponse("Invalid signature", { status: 403 });
        }

        // 3. Fetch from R2
        // Use 'any' to avoid missing R2Bucket type definition if @cloudflare/workers-types isn't global
        const { env } = await getCloudflareContext();
        const bucket = (env as { R2?: unknown }).R2 as any;

        if (!bucket) {
            console.error("R2 binding not found");
            return new NextResponse("R2 binding missing", { status: 500 });
        }

        const object = await bucket.get(r2Key);

        if (!object) {
            return new NextResponse("File not found", { status: 404 });
        }

        // 4. Return Response
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        // Cache for 30 days (2592000 seconds). User requested reduction from 1 year.
        headers.set("Cache-Control", "public, max-age=2592000, immutable");

        return new NextResponse(object.body, {
            headers,
        });

    } catch (err: any) {
        console.error("Error serving file:", err);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
