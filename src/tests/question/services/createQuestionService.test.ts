import { countQuestionsMock, createQuestionMock, createLogMock, teacher, quiz, input, savedQuestion, expectNoWrites } from "./helpers/questionServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { createQuestionService } from "../../../services/questionService";

describe("Cadastro de questões", () => {
    test("deve permitir cadastrar a primeira questão, normalizar o enunciado e registrar o log", async () => {
        countQuestionsMock.mockResolvedValue(0);
        const data = { quizId: quiz.id, statement: "  Quando utilizar luvas?  " };
        const result = await createQuestionService(data, teacher.id);
        expect(result).toEqual(savedQuestion);
        expect(createQuestionMock).toHaveBeenCalledWith(input);
        expect(countQuestionsMock).toHaveBeenCalledWith(quiz.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ userId: teacher.id, action: "CADASTRO_QUESTAO" }));
    });

    test("deve permitir cadastrar a décima questão", async () => {
        countQuestionsMock.mockResolvedValue(9);
        const result = await createQuestionService(input, teacher.id);
        expect(result).toEqual(savedQuestion);
        expect(createQuestionMock).toHaveBeenCalledTimes(1);
    });

    test("deve impedir o cadastro quando já existem dez ou mais questões", async () => {
        countQuestionsMock.mockResolvedValue(10);
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("O quiz pode ter no máximo 10 questões");
        countQuestionsMock.mockResolvedValue(11);
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("O quiz pode ter no máximo 10 questões");
        expectNoWrites();
    });

    test("deve rejeitar enunciados vazios ou formados por espaços", async () => {
        const emptyStatement = { quizId: quiz.id, statement: "" };
        const spacesOnly = { quizId: quiz.id, statement: "  \t\n " };
        await expect(createQuestionService(emptyStatement, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        await expect(createQuestionService(spacesOnly, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        expectNoWrites();
    });
});
