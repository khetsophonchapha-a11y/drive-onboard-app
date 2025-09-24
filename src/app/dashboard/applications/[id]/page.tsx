import { ApplicationDetails } from "@/components/dashboard/application-details";
import { mockApplications } from "@/lib/data";
import { notFound } from "next/navigation";

type PageProps = {
  params: {
    id: string;
  };
};

export default function ApplicationDetailPage({ params }: PageProps) {
  const application = mockApplications.find((app) => app.id === params.id);

  if (!application) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ApplicationDetails application={application} />
    </div>
  );
}
