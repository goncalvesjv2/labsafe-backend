import { listAttemptByIdMock, listAttemptsByQuizIdMock, listAnswersMock, listQuizByIdMock, listUserByIdMock, teacher, student, quiz, savedAttempt, listedAttempt, savedAnswers } from "./helpers/attemptServiceSetup";
import { beforeEach, describe, expect, test } from "@jest/globals";
import { listAttemptByIdService, listAttemptsByQuizIdService, listAttemptsByStudentAndQuizIdService } from "../../../services/attemptService";
import { UserRole } from "../../../utils/user";

describe("Consultas de tentativas", () => {
    beforeEach(() => {
        listUserByIdMock.mockImplementation(async (id) => id === teacher.id ? teacher : student);
    });

    test("deve consultar uma tentativa com o nome do aluno e suas respostas", async () => {
        const result = await listAttemptByIdService(savedAttempt.id, teacher.id);
        expect(result).toEqual({ ...listedAttempt, answers: savedAnswers });
        expect(listAnswersMock).toHaveBeenCalledWith(savedAttempt.id);
    });

    test("deve listar as tentativas de um quiz do professor", async () => {
        const result = await listAttemptsByQuizIdService(quiz.id, teacher.id);
        expect(result).toEqual([listedAttempt]);
        expect(listAttemptsByQuizIdMock).toHaveBeenCalledWith(quiz.id);
    });

    test("deve contar somente as tentativas do aluno no quiz selecionado", async () => {
        const secondAttempt = { ...listedAttempt, id: 2, score: 33.3, approved: false };
        const anotherStudentAttempt = { ...listedAttempt, id: 3, studentId: 30, studentName: "Outro aluno" };
        listAttemptsByQuizIdMock.mockResolvedValue([listedAttempt, secondAttempt, anotherStudentAttempt]);
        const result = await listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id);
        expect(result).toEqual({ studentId: student.id, studentName: student.name, quizId: quiz.id, totalAttempts: 2, attempts: [listedAttempt, secondAttempt] });
        expect(listAttemptsByQuizIdMock).toHaveBeenCalledWith(quiz.id);
    });

    test("deve retornar lista vazia e contagem zero quando o aluno não tem tentativas", async () => {
        listAttemptsByQuizIdMock.mockResolvedValue([{ ...listedAttempt, studentId: 30, studentName: "Outro aluno" }]);
        const result = await listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id);
        expect(result).toEqual({ studentId: student.id, studentName: student.name, quizId: quiz.id, totalAttempts: 0, attempts: [] });
    });

    test("deve permitir a consulta de um quiz sem tentativas", async () => {
        listAttemptsByQuizIdMock.mockResolvedValue([]);
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).resolves.toEqual([]);
    });

    test("deve impedir consultas quando o professor não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(listAttemptByIdService(1, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve impedir consultas por alunos", async () => {
        listUserByIdMock.mockResolvedValue(student);
        await expect(listAttemptByIdService(1, student.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        await expect(listAttemptsByQuizIdService(quiz.id, student.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, student.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve impedir consultas por administradores", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(listAttemptByIdService(1, teacher.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve impedir consultas de um quiz criado por outro professor", async () => {
        listQuizByIdMock.mockResolvedValue({ ...quiz, teacherId: 99 });
        await expect(listAttemptByIdService(1, teacher.id)).rejects.toThrow("seus próprios quizzes");
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).rejects.toThrow("seus próprios quizzes");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id)).rejects.toThrow("seus próprios quizzes");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve informar quando a tentativa não existe", async () => {
        listAttemptByIdMock.mockResolvedValue(null);
        await expect(listAttemptByIdService(999, teacher.id)).rejects.toThrow("Tentativa não encontrada");
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve informar quando o quiz não existe", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(listAttemptByIdService(1, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve informar quando o aluno consultado não existe", async () => {
        listUserByIdMock.mockResolvedValueOnce(teacher);
        listUserByIdMock.mockResolvedValueOnce(null);
        await expect(listAttemptsByStudentAndQuizIdService(999, quiz.id, teacher.id)).rejects.toThrow("Aluno não encontrado");
    });
});
