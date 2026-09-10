import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { animals } from "../db/schema.js";

export interface ListAnimalsFilter {
  propertyIds?: string[];
  propertyId?: string;
  status?: "active" | "sold" | "deceased" | "inactive";
  search?: string;
  limit: number;
  offset: number;
}

export async function listAnimals(filter: ListAnimalsFilter) {
  if (filter.propertyIds !== undefined && filter.propertyIds.length === 0) {
    return [];
  }
  const conditions = [];
  if (filter.propertyId) {
    conditions.push(eq(animals.propertyId, filter.propertyId));
  }
  if (filter.propertyIds !== undefined) {
    conditions.push(inArray(animals.propertyId, filter.propertyIds));
  }
  if (filter.status) {
    conditions.push(eq(animals.status, filter.status));
  }
  if (filter.search) {
    conditions.push(
      sql`(${ilike(animals.tagCode, `%${filter.search}%`)} OR ${ilike(animals.name, `%${filter.search}%`)})`,
    );
  }

  return db
    .select()
    .from(animals)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(filter.limit)
    .offset(filter.offset)
    .orderBy(animals.tagCode);
}

export async function findAnimalById(id: string) {
  const [animal] = await db.select().from(animals).where(eq(animals.id, id)).limit(1);
  return animal ?? null;
}

export interface CreateAnimalInput {
  tagCode: string;
  name?: string;
  sex?: "male" | "female";
  breed?: string;
  birthDate?: Date;
  propertyId: string;
}

export async function createAnimal(input: CreateAnimalInput) {
  const [animal] = await db.insert(animals).values(input).returning();
  return animal;
}

export interface UpdateAnimalInput {
  name?: string;
  sex?: "male" | "female";
  breed?: string;
  birthDate?: Date;
  propertyId?: string;
  status?: "active" | "sold" | "deceased" | "inactive";
}

export async function updateAnimal(id: string, patch: UpdateAnimalInput) {
  const [animal] = await db
    .update(animals)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(animals.id, id))
    .returning();
  return animal ?? null;
}

export async function deactivateAnimal(id: string) {
  const [animal] = await db
    .update(animals)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(eq(animals.id, id))
    .returning();
  return animal ?? null;
}
