import type { FastifyInstance } from "fastify";
import { changeCorrectController, createAlternativeController, deleteAlternativeController, listAlternativeByIdController, listAlternativesByQuestionIdController, listAlternativesController, updateAlternativeController } from "../controllers/alternativeController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { alternativeAuthorizationMiddleware } from "../middlewares/alternativeAuthorizationMiddleware";
import { teacherAuthorizationMiddleware } from "../middlewares/teacherAuthorizationMiddleware";

export const alternativeRoutes = (app: FastifyInstance) => {
    app.get("/alternatives", {preHandler: [authMiddleware, alternativeAuthorizationMiddleware]}, listAlternativesController);
    app.get<{Params: {id: string}}>("/alternatives/:id", {preHandler: [authMiddleware, alternativeAuthorizationMiddleware]}, listAlternativeByIdController);
    app.get<{Params: {questionId: string}}>("/questions/:questionId/alternatives", {preHandler: [authMiddleware, alternativeAuthorizationMiddleware]}, listAlternativesByQuestionIdController);
    app.post("/alternatives", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, createAlternativeController);
    app.patch<{Params: {id: string}}>("/alternatives/:id", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, updateAlternativeController);
    app.patch<{Params: {id: string}}>("/alternatives/:id/correct", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, changeCorrectController);
    app.delete<{Params: {id: string}}>("/alternatives/:id", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, deleteAlternativeController);
};
