import type { FastifyInstance } from "fastify";
import { listQuizzesController, listQuizByIdController, createQuizController, updateQuizController, deleteQuizController } from "../controllers/quizController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { quizAuthorizationMiddleware } from "../middlewares/quizAuthorizationMiddleware";
import { teacherAuthorizationMiddleware } from "../middlewares/teacherAuthorizationMiddleware";

export const quizRoutes = (app: FastifyInstance) => {
    app.get("/quizzes", { preHandler: [authMiddleware, quizAuthorizationMiddleware] }, listQuizzesController);
    app.get<{Params: {id: string}}>("/quizzes/:id", { preHandler: [authMiddleware, quizAuthorizationMiddleware] }, listQuizByIdController);
    app.post("/quizzes", { preHandler: [authMiddleware, teacherAuthorizationMiddleware] }, createQuizController);
    app.patch<{Params: {id: string}}>("/quizzes/:id", { preHandler: [authMiddleware, teacherAuthorizationMiddleware] }, updateQuizController);
    app.delete<{Params: {id: string}}>("/quizzes/:id", { preHandler: [authMiddleware, teacherAuthorizationMiddleware] }, deleteQuizController);
};
