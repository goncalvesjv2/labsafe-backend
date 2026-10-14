import { user_role } from "../generated/prisma/enums";

export interface IUserFormat {
    id: number;
    name: string;
    email: string;
    senha: string;
    role: user_role;
    ativo: boolean;
}