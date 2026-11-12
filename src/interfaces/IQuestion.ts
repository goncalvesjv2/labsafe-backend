export interface ICreateQuestion {
    quizId: number;
    statement: string;
}

export interface IQuestion extends ICreateQuestion {
    id: number;
}
