import { changeCorrectMock, createLogMock, teacher, question, incorrectAlternative } from "./helpers/alternativeServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { changeCorrectService } from "../../../services/alternativeService";

describe("Troca da alternativa correta", () => {
    test("deve solicitar a troca da correta na questão da alternativa e registrar o log", async () => {
        const result = await changeCorrectService(incorrectAlternative.id, teacher.id);
        expect(changeCorrectMock).toHaveBeenCalledWith(incorrectAlternative.id, question.id);
        expect(result).toEqual({ ...incorrectAlternative, correct: true });
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "ALTERACAO_ALTERNATIVA_CORRETA"
        }));
    });
});
