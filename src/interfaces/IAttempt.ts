export interface ICreateAttempt {
    quizId: number;
    studentId: number;
    score: number;
    approved: boolean;
}

export interface IAttempt extends ICreateAttempt {
    id: number;
    createdAt: Date;
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
