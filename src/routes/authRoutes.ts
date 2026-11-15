import { FastifyInstance } from "fastify";
import { getProfileController, loginController } from "../controllers/authController";
import { acceptUserInvitationController } from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

export const authRoutes = async (app: FastifyInstance) => {
    app.get('/me', { preHandler: [authMiddleware] }, getProfileController);
    app.post('/login', loginController);
    app.post('/invitations/accept', acceptUserInvitationController);
}
