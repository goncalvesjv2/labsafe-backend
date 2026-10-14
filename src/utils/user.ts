import { user_role } from "../generated/prisma/enums";
import { IUserFormat } from "../interfaces/IUserFormat";

export enum UserRole {
    ADMIN = "Admin",
    PROFESSOR = "Professor(a)",
    ALUNO = "Aluno(a)"
}

export function mapUserRole(role: user_role): UserRole {
    switch (role) {
        case user_role.Admin:
            return UserRole.ADMIN;
        case user_role.Aluno_a_:
            return UserRole.ALUNO;
        case user_role.Professor_a_:
            return UserRole.PROFESSOR;
        default:
            throw new Error("Perfil de usuário inválido");
    }
}

export function formatUser(user: IUserFormat) {
    const {senha, ...userWithoutPassword} = user;

    return {...userWithoutPassword, role: mapUserRole(user.role)};
}