import { updateAlternativeMock, changeCorrectMock, createLogMock, teacher, incorrectAlternative, expectNoWrites } from "./helpers/alternativeServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { updateAlternativeService } from "../../../services/alternativeService";

describe("Atualização do texto da alternativa", () => {
    test("deve atualizar somente o texto e registrar o log", async () => {
        const changes = { text: "  Luvas de proteção  ", correct: true, questionId: 99 };
        const result = await updateAlternativeService(incorrectAlternative.id, changes, teacher.id);
        expect(updateAlternativeMock).toHaveBeenCalledWith(incorrectAlternative.id, { text: "Luvas de proteção" });
        expect(result).toEqual({ ...incorrectAlternative, text: "Luvas de proteção" });
        expect(changeCorrectMock).not.toHaveBeenCalled();
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "ALTERACAO_ALTERNATIVA"
        }));
    });

    test("deve rejeitar a atualização com texto vazio ou somente espaços", async () => {
        await expect(updateAlternativeService(2, { text: "" }, teacher.id)).rejects.toThrow("O texto da alternativa é obrigatório");
        await expect(updateAlternativeService(2, { text: "   " }, teacher.id)).rejects.toThrow("O texto da alternativa é obrigatório");
        expectNoWrites();
    });
});
