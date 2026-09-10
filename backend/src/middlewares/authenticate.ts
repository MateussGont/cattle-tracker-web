import type { FastifyReply, FastifyRequest } from "fastify";
import {
  getUserPropertyIds,
  getUserPropertyRole,
  type PropertyAccessRole,
} from "../repositories/usersRepository.js";

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: "admin" | "manager" | "viewer";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUserPayload;
    user: JwtUserPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ error: "unauthorized", message: "Token ausente ou inválido." });
  }
}

/**
 * Property-scoped authorization: admins see everything, other roles are
 * restricted to the properties they were granted access to via
 * user_properties (spec section 17 — "usuário só acessa o que possui
 * autorização").
 */
export async function assertPropertyAccess(request: FastifyRequest, propertyId: string): Promise<boolean> {
  if (request.user.role === "admin") {
    return true;
  }
  const propertyIds = await getUserPropertyIds(request.user.sub);
  return propertyIds.includes(propertyId);
}

export async function propertyAccessRole(
  request: FastifyRequest,
  propertyId: string,
): Promise<PropertyAccessRole | null> {
  if (request.user.role === "admin") {
    return "admin";
  }
  return getUserPropertyRole(request.user.sub, propertyId);
}

export async function assertPropertyWriteAccess(
  request: FastifyRequest,
  propertyId: string,
): Promise<boolean> {
  const role = await propertyAccessRole(request, propertyId);
  return role === "admin" || role === "manager";
}

export async function accessiblePropertyIds(request: FastifyRequest): Promise<string[] | undefined> {
  if (request.user.role === "admin") {
    return undefined;
  }
  return getUserPropertyIds(request.user.sub);
}
