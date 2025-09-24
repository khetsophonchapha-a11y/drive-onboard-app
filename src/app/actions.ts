'use server'

export async function getImageAsDataUri(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        const dataUri = `data:${blob.type};base64,${buffer.toString('base64')}`;
        return dataUri;
    } catch (error) {
        console.error("Error converting image to data URI:", error);
        // In a real app, you might want to return a placeholder or handle this more gracefully
        return '';
    }
}
