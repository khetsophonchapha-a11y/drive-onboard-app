"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Application, ApplicationStatus } from "@/lib/types";
import { ArrowUpDown, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Card } from "@/components/ui/card";

type ApplicationsTableProps = {
  applications: Application[];
};

const statusVariantMap: Record<ApplicationStatus, "default" | "secondary" | "success" | "destructive"> = {
  incomplete: "secondary",
  pending: "default",
  approved: "success",
  rejected: "destructive",
};

const statusText: Record<ApplicationStatus, string> = {
  incomplete: "เอกสารไม่ครบ",
  pending: "รอตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
};

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ApplicationStatus>("all");
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof Application | 'applicant.fullName'; direction: 'ascending' | 'descending' } | null>({ key: 'createdAt', direction: 'descending' });
  const router = useRouter();

  const handleSort = (key: keyof Application | 'applicant.fullName') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredApplications = React.useMemo(() => {
    let filtered = applications.filter((app) =>
      app.applicant.fullName.toLowerCase().includes(search.toLowerCase())
    );

    if (statusFilter !== "all") {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const key = sortConfig.key;
        let aValue: any;
        let bValue: any;
        
        if (key === 'applicant.fullName') {
            aValue = a.applicant.fullName;
            bValue = b.applicant.fullName;
        } else {
            aValue = a[key as keyof Application];
            bValue = b[key as keyof Application];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [applications, search, statusFilter, sortConfig]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="ค้นหาด้วยชื่อ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="กรองตามสถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="pending">{statusText.pending}</SelectItem>
            <SelectItem value="approved">{statusText.approved}</SelectItem>
            <SelectItem value="rejected">{statusText.rejected}</SelectItem>
            <SelectItem value="incomplete">{statusText.incomplete}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('applicant.fullName')}>
                  ผู้สมัคร <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                 <Button variant="ghost" onClick={() => handleSort('status')}>
                  สถานะ <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <Button variant="ghost" onClick={() => handleSort('createdAt')}>
                  วันที่ส่ง <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.applicant.fullName || 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariantMap[app.status]} className="capitalize">{statusText[app.status]}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{format(new Date(app.createdAt), "PPP", { locale: th })}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/applications/${app.id}`)}>
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">ดูใบสมัคร</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
