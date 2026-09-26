import { FastifyInstance } from "fastify";
import { createUserController, deleteUserController, listUserByIdController, listUsersController, updateUserController } from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { authorizationMiddleware } from "../middlewares/authorizationMiddleware";

export const userRoutes = async (app: FastifyInstance) => {
    app.get("/users", {preHandler: [authMiddleware, authorizationMiddleware]},listUsersController);
    app.get<{Params: {id: number}}>("/users/:id", {preHandler: [authMiddleware, authorizationMiddleware]},listUserByIdController);
    app.post("/users", {preHandler: [authMiddleware, authorizationMiddleware]} ,createUserController);
    app.patch<{Params: {id: number}}>("/users/:id", {preHandler: [authMiddleware, authorizationMiddleware]}, updateUserController);
    app.delete<{Params: {id: number}}>("/users/:id", {preHandler: [authMiddleware, authorizationMiddleware]}, deleteUserController);
}