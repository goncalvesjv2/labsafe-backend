import { FastifyInstance } from "fastify";
import { pubChemController } from "../controllers/pubChemController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { studentAuthorizationMiddleware } from "../middlewares/studentAuthorizationMiddleware";

export const pubChemRoutes = (app: FastifyInstance) => {
    app.get("/compounds/:name", {preHandler: [authMiddleware, studentAuthorizationMiddleware]}, pubChemController);
}
