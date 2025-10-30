// A tiny service to fetch and cache fonts.
// This is a server-side cache.

const fontCache = new Map<string, ArrayBuffer>();

const fontUrls = {
    'Sarabun-Regular': 'https://firebasestorage.googleapis.com/v0/b/flutter-codelabs-app.appspot.com/o/fonts%2FSarabun-Regular.ttf?alt=media&token=e93c12ba-a72e-4903-b82b-5e26b1464303',
    'Sarabun-Bold': 'https://firebasestorage.googleapis.com/v0/b/flutter-codelabs-app.appspot.com/o/fonts%2FSarabun-Bold.ttf?alt=media&token=3b567d33-f542-4f32-8419-6f91d01ba29f',
};

type FontName = keyof typeof fontUrls;

export async function getFont(name: FontName): Promise<ArrayBuffer> {
    if (fontCache.has(name)) {
        return fontCache.get(name)!;
    }

    const response = await fetch(fontUrls[name]);
    if (!response.ok) {
        throw new Error(`Failed to fetch font ${name}: ${response.statusText}`);
    }

    const fontBuffer = await response.arrayBuffer();
    fontCache.set(name, fontBuffer);
    return fontBuffer;
}

export async function warmUpFonts(): Promise<void> {
    try {
        await Promise.all([
            getFont('Sarabun-Regular'),
            getFont('Sarabun-Bold')
        ]);
    } catch (error) {
        console.error("Font warming failed:", error);
        // We don't re-throw here. We'll let the PDF generation fail if fonts are truly unavailable.
    }
}
