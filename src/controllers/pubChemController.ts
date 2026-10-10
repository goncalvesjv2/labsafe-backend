import { FastifyReply, FastifyRequest } from "fastify";
import { pubChemService } from "../services/pubChemService";

export async function pubChemController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const { name } = request.params as { name: string };
        const compound = await pubChemService(name);
        return reply.status(200).send(compound);
    } catch (error) {
        return reply.status(404).send({message: "Composto não encontrado no PubChem"});
    }
}