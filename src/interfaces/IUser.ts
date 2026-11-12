import type { UserRole } from "../utils/user";

export interface ICreateUser {
    name: string;
    email: string;
    password: string;
    role: UserRole;
}

export interface IUser extends ICreateUser {
    id: number;
    ativo: boolean;
}

export interface IUserResponse {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    ativo: boolean;
}
