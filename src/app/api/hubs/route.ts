import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchAllHubs, createHub } from "@/lib/d1-hubs";

export async function GET() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user as any).role;
  if (role !== "admin" && role !== "employee" && role !== "god") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hubs = await fetchAllHubs();
  return NextResponse.json(hubs);
}

export async function POST(req: NextRequest) {
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

    const hub = await createHub(name.trim());
    return NextResponse.json(hub, { status: 201 });
  } catch (error: any) {
    console.error("Error creating hub:", error);
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "มี Hub ชื่อนี้อยู่แล้ว" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create hub" }, { status: 500 });
  }
}
