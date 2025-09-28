
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod"; 
import { r2 } from "../_client"; 
import { assertApplicantOwner } from "../_auth";

const Body = z.object({ 
    applicationId: z.string(), 
    docType: z.string(), 
    fileName: z.string(), 
    mime: z.string(), 
    size: z.number(), 
    md5: z.string().optional(), 
    turnstileToken: z.string().optional() 
});

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    if (!process.env.R2_BUCKET) {
      throw new Error("R2_BUCKET environment variable is not set");
    }

    const { applicationId, docType, fileName, mime, size, md5 } = Body.parse(await req.json());
    await assertApplicantOwner(applicationId, req); // ตรวจว่าเป็นเจ้าของจริง
    
    const ACCEPTED_MIMES = ["image/jpeg","image/png","application/pdf"]; 
    if (!ACCEPTED_MIMES.includes(mime)) {
      return NextResponse.json({error:"Invalid file type. Accepted: JPG, PNG, PDF."},{status:400});
    }

    if (mime.startsWith('image/') && size > MAX_IMAGE_SIZE) {
        return NextResponse.json({error:`Image size cannot exceed ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`},{status:400});
    }

    if (mime === 'application/pdf' && size > MAX_PDF_SIZE) {
        return NextResponse.json({error:`PDF size cannot exceed ${MAX_PDF_SIZE / 1024 / 1024}MB.`},{status:400});
    }


    const key = `applications/${applicationId}/${docType}/${Date.now()}-${fileName}`;
    
    const cmd = new PutObjectCommand({ 
        Bucket: process.env.R2_BUCKET, 
        Key: key, 
        ContentType: mime,
        ...(md5 ? { ContentMD5: md5 } : {}) 
    });

    const url = await getSignedUrl(r2, cmd, { expiresIn: Number(process.env.R2_PRESIGN_PUT_TTL||600) });
    
    return NextResponse.json({ url, key });

  } catch (error: any) {
    console.error("[R2 Sign PUT Error]", error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: error.issues }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    // Make sure to return a JSON response with an 'error' key
    return NextResponse.json({ error: `Could not create upload URL. Reason: ${errorMessage}` }, { status: 500 });
  }
}

    
