import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockApplications } from "@/lib/data";
import { ApplicationStatus } from "@/lib/types";
import { Users, FileClock, CheckCircle, XCircle } from "lucide-react";

export function OverviewCards() {
  const statusCounts = mockApplications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<ApplicationStatus, number>);

  const totalApplications = mockApplications.length;
  const pendingApplications = statusCounts.pending || 0;
  const approvedApplications = statusCounts.approved || 0;
  const rejectedApplications = statusCounts.rejected || 0;

  const cardData = [
    {
      title: "Total Applications",
      value: totalApplications,
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Pending Review",
      value: pendingApplications,
      icon: FileClock,
      color: "text-amber-500",
    },
    {
      title: "Approved",
      value: approvedApplications,
      icon: CheckCircle,
      color: "text-success",
    },
    {
      title: "Rejected",
      value: rejectedApplications,
      icon: XCircle,
      color: "text-destructive",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cardData.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
