import { listQuizzesMock, listQuizByIdMock, savedQuiz } from "./helpers/quizServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { listQuizByIdService, listQuizzesService } from "../../../services/quizService";

describe("Consultas de quiz", () => {
    test("deve listar os quizzes", async () => {
        await expect(listQuizzesService()).resolves.toEqual([savedQuiz]);
    });

    test("deve retornar uma lista vazia quando não há quizzes", async () => {
        listQuizzesMock.mockResolvedValue([]);
        await expect(listQuizzesService()).resolves.toEqual([]);
    });

    test("deve buscar um quiz pelo ID", async () => {
        await expect(listQuizByIdService(savedQuiz.id)).resolves.toEqual(savedQuiz);
        expect(listQuizByIdMock).toHaveBeenCalledWith(savedQuiz.id);
    });

    test("deve informar quando o quiz não existe", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(listQuizByIdService(999)).rejects.toThrow("Quiz não encontrado");
    });
});
