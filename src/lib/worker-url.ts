import { createHmac } from "crypto";

const WORKER_URL = process.env.WORKER_URL;
const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret-token"; // Must match wrangler.toml [vars] Secret

type WorkerFileUrlOptions = {
    origin?: string;
};

/**
 * Generates a signed URL for accessing a file via the Worker Proxy.
 * @param r2Key The R2 object key (can contain Thai characters)
 */
export function getWorkerFileUrl(r2Key: string, options: WorkerFileUrlOptions = {}): string {
    // 1. Construct the path
    // Since Worker expects /files/<key>, and R2 keys can have slashes,
    // we need to be careful.
    // We should encode each segment? Or just encode the whole thing?
    // Worker does `url.pathname.slice`, so it sees encoded path.
    // Browser will encode the URL path.
    // We want the resulting URL path to be `/files/` + encodedKey.

    // Example: r2Key = "daily-reports/foo/ก.jpg"
    // Path = "/files/daily-reports/foo/ก.jpg" (Browser encodes to %E0...)
    // Worker sees pathname "/files/daily-reports/foo/%E0..."
    // HMAC should sign the *pathname* the worker sees.

    // Robust approach: Ensure we construct a valid URL object and sign looking at its pathname.
    const path = `/files/${encodeURI(r2Key)}`; // Use encodeURI to keep slashes but encode Thai

    // 2. Generate Signature
    // Worker verifies: verifyHmac(decodedKey, signature, secret)
    // decodedKey is the raw R2 key (e.g. "applications/app-123/ก.png")
    // We MUST sign the raw r2Key, not the encoded pathname.
    const signature = createHmac("sha256", WORKER_SECRET)
        .update(r2Key)
        .digest("hex");

    const baseUrl = options.origin || WORKER_URL;
    if (!baseUrl) {
        return `${path}?signature=${signature}`;
    }

    const fullUrl = new URL(path, baseUrl);
    fullUrl.searchParams.set("signature", signature);

    return fullUrl.toString();
}
