import type { FastifyInstance } from "fastify";
import { loginSchema } from "../schemas/auth.js";
import { verifyCredentials } from "../services/authService.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await verifyCredentials(body.email, body.password);
    if (!user) {
      return reply.code(401).send({ error: "invalid_credentials", message: "E-mail ou senha inválidos." });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { token, user };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    // Stateless JWT: the client discards the token. Nothing to invalidate server-side yet.
    return reply.code(204).send();
  });
}
