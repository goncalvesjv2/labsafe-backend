export interface ICreateAnswer {
    attemptId: number;
    questionId: number;
    alternativeId: number;
}

export interface IAnswer extends ICreateAnswer {
    id: number;
}
