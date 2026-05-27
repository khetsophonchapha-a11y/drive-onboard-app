import { auth } from "@/auth";
import type { User } from "@/lib/types";
import { UsersClient } from "@/components/dashboard/users-client";
import { redirect } from "next/navigation";

import { fetchAllUsers } from "@/lib/d1-users";
import { fetchAllHubs } from "@/lib/d1-hubs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

async function getUsers(): Promise<User[]> {
  try {
    return await fetchAllUsers();
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export default async function UsersPage() {
  const session = await auth();

  const currentUser = session?.user as User | undefined;
  if (currentUser?.role !== "admin" && currentUser?.role !== "god") {
    redirect("/dashboard");
  }

  const users = await getUsers();
  const hubs = await fetchAllHubs();
  const currentUserEmail = currentUser?.email ?? undefined;
  const currentUserRole = currentUser?.role;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <UsersClient data={users} hubs={hubs} currentUserEmail={currentUserEmail} currentUserRole={currentUserRole} />
    </div>
  );
}
