import { FastifyInstance } from "fastify";
import { pubChemController } from "../controllers/pubChemController";

export const pubChemRoutes = (app: FastifyInstance) => {
    app.get("/compounds/:name", pubChemController);
}