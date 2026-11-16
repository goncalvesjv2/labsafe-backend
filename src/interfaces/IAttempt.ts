export interface ICreateAttempt {
    quizId: number;
    studentId: number;
    score: number;
    approved: boolean;
    correctCount: number;
    totalQuestions: number;
}

export interface IAttempt extends Omit<ICreateAttempt, "correctCount" | "totalQuestions"> {
    id: number;
    createdAt: Date;
    correctCount: number | null;
    totalQuestions: number | null;
}

export interface IAttemptWithStudent extends IAttempt {
    studentName: string;
}

export interface ISubmitAttempt {
    quizId: number;
    answers: {
        questionId: number;
        alternativeId: number;
    }[];
}
