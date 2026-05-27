import crypto from "crypto";
import { sampleAdminAccount } from "@/data/sample-data";
import type { User } from "@/lib/types";
import { isD1Enabled } from "./d1-client"; // Keep for local legacy check
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type D1UserRow = {
  id: string;
  email: string;
  name: string;
  role: string; // "admin" | "employee"
  phone?: string | null;
  password_hash?: string | null;
  avatar_url?: string | null;
  status: string; // "active" | "archived"
  hub_id?: string | null;
};

function toUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as User["role"], // specific cast
    phone: row.phone ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    status: (row.status || "active") as User["status"],
    hubId: row.hub_id ?? undefined,
  };
}

export function isD1UsersEnabled() {
  // In production, always assume D1 is available (via binding)
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.USE_REMOTE_D1 === "true") return true;
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_D1_TOKEN) {
    return true;
  }
  return isD1Enabled();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string | undefined | null): Promise<boolean> {
  console.log("[AuthDebug] Verifying password for hash:", hash ? "present" : "missing");
  if (!hash) return false;
  const [saltHex, keyHex] = hash.split(":");
  if (!saltHex || !keyHex) {
    console.log("[AuthDebug] Invalid hash format");
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const key = Buffer.from(keyHex, "hex");

  try {
    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, key.length, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey as Buffer);
      });
    });

    const match = crypto.timingSafeEqual(key, derived);
    console.log("[AuthDebug] Password match:", match);
    return match;
  } catch (error) {
    console.error("[AuthDebug] Scrypt error:", error);
    return false;
  }
}

export async function fetchAllUsers(): Promise<User[]> {
  try {
    let rows: any[] = [];
    try {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");
        const { env }: any = await getCloudflareContext();
        if (env && env.DB && env.DB.prepare) {
            console.log("Using raw D1 API for fetchAllUsers");
            const res = await env.DB.prepare("SELECT * FROM users").all();
            rows = res.results || [];
        }
    } catch (e) {
        // Ignored in local
    }

    if (rows.length === 0) {
        const db = await getDb();
        if (!db) return [];
        rows = await db.select().from(users).all();
    }
    return rows.map(toUser).filter(u => u.role !== 'god');
  } catch (error) {
    console.error("[D1] fetchAllUsers error:", error);
    return [];
  }
}

export async function fetchUserByEmail(email: string): Promise<D1UserRow | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!result.length) return null;
    return result[0] as D1UserRow;
  } catch (error) {
    console.error("[D1] fetchUserByEmail error:", error);
    return null;
  }
}

export async function fetchUserById(id: string): Promise<D1UserRow | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!result.length) return null;
    return result[0] as D1UserRow;
  } catch (error) {
    console.error("[D1] fetchUserById error:", error);
    return null;
  }
}

export async function deleteUserById(id: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.delete(users).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("[D1] deleteUserById error:", error);
    return false;
  }
}

export async function updateUserById(
  id: string,
  input: { email?: string; name?: string; role?: User["role"]; password?: string; avatarUrl?: string; phone?: string; status?: User["status"]; hubId?: string | null }
): Promise<D1UserRow | null> {
  const db = await getDb();
  if (!db) return null;

  let password_hash: string | undefined;
  if (input.password) {
    password_hash = await hashPassword(input.password);
  }

  const updateData: any = {};
  if (input.email !== undefined) updateData.email = input.email;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.role !== undefined) updateData.role = input.role;
  if (password_hash !== undefined) updateData.password_hash = password_hash;
  if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.hubId !== undefined) updateData.hub_id = input.hubId;

  try {
    const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    if (!result.length) return null;
    return result[0] as D1UserRow;
  } catch (error) {
    console.error("[D1] updateUserById error:", error);
    return null;
  }
}

export async function createUser(input: {
  email: string;
  name: string;
  role: User["role"];
  password: string;
  avatarUrl?: string;
  phone?: string;
  status?: User["status"];
  hubId?: string | null;
}) {
  const db = await getDb();
  if (!db) return { error: "D1 not configured" };

  try {
    const password_hash = await hashPassword(input.password);
    const newId = crypto.randomUUID();

    const result = await db.insert(users).values({
      id: newId,
      email: input.email,
      name: input.name,
      role: input.role,
      password_hash,
      phone: input.phone,
      avatar_url: input.avatarUrl,
      status: input.status || "active",
      hub_id: input.hubId,
    }).returning();

    return { data: result[0] };
  } catch (error: any) {
    console.error("[D1] createUser error:", error);
    return { error: error.message || "Failed to create user" };
  }
}

export async function ensureAdminSeed() {
  const db = await getDb();
  if (!db) return;

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || sampleAdminAccount.email).toLowerCase();
  const existing = await fetchUserByEmail(adminEmail);
  if (existing) return;

  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || sampleAdminAccount.password;
  console.log("[D1] Seeding admin user to D1");

  await createUser({
    email: adminEmail,
    name: sampleAdminAccount.name,
    role: "admin",
    password: adminPassword,
    avatarUrl: sampleAdminAccount.avatarUrl,
  });
}
