import { FastifyInstance } from "fastify";
import { createUserController, deleteUserController, listUserByIdController, listUsersController, updateUserController } from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { adminAuthorizationMiddleware } from "../middlewares/adminAuthorizationMiddleware";

export const userRoutes = async (app: FastifyInstance) => {
    app.get("/users", {preHandler: [authMiddleware, adminAuthorizationMiddleware]},listUsersController);
    app.get<{Params: {id: string}}>("/users/:id", {preHandler: [authMiddleware, adminAuthorizationMiddleware]},listUserByIdController);
    app.post("/users", {preHandler: [authMiddleware, adminAuthorizationMiddleware]} ,createUserController);
    app.patch<{Params: {id: string}}>("/users/:id", {preHandler: [authMiddleware, adminAuthorizationMiddleware]}, updateUserController);
    app.delete<{Params: {id: string}}>("/users/:id", {preHandler: [authMiddleware, adminAuthorizationMiddleware]}, deleteUserController);
}
