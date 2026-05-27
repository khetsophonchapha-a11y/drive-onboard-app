import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireR2Bucket } from "@/lib/r2/env";



export async function PUT(req: NextRequest) {
    try {
        const bucket = requireR2Bucket();

        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const endpoint = process.env.R2_ENDPOINT;

        // Check Auth
        if (!accessKeyId || !secretAccessKey || !endpoint) {
            return NextResponse.json({ error: "Server R2 Configuration Missing" }, { status: 500 });
        }

        // Initialize S3 Client
        const s3 = new S3Client({
            region: "auto",
            endpoint: endpoint,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });

        // Parse query params
        const url = new URL(req.url);
        const applicationId = url.searchParams.get("applicationId");
        const docType = url.searchParams.get("docType");
        const fileName = url.searchParams.get("fileName");
        const mime = req.headers.get("content-type") || "application/octet-stream";

        // We will skip explicit MD5 check for now to maximize compatibility
        // const md5 = req.headers.get("content-md5") || undefined;

        if (!applicationId || !docType || !fileName) {
            return NextResponse.json({ error: "Missing required query parameters" }, { status: 400 });
        }

        const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const safeFileName = `${Date.now()}_${docType}_${randomSuffix}.${ext}`;
        const key = `applications/${applicationId}/${docType}/${safeFileName}`;

        console.log(`[Proxy Upload SDK] Uploading ${fileName} to ${key}`);

        // Read body to buffer
        const buffer = await req.arrayBuffer();

        if (buffer.byteLength === 0) {
            return NextResponse.json({ error: "No file content" }, { status: 400 });
        }

        // Send to R2 using AWS SDK
        await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: new Uint8Array(buffer), // AWS SDK v3 works well with Uint8Array
            ContentType: mime,
        }));

        console.log(`[Proxy Upload SDK] Success: ${key}`);

        return NextResponse.json({ success: true, key });

    } catch (error: any) {
        console.error("[Proxy Upload SDK Error]", error);
        return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
    }
}
