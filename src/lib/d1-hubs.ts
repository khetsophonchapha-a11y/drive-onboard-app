import { getDb } from "@/lib/db";
import { hubs } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface Hub {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAllHubs(): Promise<Hub[]> {
  try {
    const db = await getDb();
    
    const results = await db.select().from(hubs).orderBy(hubs.name);
    return results.map(h => ({
      id: h.id,
      name: h.name,
      createdAt: h.created_at ?? "",
      updatedAt: h.updated_at ?? ""
    }));
  } catch (error) {
    console.error("Error fetching hubs:", error);
    return [];
  }
}

export async function createHub(name: string): Promise<Hub> {
  const db = await getDb();
  const newId = crypto.randomUUID();

  const now = new Date().toISOString();
  
  const [newHub] = await db.insert(hubs).values({
    id: newId,
    name,
    created_at: now,
    updated_at: now,
  }).returning();

  return {
    id: newHub.id,
    name: newHub.name,
    createdAt: newHub.created_at ?? "",
    updatedAt: newHub.updated_at ?? ""
  };
}

export async function updateHub(id: string, name: string): Promise<Hub> {
  const db = await getDb();
  const now = new Date().toISOString();

  const [updatedHub] = await db.update(hubs)
    .set({ name, updated_at: now })
    .where(eq(hubs.id, id))
    .returning();

  return {
    id: updatedHub.id,
    name: updatedHub.name,
    createdAt: updatedHub.created_at ?? "",
    updatedAt: updatedHub.updated_at ?? ""
  };
}

export async function deleteHub(id: string): Promise<void> {
  const db = await getDb();

  await db.delete(hubs).where(eq(hubs.id, id));
}
