export interface ICreateContent {
    title: string;
    description: string;
}

export interface IContent extends ICreateContent {
    id: number;
    teacherId: number;
}
