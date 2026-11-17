import { createAttemptMock, findApprovedAttemptMock, createAnswerMock, listAlternativesMock, listQuestionsMock, listQuizByIdMock, listUserByIdMock, createLogMock, teacher, student, quiz, questions, input, savedAttempt, expectNoWrites } from "./helpers/attemptServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { createAttemptService } from "../../../services/attemptService";
import { UserRole } from "../../../utils/user";

describe("Criação de tentativas", () => {
    test("deve salvar a tentativa, as respostas e o log quando o aluno acerta tudo", async () => {
        const result = await createAttemptService(input, student.id);
        expect(result).toEqual({ attempt: savedAttempt, totalQuestions: 3, correctCount: 3 });
        expect(createAttemptMock).toHaveBeenCalledWith({ quizId: quiz.id, studentId: student.id, score: 100, approved: true, correctCount: 3, totalQuestions: 3 }, expect.any(Object));
        expect(createAnswerMock).toHaveBeenCalledWith([
            { attemptId: savedAttempt.id, questionId: 1, alternativeId: 11 },
            { attemptId: savedAttempt.id, questionId: 2, alternativeId: 21 },
            { attemptId: savedAttempt.id, questionId: 3, alternativeId: 31 }
        ], createAttemptMock.mock.calls[0][1]);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ userId: student.id, action: "CADASTRO_TENTATIVA" }));
    });

    test("deve aprovar o aluno com exatamente 60 por cento", async () => {
        listQuestionsMock.mockResolvedValue([
            ...questions,
            { id: 4, quizId: quiz.id, statement: "Quarta questão" },
            { id: 5, quizId: quiz.id, statement: "Quinta questão" }
        ]);
        const submission = {
            quizId: quiz.id,
            answers: [
                ...input.answers,
                { questionId: 4, alternativeId: 42 },
                { questionId: 5, alternativeId: 52 }
            ]
        };
        const result = await createAttemptService(submission, student.id);
        expect(result.attempt.correctCount).toBe(3);
        expect(result.attempt.totalQuestions).toBe(5);
        expect(result.attempt.score).toBe(60);
        expect(result.attempt.approved).toBe(true);
        expect(result.correctCount).toBe(3);
    });

    test("deve reprovar o aluno que fica abaixo de 60 por cento", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [
                { questionId: 1, alternativeId: 11 },
                { questionId: 2, alternativeId: 22 },
                { questionId: 3, alternativeId: 32 }
            ]
        };
        const result = await createAttemptService(submission, student.id);
        expect(result.attempt.correctCount).toBe(1);
        expect(result.attempt.totalQuestions).toBe(3);
        expect(result.attempt.score).toBe(33.3);
        expect(result.attempt.approved).toBe(false);
        expect(result.correctCount).toBe(1);
    });

    test("deve arredondar a nota para uma casa decimal", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [
                { questionId: 1, alternativeId: 11 },
                { questionId: 2, alternativeId: 21 },
                { questionId: 3, alternativeId: 32 }
            ]
        };
        const result = await createAttemptService(submission, student.id);
        expect(result.attempt.score).toBe(66.7);
        expect(result.attempt.approved).toBe(true);
    });

    test("deve salvar nota zero quando o aluno erra todas as questões", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [
                { questionId: 1, alternativeId: 12 },
                { questionId: 2, alternativeId: 22 },
                { questionId: 3, alternativeId: 32 }
            ]
        };
        const result = await createAttemptService(submission, student.id);
        expect(result.attempt.correctCount).toBe(0);
        expect(result.attempt.totalQuestions).toBe(3);
        expect(result.attempt.score).toBe(0);
        expect(result.attempt.approved).toBe(false);
        expect(result.correctCount).toBe(0);
    });

    test("deve criar outra tentativa quando o aluno ainda não foi aprovado", async () => {
        createAttemptMock.mockResolvedValueOnce({ ...savedAttempt, score: 0, approved: false, correctCount: 0 });
        createAttemptMock.mockResolvedValueOnce({ ...savedAttempt, id: 2 });
        const incorrectInput = { ...input, answers: input.answers.map((answer) => ({ ...answer, alternativeId: answer.alternativeId + 1 })) };
        const first = await createAttemptService(incorrectInput, student.id);
        const second = await createAttemptService(input, student.id);
        expect(first.attempt.id).toBe(1);
        expect(second.attempt.id).toBe(2);
        expect(createAttemptMock).toHaveBeenCalledTimes(2);
        expect(createAnswerMock.mock.calls[1][0][0].attemptId).toBe(2);
    });

    test("deve impedir nova tentativa de aluno aprovado antes de corrigir as respostas", async () => {
        findApprovedAttemptMock.mockResolvedValue(savedAttempt);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Você já foi aprovado neste quiz");
        expect(listQuestionsMock).not.toHaveBeenCalled();
        expectNoWrites();
    });

    test("deve aceitar respostas enviadas em outra ordem", async () => {
        const submission = { quizId: quiz.id, answers: [input.answers[2], input.answers[0], input.answers[1]] };
        const result = await createAttemptService(submission, student.id);
        expect(result.correctCount).toBe(3);
        expect(result.attempt.score).toBe(100);
    });

    test("deve aceitar um quiz com dez questões", async () => {
        const tenQuestions = [...questions];
        const answers = [...input.answers];

        for (let id = 4; id <= 10; id++) {
            tenQuestions.push({ id, quizId: quiz.id, statement: "Questão de teste" });
            answers.push({ questionId: id, alternativeId: id * 10 + 1 });
        }

        listQuestionsMock.mockResolvedValue(tenQuestions);
        const result = await createAttemptService({ quizId: quiz.id, answers }, student.id);

        expect(result.totalQuestions).toBe(10);
        expect(result.correctCount).toBe(10);
        expect(result.attempt.score).toBe(100);
        expect(createAnswerMock.mock.calls[0][0]).toHaveLength(10);
    });

    test("deve impedir o envio quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(createAttemptService(input, 999)).rejects.toThrow("Usuário não encontrado");
        expectNoWrites();
    });

    test("deve impedir o envio por professores", async () => {
        listUserByIdMock.mockResolvedValue(teacher);
        await expect(createAttemptService(input, teacher.id)).rejects.toThrow("Somente alunos podem enviar tentativas");
        expectNoWrites();
    });

    test("deve impedir o envio por administradores", async () => {
        listUserByIdMock.mockResolvedValue({ ...student, role: UserRole.ADMIN });
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Somente alunos podem enviar tentativas");
        expectNoWrites();
    });

    test("deve impedir o envio para um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });

    test("deve impedir o envio para um quiz sem questões", async () => {
        listQuestionsMock.mockResolvedValue([]);
        await expect(createAttemptService({ quizId: quiz.id, answers: [] }, student.id)).rejects.toThrow("entre 1 e 10 questões");
        expectNoWrites();
    });

    test("deve impedir o envio para um quiz com mais de dez questões", async () => {
        const elevenQuestions = [...questions];

        for (let id = 4; id <= 11; id++) {
            elevenQuestions.push({ id, quizId: quiz.id, statement: "Questão de teste" });
        }

        listQuestionsMock.mockResolvedValue(elevenQuestions);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("entre 1 e 10 questões");
        expectNoWrites();
    });

    test("deve impedir o envio quando faltam respostas", async () => {
        await expect(createAttemptService({ quizId: quiz.id, answers: [input.answers[0]] }, student.id)).rejects.toThrow("Responda todas as questões do quiz");
        expectNoWrites();
    });

    test("deve impedir o envio de respostas a mais", async () => {
        const submission = { quizId: quiz.id, answers: [...input.answers, input.answers[0]] };
        await expect(createAttemptService(submission, student.id)).rejects.toThrow("Responda todas as questões do quiz");
        expectNoWrites();
    });

    test("deve impedir respostas repetidas para a mesma questão", async () => {
        const submission = { quizId: quiz.id, answers: [input.answers[0], input.answers[0], input.answers[2]] };
        await expect(createAttemptService(submission, student.id)).rejects.toThrow("exatamente uma resposta para cada questão");
        expectNoWrites();
    });

    test("deve impedir uma resposta para uma questão de outro quiz", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [{ questionId: 99, alternativeId: 991 }, input.answers[1], input.answers[2]]
        };
        await expect(createAttemptService(submission, student.id)).rejects.toThrow("exatamente uma resposta para cada questão");
        expectNoWrites();
    });

    test("deve impedir uma alternativa que pertence a outra questão", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [{ questionId: 1, alternativeId: 21 }, input.answers[1], input.answers[2]]
        };
        await expect(createAttemptService(submission, student.id)).rejects.toThrow("A alternativa selecionada não pertence à questão");
        expectNoWrites();
    });

    test("deve impedir questões com menos de duas alternativas", async () => {
        listAlternativesMock.mockResolvedValue([{ id: 11, questionId: 1, text: "Correta", correct: true }]);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("entre 2 e 4 alternativas");
        expectNoWrites();
    });

    test("deve impedir questões com mais de quatro alternativas", async () => {
        listAlternativesMock.mockResolvedValue([
            { id: 11, questionId: 1, text: "A", correct: true },
            { id: 12, questionId: 1, text: "B", correct: false },
            { id: 13, questionId: 1, text: "C", correct: false },
            { id: 14, questionId: 1, text: "D", correct: false },
            { id: 15, questionId: 1, text: "E", correct: false }
        ]);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("entre 2 e 4 alternativas");
        expectNoWrites();
    });

    test("deve impedir questões sem alternativa correta", async () => {
        listAlternativesMock.mockResolvedValue([
            { id: 11, questionId: 1, text: "A", correct: false },
            { id: 12, questionId: 1, text: "B", correct: false }
        ]);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });

    test("deve impedir questões com duas alternativas corretas", async () => {
        listAlternativesMock.mockResolvedValue([
            { id: 11, questionId: 1, text: "A", correct: true },
            { id: 12, questionId: 1, text: "B", correct: true }
        ]);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });

    test("não deve salvar respostas nem registrar sucesso se a criação da tentativa falhar", async () => {
        createAttemptMock.mockRejectedValue(new Error("Falha ao salvar tentativa"));
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Falha ao salvar tentativa");
        expect(createAnswerMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve registrar sucesso se a criação das respostas falhar", async () => {
        createAnswerMock.mockRejectedValue(new Error("Falha ao salvar respostas"));
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Falha ao salvar respostas");
        expect(createLogMock).not.toHaveBeenCalled();
    });
});
