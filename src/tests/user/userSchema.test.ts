import { describe, test, expect } from "@jest/globals";
import { userSchema } from "../../schemas/userSchema";
import { UserRole } from "../../utils/user";

describe("Validação de usuário com Zod", () => {
    const user = {
        name: "João",
        email: "joao@example.com",
        password: "Senha123!",
        role: UserRole.ALUNO
    };

    test("deve aceitar um usuário válido", () => {
        const result = userSchema.safeParse(user);
        expect(result.success).toBe(true);
    });

    test("deve rejeitar um role inválido", () => {
        const result = userSchema.safeParse({...user, role: "Diretor"});
        expect(result.success).toBe(false);
    });

    test("deve rejeitar nome vazio", () => {
        const result = userSchema.safeParse({...user, name: ""});
        expect(result.success).toBe(false);
    });

    test("deve rejeitar e-mail inválido", () => {
        const result = userSchema.safeParse({...user, email: "email-invalido"});
        expect(result.success).toBe(false);
    });

    test("deve rejeitar senha curta", () => {
        const result = userSchema.safeParse({...user, password: "123"});
        expect(result.success).toBe(false);
    });
});