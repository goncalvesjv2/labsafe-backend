import { FastifyInstance } from "fastify";
import { listLogsController } from "../controllers/logController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { adminAuthorizationMiddleware } from "../middlewares/adminAuthorizationMiddleware";

export const logRoutes = async (app: FastifyInstance) => {
    app.get("/logs", {preHandler: [authMiddleware, adminAuthorizationMiddleware], exposeHeadRoute: false}, listLogsController);
};
