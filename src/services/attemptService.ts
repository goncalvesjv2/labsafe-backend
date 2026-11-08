import { prisma } from "../database/prisma";
import type { ISubmitAttempt } from "../interfaces/IAttempt";
import { createAttemptRepository, listAttemptByIdRepository, listAttemptsByQuizIdRepository } from "../repositories/attemptRepository";
import { createAnswerRepository, listAnswersByAttemptIdRepository } from "../repositories/answerRepository";
import { listAlternativesByQuestionIdRepository } from "../repositories/alternativeRepository";
import { listQuestionsByQuizIdRepository } from "../repositories/questionRepository";
import { listQuizByIdRepository } from "../repositories/quizRepository";
import { listUserByIdRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import { createLogService } from "./logService";

export async function listAttemptByIdService(id: number, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem consultar tentativas");
    }

    const attempt = await listAttemptByIdRepository(id);

    if (!attempt) {
        throw new Error("Tentativa não encontrada");
    }

    const quiz = await listQuizByIdRepository(attempt.quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    if (quiz.teacherId !== teacherId) {
        throw new Error("Você pode somente consultar tentativas dos seus próprios quizzes");
    }

    const answers = await listAnswersByAttemptIdRepository(id);
    return { ...attempt, answers };
}

export async function listAttemptsByStudentAndQuizIdService(studentId: number, quizId: number, teacherId: number) {
    const attempts = await listAttemptsByQuizIdService(quizId, teacherId);
    const student = await listUserByIdRepository(studentId);

    if (!student) {
        throw new Error("Aluno não encontrado");
    }

    const studentAttempts = attempts.filter((attempt) => attempt.studentId === studentId);

    return {
        studentId,
        studentName: student.name,
        quizId,
        totalAttempts: studentAttempts.length,
        attempts: studentAttempts
    };
}

export async function listAttemptsByQuizIdService(quizId: number, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem consultar tentativas");
    }

    const quiz = await listQuizByIdRepository(quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    if (quiz.teacherId !== teacherId) {
        throw new Error("Você pode somente consultar tentativas dos seus próprios quizzes");
    }

    return listAttemptsByQuizIdRepository(quizId);
}

export async function createAttemptService(submission: ISubmitAttempt, studentId: number) {
    const student = await listUserByIdRepository(studentId);

    if (!student) {
        throw new Error("Usuário não encontrado");
    }

    if (student.role !== UserRole.ALUNO) {
        throw new Error("Somente alunos podem enviar tentativas");
    }

    const quiz = await listQuizByIdRepository(submission.quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    const questions = await listQuestionsByQuizIdRepository(quiz.id);

    if (questions.length === 0 || questions.length > 10) {
        throw new Error("O quiz deve ter entre 1 e 10 questões para ser respondido");
    }

    if (!Array.isArray(submission.answers) || submission.answers.length !== questions.length) {
        throw new Error("Responda todas as questões do quiz");
    }

    let correctCount = 0;

    for (const question of questions) {
        const answers = submission.answers.filter((answer) => answer.questionId === question.id);

        if (answers.length !== 1) {
            throw new Error("Envie exatamente uma resposta para cada questão do quiz");
        }

        const alternatives = await listAlternativesByQuestionIdRepository(question.id);

        if (alternatives.length < 2 || alternatives.length > 4) {
            throw new Error("Cada questão deve ter entre 2 e 4 alternativas");
        }

        const correctAlternatives = alternatives.filter((alternative) => alternative.correct === true);

        if (correctAlternatives.length !== 1) {
            throw new Error("Cada questão deve ter exatamente 1 alternativa correta");
        }

        const selectedAlternative = alternatives.find((alternative) => alternative.id === answers[0].alternativeId);

        if (!selectedAlternative) {
            throw new Error("A alternativa selecionada não pertence à questão");
        }

        if (selectedAlternative.correct) {
            correctCount++;
        }
    }

    const percentage = (correctCount / questions.length) * 100;
    const score = Number(percentage.toFixed(1));
    const approved = percentage >= 60;

    const attempt = await prisma.$transaction(async (transaction) => {
        const newAttempt = await createAttemptRepository({
            quizId: quiz.id,
            studentId,
            score,
            approved
        }, transaction);

        const answers = submission.answers.map((answer) => ({
            attemptId: newAttempt.id,
            questionId: answer.questionId,
            alternativeId: answer.alternativeId
        }));

        await createAnswerRepository(answers, transaction);
        return newAttempt;
    });

    await createLogService({
        userId: studentId,
        action: "CADASTRO_TENTATIVA",
        description: `O usuário com o e-mail ${student.email} enviou a tentativa de ID ${attempt.id} no quiz de ID ${quiz.id}`
    });

    return {
        attempt,
        totalQuestions: questions.length,
        correctCount
    };
}
