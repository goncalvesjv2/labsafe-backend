import { listQuizByContentIdMock, createQuizMock, listContentByIdMock, listUserByIdMock, createLogMock, teacher, savedQuiz, input, expectNoWrites } from "./helpers/quizServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { createQuizService } from "../../../services/quizService";

describe("createQuizService", () => {
    test("deve criar o quiz para um conteúdo do professor e registrar o log", async () => {
        await expect(createQuizService(input, teacher.id)).resolves.toEqual(savedQuiz);
        expect(listUserByIdMock).toHaveBeenCalledWith(teacher.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(input.contentId);
        expect(listQuizByContentIdMock).toHaveBeenCalledWith(input.contentId);
        expect(createQuizMock).toHaveBeenCalledWith(input, teacher.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "CADASTRO_QUIZ",
            description: expect.stringContaining(teacher.email)
        }));
    });

    test("deve impedir um segundo quiz para o mesmo conteúdo", async () => {
        listQuizByContentIdMock.mockResolvedValue(savedQuiz);
        await expect(createQuizService(input, teacher.id)).rejects.toThrow("Este conteúdo já possui um quiz");
        expectNoWrites();
    });
});
