import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { NotFoundError } from "../services/deviceAssignmentService.js";
import { UnknownDeviceError } from "../services/telemetryService.js";

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: "validation_error",
      message: "Dados inválidos.",
      details: error.flatten(),
    });
    return;
  }

  if (error instanceof NotFoundError) {
    reply.code(404).send({ error: "not_found", message: error.message });
    return;
  }

  if (error instanceof UnknownDeviceError) {
    reply.code(422).send({ error: "unknown_device", message: error.message });
    return;
  }

  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode && fastifyError.statusCode < 500) {
    reply.code(fastifyError.statusCode).send({ error: "bad_request", message: fastifyError.message });
    return;
  }

  request.log.error({ err: error, url: request.url, method: request.method }, "unhandled request error");
  reply.code(500).send({ error: "internal_error", message: "Erro interno do servidor." });
}
