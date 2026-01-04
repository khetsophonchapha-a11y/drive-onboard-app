import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

interface LegalAgreementProps {
    title: string;
    content: string[];
    footer?: string;
    className?: string;
}

export function LegalAgreement({ title, content, footer, className }: LegalAgreementProps) {
    return (
        <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
            <div className="flex flex-col space-y-1.5 p-6 border-b bg-muted/20">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {title}
                </h3>
            </div>
            <div className="p-6 pt-6">
                <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/10 text-sm text-muted-foreground">
                    <div className="space-y-4">
                        {content.map((clause, index) => (
                            <div key={index} className="flex gap-2">
                                <span className="font-semibold text-foreground min-w-[20px]">{index + 1}.</span>
                                <span className="leading-relaxed">{clause.replace(/^\d+\.\s*/, '')}</span>
                            </div>
                        ))}
                        {footer && (
                            <div className="pt-4 font-medium text-foreground text-center border-t mt-4">
                                {footer}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
