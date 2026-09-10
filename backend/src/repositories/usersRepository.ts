import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, userProperties } from "../db/schema.js";

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function getUserPropertyIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ propertyId: userProperties.propertyId })
    .from(userProperties)
    .where(eq(userProperties.userId, userId));
  return rows.map((row) => row.propertyId);
}

export type PropertyAccessRole = "admin" | "manager" | "viewer";

export async function getUserPropertyRole(
  userId: string,
  propertyId: string,
): Promise<PropertyAccessRole | null> {
  const [row] = await db
    .select({ role: userProperties.roleOnProperty })
    .from(userProperties)
    .where(and(eq(userProperties.userId, userId), eq(userProperties.propertyId, propertyId)))
    .limit(1);
  return row?.role ?? null;
}

export async function hasPropertyAccess(userId: string, propertyId: string): Promise<boolean> {
  const propertyIds = await getUserPropertyIds(userId);
  return propertyIds.includes(propertyId);
}
