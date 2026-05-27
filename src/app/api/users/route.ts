import { NextResponse } from "next/server";
import type { User } from "@/lib/types";
import { createUser, fetchAllUsers, isD1UsersEnabled } from "@/lib/d1-users";

// GET all users (from D1 via Worker)
export async function GET() {
  try {
    const users = await fetchAllUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error("[Users GET] error", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST a new user (hashed password stored in D1)
export async function POST(request: Request) {
  try {
    if (!isD1UsersEnabled()) {
      return NextResponse.json({ error: "D1 is not configured" }, { status: 500 });
    }

    const body = (await request.json()) as Partial<User> & { password?: string };
    if (!body.email || !body.password || !body.name || !body.role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const res = await createUser({
      email: body.email,
      name: body.name,
      role: body.role,
      password: body.password,
      phone: body.phone,
      avatarUrl: body.avatarUrl,
      hubId: body.hubId,
    });

    if ("error" in res && res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Users POST] error", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
