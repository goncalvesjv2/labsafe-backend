import { FastifyInstance } from "fastify";
import { listContentsController, listContentByIdController, createContentController, updateContentController, deleteContentController } from "../controllers/contentController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { teacherAuthorizationMiddleware } from "../middlewares/teacherAuthorizationMiddleware";

export const contentRoutes = async (app: FastifyInstance) => {
    app.get("/contents", {preHandler: [authMiddleware]}, listContentsController);
    app.get<{Params: {id: string}}>("/contents/:id", {preHandler: [authMiddleware]}, listContentByIdController);
    app.post("/contents", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, createContentController);
    app.patch<{Params: {id: string}}>("/contents/:id", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, updateContentController);
    app.delete<{Params: {id: string}}>("/contents/:id",{preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, deleteContentController);
};