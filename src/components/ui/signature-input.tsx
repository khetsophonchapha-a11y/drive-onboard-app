"use client"

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react"
import SignatureCanvas from "react-signature-canvas"
import { Button } from "@/components/ui/button"
import { Eraser } from "lucide-react"
import { cn } from "@/lib/utils"

interface SignatureInputProps {
    value?: string
    onChange?: (value: string | undefined) => void
    disabled?: boolean
    className?: string
}

export const SignatureInput = forwardRef<HTMLDivElement, SignatureInputProps>(
    ({ value, onChange, disabled, className }, ref) => {
        const sigPadRef = useRef<SignatureCanvas>(null)
        // We use state to force re-render if needed, but mostly ref is enough.
        // value prop is used to load initial signature if editing, but for this use case mostly specific

        // Resize logic to make it responsive
        const [containerWidth, setContainerWidth] = useState<number>(0);
        const containerRef = useRef<HTMLDivElement>(null);

        useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

        useEffect(() => {
            const resizeCanvas = () => {
                if (containerRef.current && sigPadRef.current) {
                    const canvas = sigPadRef.current.getCanvas();
                    const container = containerRef.current;
                    const width = container.offsetWidth;

                    // We only update if significantly changed to avoid flicker
                    if (Math.abs(width - canvas.width) > 10) {
                        // Store current stroke data
                        const data = sigPadRef.current.toData();

                        // Resize clears the canvas
                        canvas.width = width;
                        canvas.height = 200; // Fixed height

                        if (data && data.length > 0) {
                            // Restore stroke data if it exists
                            sigPadRef.current.fromData(data);
                        } else if (value) {
                            // If no strokes (e.g. loaded from image), try to restore from value (DataURL)
                            // This might be redundant with the other useEffect but ensures it persists on resize
                            // Note: fromDataURL is async-ish in nature if loading from URL, but here value is usually dataURL
                            sigPadRef.current.fromDataURL(value);
                        }
                    }
                }
            }

            // Initial size
            resizeCanvas();

            window.addEventListener('resize', resizeCanvas);
            return () => window.removeEventListener('resize', resizeCanvas);
        }, [value]); // Added value dependency so we can re-apply it if needed during resize logic check


        const handleEnd = () => {
            if (sigPadRef.current && onChange) {
                if (sigPadRef.current.isEmpty()) {
                    onChange(undefined);
                } else {
                    // Returns data:image/png;base64,...
                    const dataURL = sigPadRef.current.toDataURL("image/png");
                    onChange(dataURL);
                }
            }
        }

        const handleClear = () => {
            if (sigPadRef.current) {
                sigPadRef.current.clear();
                if (onChange) onChange(undefined);
            }
        }

        // Helper to load value if present initially (e.g. from draft)
        useEffect(() => {
            const loadSignature = async () => {
                if (!value || !sigPadRef.current || !sigPadRef.current.isEmpty()) return;

                if (value.startsWith('http')) {
                    try {
                        // FIX: Fetch image first to handle CORS and avoid "Tainted Canvas" error when saving.
                        // This converts the external URL to a local Base64 data string.
                        const res = await fetch(value, { mode: 'cors' });
                        const blob = await res.blob();
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const base64 = reader.result as string;
                            sigPadRef.current?.fromDataURL(base64);
                        };
                        reader.readAsDataURL(blob);
                    } catch (e) {
                        console.error("Failed to load signature image (likely CORS):", e);
                        // Fallback: Try loading directly, though this might cause tainted canvas issues if edited/saved again
                        sigPadRef.current?.fromDataURL(value);
                    }
                } else {
                    sigPadRef.current.fromDataURL(value);
                }
            };

            loadSignature();
        }, [value]);

        return (
            <div className={cn("space-y-2", className)} ref={containerRef}>
                <div className={cn("border rounded-md relative bg-background overflow-hidden", disabled && "opacity-50 pointer-events-none")}>
                    <SignatureCanvas
                        ref={sigPadRef}
                        penColor="black"
                        canvasProps={{
                            className: "w-full h-[200px] touch-none cursor-crosshair block",
                            height: 200
                        }}
                        onEnd={handleEnd}
                    />
                    {!disabled && (
                        <div className="absolute top-2 right-2">
                            <Button type="button" variant="secondary" size="sm" onClick={handleClear} className="h-8 px-2 text-xs">
                                <Eraser className="w-3 h-3 mr-1" />
                                ล้าง
                            </Button>
                        </div>
                    )}
                    <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground pointer-events-none select-none">
                        เซ็นชื่อที่นี่ (Sign here)
                    </div>
                </div>
            </div>
        )
    }
)

SignatureInput.displayName = "SignatureInput"
