export interface ILog {
    id?: number;
    userId: number;
    action: string;
    description: string;
    createdAt?: Date;
}