import { listQuestionsMock, listQuestionByIdMock, listQuestionsByQuizIdMock, listQuizByIdMock, quiz, savedQuestion } from "./helpers/questionServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { listQuestionByIdService, listQuestionsByQuizIdService, listQuestionsService } from "../../../services/questionService";

describe("Consultas de questões", () => {
    test("deve listar todas as questões", async () => {
        const result = await listQuestionsService();
        expect(result).toEqual([savedQuestion]);
    });

    test("deve permitir uma listagem geral vazia", async () => {
        listQuestionsMock.mockResolvedValue([]);
        const result = await listQuestionsService();
        expect(result).toEqual([]);
    });

    test("deve buscar uma questão pelo ID", async () => {
        const result = await listQuestionByIdService(savedQuestion.id);
        expect(result).toEqual(savedQuestion);
        expect(listQuestionByIdMock).toHaveBeenCalledWith(savedQuestion.id);
    });

    test("deve informar quando a questão não existe", async () => {
        listQuestionByIdMock.mockResolvedValue(null);
        await expect(listQuestionByIdService(999)).rejects.toThrow("Questão não encontrada");
    });

    test("deve listar as questões de um quiz existente", async () => {
        const result = await listQuestionsByQuizIdService(quiz.id);
        expect(result).toEqual([savedQuestion]);
        expect(listQuestionsByQuizIdMock).toHaveBeenCalledWith(quiz.id);
    });

    test("deve permitir um quiz existente sem questões", async () => {
        listQuestionsByQuizIdMock.mockResolvedValue([]);
        const result = await listQuestionsByQuizIdService(quiz.id);
        expect(result).toEqual([]);
    });

    test("deve rejeitar a listagem por um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(listQuestionsByQuizIdService(999)).rejects.toThrow("Quiz não encontrado");
        expect(listQuestionsByQuizIdMock).not.toHaveBeenCalled();
    });
});
