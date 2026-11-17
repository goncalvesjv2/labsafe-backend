import { listAlternativesByQuestionIdMock, countAlternativesMock, createAlternativeMock, createLogMock, teacher, question, input, thirdAlternative, savedAlternatives, expectNoWrites } from "./helpers/alternativeServiceSetup";
import { beforeEach, describe, expect, test } from "@jest/globals";
import { createAlternativeService } from "../../../services/alternativeService";

describe("Cadastro de alternativas", () => {
    beforeEach(() => {
        countAlternativesMock.mockResolvedValue(0);
        listAlternativesByQuestionIdMock.mockResolvedValue([]);
    });

    test("deve cadastrar duas alternativas com uma correta e registrar os logs", async () => {
        const result = await createAlternativeService(input, teacher.id);
        expect(result).toEqual(savedAlternatives);
        expect(createAlternativeMock).toHaveBeenCalledWith(input);
        expect(createLogMock).toHaveBeenCalledTimes(2);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "CADASTRO_ALTERNATIVA"
        }));
    });

    test("deve permitir cadastrar três alternativas juntas", async () => {
        const alternatives = [...input, { questionId: question.id, text: "Jaleco", correct: false }];
        const saved = [...savedAlternatives, thirdAlternative];
        createAlternativeMock.mockResolvedValue(saved);
        const result = await createAlternativeService(alternatives, teacher.id);
        expect(result).toEqual(saved);
        expect(createAlternativeMock).toHaveBeenCalledWith(alternatives);
    });

    test("deve permitir cadastrar quatro alternativas juntas", async () => {
        const fourthAlternative = { id: 4, questionId: question.id, text: "Máscara", correct: false };
        const alternatives = [
            ...input,
            { questionId: question.id, text: "Jaleco", correct: false },
            { questionId: question.id, text: "Máscara", correct: false }
        ];
        const saved = [...savedAlternatives, thirdAlternative, fourthAlternative];
        createAlternativeMock.mockResolvedValue(saved);
        const result = await createAlternativeService(alternatives, teacher.id);
        expect(result).toEqual(saved);
        expect(createAlternativeMock).toHaveBeenCalledWith(alternatives);
    });

    test("deve permitir adicionar uma alternativa quando a questão já possui duas", async () => {
        const alternative = { questionId: question.id, text: "Jaleco", correct: false };
        countAlternativesMock.mockResolvedValue(2);
        listAlternativesByQuestionIdMock.mockResolvedValue(savedAlternatives);
        createAlternativeMock.mockResolvedValue([thirdAlternative]);
        const result = await createAlternativeService([alternative], teacher.id);
        expect(result).toEqual([thirdAlternative]);
        expect(createAlternativeMock).toHaveBeenCalledWith([alternative]);
    });

    test("deve rejeitar um array vazio", async () => {
        await expect(createAlternativeService([], teacher.id)).rejects.toThrow("Informe as alternativas da questão");
        expectNoWrites();
    });

    test("deve impedir que a questão fique com apenas uma alternativa", async () => {
        await expect(createAlternativeService([input[0]], teacher.id)).rejects.toThrow("no mínimo 2 alternativas");
        expectNoWrites();
    });

    test("deve impedir que o total ultrapasse quatro alternativas", async () => {
        countAlternativesMock.mockResolvedValue(4);
        await expect(createAlternativeService([input[1]], teacher.id)).rejects.toThrow("no máximo 4 alternativas");
        expectNoWrites();
    });

    test("deve rejeitar alternativas de questões diferentes", async () => {
        const alternatives = [input[0], { ...input[1], questionId: 99 }];
        await expect(createAlternativeService(alternatives, teacher.id)).rejects.toThrow("mesma questão");
        expectNoWrites();
    });

    test("deve remover espaços das pontas do texto antes de cadastrar", async () => {
        const alternatives = [{ ...input[0], text: "  Óculos de proteção  " }, input[1]];
        await createAlternativeService(alternatives, teacher.id);
        expect(createAlternativeMock).toHaveBeenCalledWith(input);
    });

    test("deve rejeitar um texto vazio ou com somente espaços", async () => {
        await expect(createAlternativeService([{ ...input[0], text: "" }, input[1]], teacher.id)).rejects.toThrow("O texto da alternativa é obrigatório");
        await expect(createAlternativeService([{ ...input[0], text: "   " }, input[1]], teacher.id)).rejects.toThrow("O texto da alternativa é obrigatório");
        expectNoWrites();
    });

    test("deve rejeitar alternativas sem nenhuma correta", async () => {
        const alternatives = [{ ...input[0], correct: false }, input[1]];
        await expect(createAlternativeService(alternatives, teacher.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });

    test("deve rejeitar duas alternativas corretas no mesmo cadastro", async () => {
        const alternatives = [input[0], { ...input[1], correct: true }];
        await expect(createAlternativeService(alternatives, teacher.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });

    test("deve impedir outra correta quando já existe uma na questão", async () => {
        countAlternativesMock.mockResolvedValue(2);
        listAlternativesByQuestionIdMock.mockResolvedValue(savedAlternatives);
        await expect(createAlternativeService([input[0]], teacher.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });
});
