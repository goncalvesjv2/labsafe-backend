import { FastifyInstance } from "fastify";
import { forgotPasswordController, getProfileController, loginController, resetPasswordController } from "../controllers/authController";
import { acceptUserInvitationController, deleteUserController } from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

export const authRoutes = async (app: FastifyInstance) => {
    app.get('/me', { preHandler: [authMiddleware] }, getProfileController);
    app.delete<{Params: {id?: string}}>('/me', { preHandler: [authMiddleware] }, deleteUserController);
    app.post('/login', loginController);
    app.post('/forgot-password', forgotPasswordController);
    app.post('/reset-password', resetPasswordController);
    app.post('/new-password', acceptUserInvitationController);
}
