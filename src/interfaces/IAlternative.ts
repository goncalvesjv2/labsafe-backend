export interface ICreateAlternative {
    questionId: number;
    text: string;
    correct: boolean;
}

export interface IAlternative extends ICreateAlternative {
    id: number;
}