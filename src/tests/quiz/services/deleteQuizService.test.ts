import { listQuizByIdMock, deleteQuizMock, listContentByIdMock, createLogMock, teacher, savedQuiz, expectNoWrites } from "./helpers/quizServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { deleteQuizService } from "../../../services/quizService";

describe("deleteQuizService", () => {
    test("deve excluir o quiz do professor e registrar o log", async () => {
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).resolves.toBeUndefined();
        expect(listQuizByIdMock).toHaveBeenCalledWith(savedQuiz.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedQuiz.contentId);
        expect(deleteQuizMock).toHaveBeenCalledWith(savedQuiz.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "EXCLUSAO_QUIZ"
        }));
    });

    test("deve impedir excluir um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(deleteQuizService(999, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });
});
