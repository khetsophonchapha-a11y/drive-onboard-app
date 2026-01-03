
/**
 * Pure Web Crypto implementation of AWS V4 Signature for S3/R2 Presigned URLs.
 * Zero dependencies on @aws-sdk or Node.js 'crypto' module.
 * safe for Cloudflare Workers / Edge Runtime.
 */

const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
const ALGORITHM = "AWS4-HMAC-SHA256";

export async function hmac(key: CryptoKey | BufferSource, stringToSign: string): Promise<ArrayBuffer> {
    const cryptoKey = key instanceof ArrayBuffer || ArrayBuffer.isView(key)
        ? await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
        : key;

    return crypto.subtle.sign("HMAC", cryptoKey as CryptoKey, new TextEncoder().encode(stringToSign));
}

export async function sha256(str: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface PresignOptions {
    method?: string;
    bucket: string;
    key: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    region?: string;
    expiresIn?: number;
    contentType?: string; // Important for PUT
    contentMD5?: string;
    customQuery?: Record<string, string>;
}

export async function createPresignedUrl(options: PresignOptions): Promise<string> {
    const {
        method = "PUT",
        bucket,
        key,
        accessKeyId,
        secretAccessKey,
        endpoint,
        region = "auto",
        expiresIn = 600,
        contentType,
        contentMD5,
        customQuery
    } = options;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

    // Parse Host from Endpoint
    const url = new URL(endpoint);
    // R2 Custom Domain or standard R2 bucket-custom-domain
    // Format: https://<account>.r2.cloudflarestorage.com or https://<bucket>.<account>.r2... or custom
    // Next.js/OpenNext often uses strict path style for R2 compatibility
    // URL format: https://<endpoint>/<bucket>/<key>

    // NOTE: AWS SDK 'forcePathStyle: true' puts bucket in path.
    // We will construct the full URL manually.
    const host = url.host;
    // Normalize Key:
    // If key matches empty string or root, path is just /bucket/
    const normalizedKey = key ? (key.startsWith('/') ? key.slice(1) : key) : '';
    const path = `/${bucket}/${normalizedKey}`;

    const canonicalUri = path.split('/').map(c => encodeURIComponent(c)).join('/').replace(/%2F/g, '/');

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

    // Headers to sign
    const headersMap: Record<string, string> = { host };
    if (contentType) headersMap["content-type"] = contentType;
    if (contentMD5) headersMap["content-md5"] = contentMD5;

    const sortedHeaderKeys = Object.keys(headersMap).sort();

    // Canonical Headers (Must be sorted and end with newline)
    const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${headersMap[k]}\n`).join('');

    // Signed Headers (Must be sorted and separated by semicolon)
    const signedHeaders = sortedHeaderKeys.join(';');

    const queryParams = new URLSearchParams();
    queryParams.set("X-Amz-Algorithm", ALGORITHM);
    queryParams.set("X-Amz-Credential", `${accessKeyId}/${credentialScope}`);
    queryParams.set("X-Amz-Date", amzDate);
    queryParams.set("X-Amz-Expires", expiresIn.toString());
    queryParams.set("X-Amz-SignedHeaders", signedHeaders);

    if (customQuery) {
        Object.entries(customQuery).forEach(([k, v]) => {
            queryParams.set(k, v);
        });
    }

    // Sort query params
    const sortedQuery = Array.from(queryParams.entries())
        .sort(([k1], [k2]) => k1.localeCompare(k2))
        .map(([k, v]) => {
            // Encode key and value
            // AWS Signature requires specific encoding (e.g. space to %20 not +)
            // encodeURIComponent handles spaces as %20.
            if (v === '') return encodeURIComponent(k) + '='; // Handle empty value params like ?cors=
            return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        })
        .join('&');

    // Canonical Request
    const canonicalRequest = [
        method,
        canonicalUri,
        sortedQuery,
        canonicalHeaders,
        signedHeaders,
        UNSIGNED_PAYLOAD
    ].join('\n');

    // String to Sign
    const stringToSign = [
        ALGORITHM,
        amzDate,
        credentialScope,
        await sha256(canonicalRequest)
    ].join('\n');

    // Signature Calculation
    const kDate = await hmac(new TextEncoder().encode("AWS4" + secretAccessKey), dateStamp);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, "s3");
    const kSigning = await hmac(kService, "aws4_request");
    const signature = hex(await hmac(kSigning, stringToSign));

    // Final URL
    return `${url.protocol}//${host}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`;
}
