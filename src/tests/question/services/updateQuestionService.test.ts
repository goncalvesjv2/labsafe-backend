import { countQuestionsMock, updateQuestionMock, listQuizByIdMock, createLogMock, teacher, quiz, savedQuestion, changes, updatedQuestion, expectNoWrites } from "./helpers/questionServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { updateQuestionService } from "../../../services/questionService";

describe("Atualização de questões", () => {
    test("deve atualizar somente o enunciado e registrar o log", async () => {
        const data = { statement: "  Quando utilizar óculos de proteção?  " };
        const result = await updateQuestionService(savedQuestion.id, data, teacher.id);
        expect(result).toEqual(updatedQuestion);
        expect(updateQuestionMock).toHaveBeenCalledWith(savedQuestion.id, changes);
        expect(countQuestionsMock).not.toHaveBeenCalled();
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ userId: teacher.id, action: "ALTERACAO_QUESTAO" }));
    });

    test("deve permitir manter o quiz atual mesmo quando ele possui dez questões", async () => {
        countQuestionsMock.mockResolvedValue(10);
        const data = { quizId: quiz.id, statement: changes.statement };
        const result = await updateQuestionService(savedQuestion.id, data, teacher.id);
        expect(result).toEqual(updatedQuestion);
        expect(countQuestionsMock).not.toHaveBeenCalled();
    });

    test("deve enviar somente o enunciado ao repository mesmo se receber outro quizId", async () => {
        const data = { quizId: 99, statement: "  Quando utilizar óculos de proteção?  " };
        const result = await updateQuestionService(savedQuestion.id, data, teacher.id);

        expect(result.quizId).toBe(quiz.id);
        expect(updateQuestionMock).toHaveBeenCalledWith(savedQuestion.id, changes);
        expect(listQuizByIdMock).toHaveBeenCalledTimes(1);
        expect(listQuizByIdMock).toHaveBeenCalledWith(quiz.id);
        expect(countQuestionsMock).not.toHaveBeenCalled();
    });

    test("deve rejeitar uma atualização sem campos", async () => {
        await expect(updateQuestionService(savedQuestion.id, {}, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        expectNoWrites();
    });

    test("deve rejeitar a alteração para um enunciado vazio", async () => {
        await expect(updateQuestionService(savedQuestion.id, { statement: "" }, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        await expect(updateQuestionService(savedQuestion.id, { statement: "   " }, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        expectNoWrites();
    });
});
