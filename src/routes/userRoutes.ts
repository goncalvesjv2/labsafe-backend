import { FastifyInstance } from "fastify";
import { createUserController, deleteUserController, listUserByIdController, listUsersController, updateUserController } from "../controllers/userController";

export const userRoutes = async (app: FastifyInstance) => {
    app.get("/users", listUsersController);
    app.get<{Params: {id: number}}>("/users/:id", listUserByIdController);
    app.post("/users", createUserController);
    app.patch<{Params: {id: number}}>("/users/:id", updateUserController);
    app.delete<{Params: {id: number}}>("/users/:id", deleteUserController);
}