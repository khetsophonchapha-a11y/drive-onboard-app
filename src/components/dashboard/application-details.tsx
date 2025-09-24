"use client";

import { useState } from "react";
import type { Application, Document, DocumentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  FileClock,
  FileQuestion,
  TriangleAlert,
  Sparkles,
  Loader2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzeIncompleteForm } from "@/ai/flows/analyze-incomplete-forms";
import { applicationFormSchema, requiredDocumentsSchema } from "@/lib/schema";
import { getImageAsDataUri } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ApplicationDetailsProps = {
  application: Application;
};

const statusIcons: Record<DocumentStatus, React.ElementType> = {
  missing: FileQuestion,
  uploaded: FileClock,
  "pending review": FileClock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const statusColors: Record<DocumentStatus, string> = {
  missing: "text-muted-foreground",
  uploaded: "text-blue-500",
  "pending review": "text-amber-500",
  approved: "text-success",
  rejected: "text-destructive",
};

const statusVariantMap: Record<Application["status"], "default" | "secondary" | "success" | "destructive"> = {
  incomplete: "secondary",
  pending: "default",
  approved: "success",
  rejected: "destructive",
};

export function ApplicationDetails({ application: initialApplication }: ApplicationDetailsProps) {
  const [application, setApplication] = useState<Application>(initialApplication);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ analysis: string; instructions: string } | null>(null);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const uploadedDocuments = application.documents.filter(doc => doc.fileUrl);
      const documentDataUris = await Promise.all(
        uploadedDocuments.map(doc => getImageAsDataUri(doc.fileUrl!))
      );
      
      const filledFormData = JSON.stringify({
        applicant: application.applicant,
        vehicle: application.vehicle,
        guarantor: application.guarantor,
      });

      const result = await analyzeIncompleteForm({
        documentDataUris,
        applicationFormSchema: JSON.stringify(applicationFormSchema),
        filledFormData,
      });

      setAnalysisResult(result);
      setIsAnalysisDialogOpen(true);

    } catch (error) {
      console.error("Failed to analyze form:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "Could not analyze the form. Please try again.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const allDocuments = requiredDocumentsSchema.map(reqDoc => {
    const submittedDoc = application.documents.find(d => d.type === reqDoc.type);
    return submittedDoc || { id: reqDoc.id, type: reqDoc.type, status: 'missing' };
  });

  const renderDetail = (label: string, value: string | number | undefined) => (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{value || <span className="text-muted-foreground/70">Not provided</span>}</dd>
    </div>
  );
  
  return (
    <>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-headline text-2xl">{application.applicant.fullName || "Unnamed Applicant"}</CardTitle>
                    <CardDescription>Application ID: {application.id}</CardDescription>
                  </div>
                  <Badge variant={statusVariantMap[application.status]} className="capitalize text-base">{application.status}</Badge>
              </div>
            </CardHeader>
          </Card>
          
          <Tabs defaultValue="documents">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="applicant">Applicant</TabsTrigger>
              <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
              <TabsTrigger value="guarantor">Guarantor</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <TabsContent value="applicant">
              <Card>
                <CardHeader><CardTitle className="font-headline">Applicant Information</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {renderDetail("Full Name", application.applicant.fullName)}
                  {renderDetail("Email", application.applicant.email)}
                  {renderDetail("Phone", application.applicant.phone)}
                  {renderDetail("Address", application.applicant.address)}
                  {renderDetail("Date of Birth", application.applicant.dateOfBirth)}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="vehicle">
              <Card>
                <CardHeader><CardTitle className="font-headline">Vehicle Information</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {renderDetail("Make", application.vehicle.make)}
                  {renderDetail("Model", application.vehicle.model)}
                  {renderDetail("Year", application.vehicle.year)}
                  {renderDetail("License Plate", application.vehicle.licensePlate)}
                  {renderDetail("VIN", application.vehicle.vin)}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="guarantor">
               <Card>
                <CardHeader><CardTitle className="font-headline">Guarantor Information</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {renderDetail("Full Name", application.guarantor.fullName)}
                  {renderDetail("Email", application.guarantor.email)}
                  {renderDetail("Phone", application.guarantor.phone)}
                  {renderDetail("Address", application.guarantor.address)}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline">Document Verification</CardTitle>
                  <CardDescription>Review and approve/reject submitted documents.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {allDocuments.map((doc: Document) => {
                     const Icon = statusIcons[doc.status];
                     return (
                      <div key={doc.id} className="border rounded-lg p-4 space-y-4">
                         <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{doc.type}</h4>
                            <div className={`flex items-center gap-2 text-sm font-medium ${statusColors[doc.status]}`}>
                                <Icon className="h-4 w-4" />
                                <span className="capitalize">{doc.status}</span>
                            </div>
                        </div>

                        {doc.status !== 'missing' && doc.fileUrl && (
                          <div className="flex flex-col md:flex-row gap-4">
                             <div className="relative w-full md:w-1/3 aspect-video rounded-md overflow-hidden border">
                                <Image src={doc.fileUrl} alt={doc.type} fill style={{ objectFit: 'cover' }} data-ai-hint="document" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Select defaultValue={doc.quality || 'clear'}>
                                    <SelectTrigger><SelectValue placeholder="Assess quality..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="clear">Clear</SelectItem>
                                        <SelectItem value="blurry">Blurry</SelectItem>
                                        <SelectItem value="incomplete">Incomplete</SelectItem>
                                        <SelectItem value="incorrect">Incorrect Document</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Textarea placeholder="Add verification notes..." defaultValue={doc.notes} />
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" variant="success">Approve</Button>
                                    <Button size="sm" variant="destructive">Reject</Button>
                                </div>
                            </div>
                          </div>
                        )}

                        {doc.status === 'missing' && (
                           <div className="flex items-center justify-center p-6 bg-muted/50 rounded-md border-dashed border-2">
                               <div className="text-center text-muted-foreground">
                                   <p className="font-medium">No document uploaded.</p>
                                   <Button size="sm" variant="outline" className="mt-2"><Upload className="mr-2 h-4 w-4"/>Request Upload</Button>
                               </div>
                           </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
                 <CardFooter>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          AI Incompleteness Analysis
                        </>
                      )}
                    </Button>
                 </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
       <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-headline text-2xl">
              <Sparkles className="h-6 w-6 text-primary" />
              AI Form Analysis Report
            </DialogTitle>
            <DialogDescription>
              Analysis of missing or incorrect information based on submitted data.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 pr-4 space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Analysis Summary</h3>
              <p className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">{analysisResult?.analysis}</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Instructions for Applicant</h3>
              <div className="text-sm border p-3 rounded-md prose-sm prose-p:my-1 prose-ul:my-1">
                <p>{analysisResult?.instructions}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
