import { FastifyReply, FastifyRequest } from "fastify";
import { listLogsService } from "../services/logService";

export async function listLogsController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const logs = await listLogsService();
        return reply.status(200).send(logs);
    } catch (error) {
        return reply.status(500).send(error);
    }
}
