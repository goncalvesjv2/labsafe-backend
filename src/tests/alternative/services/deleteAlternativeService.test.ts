import { listAlternativeByIdMock, listAlternativesByQuestionIdMock, countAlternativesMock, deleteAlternativeMock, createLogMock, teacher, correctAlternative, incorrectAlternative, thirdAlternative, savedAlternatives, expectNoWrites } from "./helpers/alternativeServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { deleteAlternativeService } from "../../../services/alternativeService";

describe("Exclusão de alternativas", () => {
    test("deve excluir uma incorreta quando restam duas alternativas e uma correta", async () => {
        countAlternativesMock.mockResolvedValue(3);
        listAlternativesByQuestionIdMock.mockResolvedValue([...savedAlternatives, thirdAlternative]);
        await expect(deleteAlternativeService(incorrectAlternative.id, teacher.id)).resolves.toBeUndefined();
        expect(deleteAlternativeMock).toHaveBeenCalledWith(incorrectAlternative.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "EXCLUSAO_ALTERNATIVA"
        }));
    });

    test("deve impedir a exclusão quando a questão possui somente duas alternativas", async () => {
        await expect(deleteAlternativeService(incorrectAlternative.id, teacher.id)).rejects.toThrow("no mínimo 2 alternativas");
        expectNoWrites();
    });

    test("deve impedir a exclusão da única alternativa correta", async () => {
        countAlternativesMock.mockResolvedValue(3);
        listAlternativeByIdMock.mockResolvedValue(correctAlternative);
        listAlternativesByQuestionIdMock.mockResolvedValue([...savedAlternatives, thirdAlternative]);
        await expect(deleteAlternativeService(correctAlternative.id, teacher.id)).rejects.toThrow("manter exatamente 1 alternativa correta");
        expectNoWrites();
    });
});
