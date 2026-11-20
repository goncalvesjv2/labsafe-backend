import { UserRole } from "../utils/user";

export interface ICreateUser {
    name: string;
    email: string;
    role: UserRole;
}

export interface IUser extends ICreateUser {
    id: number;
    ativo: boolean;
}

export interface IUserResponse {
    createdAt?: Date | null;
    hasPassword?: boolean;
    id: number;
    name: string;
    email: string;
    role: UserRole;
    ativo: boolean;
}
