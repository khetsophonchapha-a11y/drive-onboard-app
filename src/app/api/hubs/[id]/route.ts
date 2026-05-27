import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateHub, deleteHub } from "@/lib/d1-hubs";
import { fetchAllUsers } from "@/lib/d1-users";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user as any).role;
  if (role !== "admin" && role !== "god") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name } = await req.json();
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const hub = await updateHub(params.id, name.trim());
    return NextResponse.json(hub);
  } catch (error: any) {
    console.error("Error updating hub:", error);
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "มี Hub ชื่อนี้อยู่แล้ว" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update hub" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user as any).role;
  if (role !== "admin" && role !== "god") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Check if any user is using this hub
    const users = await fetchAllUsers();
    const isHubInUse = users.some(u => (u as any).hubId === params.id);
    if (isHubInUse) {
      return NextResponse.json({ error: "ไม่สามารถลบได้ เนื่องจากมีพนักงานอยู่ใน Hub นี้" }, { status: 400 });
    }

    await deleteHub(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting hub:", error);
    return NextResponse.json({ error: "Failed to delete hub" }, { status: 500 });
  }
}
