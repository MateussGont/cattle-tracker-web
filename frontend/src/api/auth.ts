import { apiRequest } from "./client";
import type { AuthUser } from "../types";

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/login", { method: "POST", body: { email, password } });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/api/auth/logout", { method: "POST" });
}
