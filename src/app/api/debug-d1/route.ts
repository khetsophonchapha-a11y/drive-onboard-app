import { NextResponse } from 'next/server';
import { listApplicationSummaries } from '@/lib/applications';

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");
        const { env } = await getCloudflareContext();
        
        let error = null;
        let summaries = [];
        try {
            summaries = await listApplicationSummaries();
        } catch (e: any) {
            error = e.message || String(e);
        }

        return NextResponse.json({
            status: "success",
            hasEnvDB: !!env?.DB,
            envDBKeys: env?.DB ? Object.keys(env.DB) : [],
            summariesLength: summaries.length,
            summaries,
            error
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e), stack: e.stack }, { status: 500 });
    }
}
