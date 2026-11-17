import { deleteQuestionMock, createLogMock, teacher, savedQuestion } from "./helpers/questionServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { deleteQuestionService } from "../../../services/questionService";

describe("Exclusão de questões", () => {
    test("deve excluir a questão própria e registrar o log", async () => {
        await deleteQuestionService(savedQuestion.id, teacher.id);
        expect(deleteQuestionMock).toHaveBeenCalledWith(savedQuestion.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ userId: teacher.id, action: "EXCLUSAO_QUESTAO" }));
    });
});
