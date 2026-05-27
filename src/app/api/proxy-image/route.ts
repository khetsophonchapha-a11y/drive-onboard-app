import { NextRequest, NextResponse } from "next/server";

 // Use Node.js runtime for stream handling if needed

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch image: ${response.statusText}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error: any) {
        console.error("Proxy error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
