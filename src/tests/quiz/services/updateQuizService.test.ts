import { listQuizByIdMock, listQuizByContentIdMock, updateQuizMock, listContentByIdMock, createLogMock, teacher, content, savedQuiz, input, changes, updatedQuiz, expectNoWrites } from "./helpers/quizServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { updateQuizService } from "../../../services/quizService";

describe("updateQuizService", () => {
    test("deve permitir trocar para outro conteúdo do mesmo professor", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, id: changes.contentId });
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).resolves.toEqual(updatedQuiz);
        expect(listQuizByIdMock).toHaveBeenCalledWith(savedQuiz.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedQuiz.contentId);
        expect(listContentByIdMock).toHaveBeenCalledWith(changes.contentId);
        expect(listQuizByContentIdMock).toHaveBeenCalledWith(changes.contentId);
        expect(updateQuizMock).toHaveBeenCalledWith(savedQuiz.id, changes);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "ALTERACAO_QUIZ"
        }));
    });

    test("deve permitir manter o conteúdo atual", async () => {
        listQuizByContentIdMock.mockResolvedValue(savedQuiz);
        updateQuizMock.mockResolvedValue(savedQuiz);
        await expect(updateQuizService(savedQuiz.id, input, teacher.id)).resolves.toEqual(savedQuiz);
        expect(updateQuizMock).toHaveBeenCalledWith(savedQuiz.id, input);
    });

    test("deve impedir vincular o quiz ao conteúdo de outro professor", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, id: changes.contentId, teacherId: 20 });
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Você pode somente vincular quizzes aos seus próprios conteúdos");
        expectNoWrites();
    });

    test("deve impedir a troca para um conteúdo inexistente", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce(null);
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        expectNoWrites();
    });

    test("deve impedir a troca para um conteúdo que possui outro quiz", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, id: changes.contentId });
        listQuizByContentIdMock.mockResolvedValue({ id: 6, contentId: changes.contentId, teacherId: teacher.id });
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Este conteúdo já possui um quiz");
        expectNoWrites();
    });

    test("deve impedir atualizar um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(updateQuizService(999, changes, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });
});
