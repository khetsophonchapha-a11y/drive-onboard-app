import { Jimp } from "jimp";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getDb } from "../src/lib/db";
import { applications } from "../src/db/schema";
import dotenv from "dotenv";

dotenv.config({ path: '.env' });
process.env.USE_REMOTE_D1 = "true";

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});
const bucketName = process.env.R2_BUCKET_NAME || "drive-onboard-local";

async function processAndUploadSignature(r2Key: string) {
    try {
        console.log(`Processing: ${r2Key}`);
        const response = await s3Client.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: r2Key,
        }));
        
        if (!response.Body) {
            console.log(`No body for ${r2Key}`);
            return false;
        }

        const stream = response.Body as any;
        const chunks: any[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const mimeType = response.ContentType || "image/png";

        const image = await Jimp.read(buffer);
        image.autocrop();
        const newBuffer = await image.getBuffer(mimeType as any);

        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: r2Key,
            Body: newBuffer,
            ContentType: mimeType,
        }));
        
        console.log(`Successfully cropped and uploaded ${r2Key}`);
        return true;
    } catch (e: any) {
        console.error(`Failed to process ${r2Key}:`, e.message);
        return false;
    }
}

async function main() {
    console.log("Fetching applications from Remote D1 via Proxy...");
    const db = await getDb();
    const rows = await db.select().from(applications).all();
    
    console.log(`Found ${rows.length} applications.`);
    for (const row of rows) {
        if (!row.rawData) continue;
        let manifest: any;
        try {
            manifest = JSON.parse(row.rawData);
        } catch (e) {
            continue;
        }

        const applicantSigKey = manifest?.docs?.signature?.r2Key;
        const guarantorSigKey = manifest?.docs?.guarantorSignature?.r2Key;

        if (applicantSigKey) {
            await processAndUploadSignature(applicantSigKey);
        }

        if (guarantorSigKey) {
            await processAndUploadSignature(guarantorSigKey);
        }
    }
    console.log("Done.");
}

main();
