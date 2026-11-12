import type { FastifyInstance } from "fastify";
import { listQuestionsController, listQuestionByIdController, listQuestionsByQuizIdController, createQuestionController, updateQuestionController, deleteQuestionController } from "../controllers/questionController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { questionAuthorizationMiddleware } from "../middlewares/questionAuthorizationMiddleware";
import { teacherAuthorizationMiddleware } from "../middlewares/teacherAuthorizationMiddleware";

export const questionRoutes = (app: FastifyInstance) => {
    app.get("/questions", {preHandler: [authMiddleware, questionAuthorizationMiddleware]}, listQuestionsController);
    app.get<{Params: {id: string}}>("/questions/:id", {preHandler: [authMiddleware, questionAuthorizationMiddleware]}, listQuestionByIdController);
    app.get<{Params: {quizId: string}}>("/quizzes/:quizId/questions", {preHandler: [authMiddleware, questionAuthorizationMiddleware]}, listQuestionsByQuizIdController);
    app.post("/questions", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, createQuestionController);
    app.patch<{Params: {id: string}}>("/questions/:id", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, updateQuestionController);
    app.delete<{Params: {id: string}}>("/questions/:id", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, deleteQuestionController);
};