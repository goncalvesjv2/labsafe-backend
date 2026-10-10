import { FastifyInstance } from "fastify";
import { loginController } from "../controllers/authController";

export const authRoutes = async (app: FastifyInstance) => {
    app.post('/login', loginController);
}