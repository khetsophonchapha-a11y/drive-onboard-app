
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

export async function POST(req: NextRequest) {
  try {
    const { applicationId, docType, fileName, mime, size, md5 } = Body.parse(await req.json());
    await assertApplicantOwner(applicationId, req); // ตรวจว่าเป็นเจ้าของจริง
    
    const ACCEPT = ["image/jpeg","image/png","application/pdf"]; 
    if (!ACCEPT.includes(mime) || size > 15*1024*1024) {
      return NextResponse.json({error:"invalid file type or size"},{status:400});
    }

    const key = `applications/${applicationId}/${docType}/${Date.now()}-${fileName}`;
    
    const cmd = new PutObjectCommand({ 
        Bucket: process.env.R2_BUCKET!, 
        Key: key, 
        ContentType: mime,
        ...(md5 ? { ContentMD5: md5 } : {}) 
    });

    const url = await getSignedUrl(r2, cmd, { expiresIn: Number(process.env.R2_PRESIGN_PUT_TTL||600) });
    
    return NextResponse.json({ url, key });

  } catch (error) {
    console.error("Error signing PUT URL for applicant:", error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid request body", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
