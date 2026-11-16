import { FastifyInstance } from "fastify";
import { createAttemptController, getQuizResultController, listAttemptByIdController, listAttemptsByQuizIdController, listAttemptsByStudentAndQuizIdController } from "../controllers/attemptController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { studentAuthorizationMiddleware } from "../middlewares/studentAuthorizationMiddleware";
import { teacherAuthorizationMiddleware } from "../middlewares/teacherAuthorizationMiddleware";

export const attemptRoutes = (app: FastifyInstance) => {
    app.get<{Params: {id: string}}>("/attempts/:id", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, listAttemptByIdController);
    app.get<{Params: {quizId: string}}>("/quizzes/:quizId/attempts", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, listAttemptsByQuizIdController);
    app.get<{Params: {studentId: string, quizId: string}}>("/quizzes/:quizId/students/:studentId/attempts", {preHandler: [authMiddleware, teacherAuthorizationMiddleware]}, listAttemptsByStudentAndQuizIdController);
    app.get<{Params: {quizId: string}}>("/quizzes/:quizId/result", {preHandler: [authMiddleware, studentAuthorizationMiddleware]}, getQuizResultController);
    app.post("/attempts", {preHandler: [authMiddleware, studentAuthorizationMiddleware]}, createAttemptController);
};
