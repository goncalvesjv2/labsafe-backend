import { user_role } from "../generated/prisma/enums";

export interface IToken {
    id: number;
    name: string;
    role: user_role;
}