export interface IContent {
    id: number;
    teacherId: number;
    title: string;
    description: string;
}

export interface ICreateContent {
    title: string;
    description: string;
}