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
        let bucket: any;
        try {
            const { env } = await getCloudflareContext();
            bucket = (env as { R2?: unknown }).R2 as any;
        } catch (err) {
            console.warn("Could not get Cloudflare context (likely local dev)");
        }

        if (!bucket) {
            // Local Development Fallback using AWS SDK
            console.warn("R2 binding not found, falling back to AWS SDK (Local Dev)");
            const accessKeyId = process.env.R2_ACCESS_KEY_ID;
            const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
            const endpoint = process.env.R2_ENDPOINT;
            const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;

            if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
                return new NextResponse("R2 binding missing and local fallback config incomplete", { status: 500 });
            }

            const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
            const s3 = new S3Client({
                region: "auto",
                endpoint: endpoint,
                credentials: { accessKeyId, secretAccessKey },
            });

            try {
                const response = await s3.send(new GetObjectCommand({
                    Bucket: bucketName,
                    Key: r2Key,
                }));
                
                const headers = new Headers();
                headers.set("Content-Type", response.ContentType || "application/octet-stream");
                if (response.ETag) headers.set("etag", response.ETag);
                headers.set("Cache-Control", "public, max-age=2592000, immutable");

                return new NextResponse(response.Body as any, { headers });
            } catch (error: any) {
                console.error("Local R2 fallback error:", error);
                return new NextResponse("File not found", { status: 404 });
            }
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
