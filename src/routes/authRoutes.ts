import { FastifyInstance } from "fastify";
import { forgotPasswordController, getProfileController, loginController, resetPasswordController } from "../controllers/authController";
import { acceptUserInvitationController } from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

export const authRoutes = async (app: FastifyInstance) => {
    app.get('/me', { preHandler: [authMiddleware] }, getProfileController);
    app.post('/login', loginController);
    app.post('/forgot-password', forgotPasswordController);
    app.post('/reset-password', resetPasswordController);
    app.post('/invitations/accept', acceptUserInvitationController);
}
