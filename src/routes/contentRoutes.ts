import { FastifyInstance } from "fastify";
import { listContentsController, listContentByIdController, createContentController, updateContentController, deleteContentController } from "../controllers/contentController";
import { authMiddleware } from "../middlewares/authMiddleware";

export const contentRoutes = async (app: FastifyInstance) => {
    app.get("/contents",{preHandler: [authMiddleware]}, listContentsController);
    app.get<{Params: {id: string}}>("/contents/:id", {preHandler: [authMiddleware]}, listContentByIdController);
    app.post("/contents", {preHandler: [authMiddleware]}, createContentController);
    app.patch<{Params: {id: string}}>("/contents/:id", {preHandler: [authMiddleware]}, updateContentController);
    app.delete<{Params: {id: string}}>("/contents/:id",{preHandler: [authMiddleware]}, deleteContentController);
};