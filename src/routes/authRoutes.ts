import type { FastifyInstance } from "fastify";
import { getProfileController, loginController } from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";

export const authRoutes = async (app: FastifyInstance) => {
    app.get('/me', { preHandler: [authMiddleware] }, getProfileController);
    app.post('/login', loginController);
}