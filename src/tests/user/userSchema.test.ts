import { describe, test, expect } from "@jest/globals";
import { userSchema, updateUserSchema } from "../../schemas/userSchema";
import { UserRole } from "../../utils/user";

describe("Validação de cadastro de usuário", () => {
    const user = {
        name: "João",
        email: "joao@example.com",
        role: UserRole.ALUNO
    };

    test("deve aceitar cadastro com nome, e-mail e cargo sem senha", () => {
        const result = userSchema.safeParse(user);
        expect(result.success).toBe(true);
    });

    test("deve rejeitar um cargo inválido", () => {
        const result = userSchema.safeParse({ ...user, role: "Diretor" });
        expect(result.success).toBe(false);
    });

    test("deve rejeitar nome vazio", () => {
        const result = userSchema.safeParse({ ...user, name: "" });
        expect(result.success).toBe(false);
    });

    test("deve rejeitar e-mail inválido", () => {
        const result = userSchema.safeParse({ ...user, email: "email-invalido" });
        expect(result.success).toBe(false);
    });

});

describe("Validação de atualização de usuário", () => {
    const user = {
        name: "Ana",
        email: "ana@example.com",
        role: UserRole.ALUNO
    };

    test("deve aceitar somente nome, e-mail e cargo", () => {
        const result = updateUserSchema.parse(user);
        expect(result).toEqual(user);
    });

    test("deve remover espaços do nome e normalizar o e-mail", () => {
        const result = updateUserSchema.parse({
            ...user,
            name: "  Ana  ",
            email: "  ANA@EXAMPLE.COM  "
        });

        expect(result.name).toBe("Ana");
        expect(result.email).toBe("ana@example.com");
    });

    test("deve continuar exigindo nome, e-mail e cargo", () => {
        expect(updateUserSchema.safeParse({ email: user.email, role: user.role }).success).toBe(false);
        expect(updateUserSchema.safeParse({ name: user.name, role: user.role }).success).toBe(false);
        expect(updateUserSchema.safeParse({ name: user.name, email: user.email }).success).toBe(false);
    });

    test("deve rejeitar senha e status na edição do usuário", () => {
        for (const extraField of [{ password: "NovaSenha123!" }, { senha: "novo-hash" }, { ativo: false }]) {
            const result = updateUserSchema.safeParse({ ...user, ...extraField });
            expect(result.success).toBe(false);
        }
    });
});
