import argon2 from "argon2";
import { findUserByEmail } from "../repositories/usersRepository.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "viewer";
}

export async function verifyCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await findUserByEmail(email);
  if (!user || user.status !== "active") {
    return null;
  }

  const passwordMatches = await argon2.verify(user.passwordHash, password);
  if (!passwordMatches) {
    return null;
  }

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
