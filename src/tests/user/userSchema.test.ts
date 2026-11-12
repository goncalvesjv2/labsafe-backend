import { describe, test, expect } from "@jest/globals";
import { userSchema, updateUserSchema } from "../../schemas/userSchema";
import { UserRole } from "../../utils/user";

describe("Validação de cadastro de usuário", () => {
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

    test("deve rejeitar senha curta", () => {
        const result = userSchema.safeParse({ ...user, password: "123" });
        expect(result.success).toBe(false);
    });

    test("deve remover espaços externos e manter os espaços internos da senha", () => {
        const result = userSchema.parse({ ...user, password: "  Senha 123!  " });
        expect(result.password).toBe("Senha 123!");
    });

    test("deve aceitar uma senha com oito caracteres após o trim", () => {
        const result = userSchema.parse({ ...user, password: "  12345678  " });
        expect(result.password).toBe("12345678");
    });

    test("deve rejeitar senha que fica curta após remover os espaços", () => {
        const result = userSchema.safeParse({ ...user, password: "  1234567  " });
        expect(result.success).toBe(false);
    });

    test("deve rejeitar senha formada somente por espaços", () => {
        const result = userSchema.safeParse({ ...user, password: "          " });
        expect(result.success).toBe(false);
    });
});

describe("Validação de atualização de usuário", () => {
    const user = {
        name: "Ana",
        email: "ana@example.com",
        role: UserRole.ALUNO
    };

    test("deve permitir atualizar sem enviar senha", () => {
        const result = updateUserSchema.parse(user);
        expect(result).toEqual(user);
        expect(userSchema.safeParse(user).success).toBe(false);
    });

    test("deve remover espaços do nome e da nova senha", () => {
        const result = updateUserSchema.parse({
            ...user,
            name: "  Ana  ",
            password: "  NovaSenha123!  "
        });

        expect(result.name).toBe("Ana");
        expect(result.password).toBe("NovaSenha123!");
    });

    test("deve continuar exigindo nome, e-mail e cargo", () => {
        expect(updateUserSchema.safeParse({ email: user.email, role: user.role }).success).toBe(false);
        expect(updateUserSchema.safeParse({ name: user.name, role: user.role }).success).toBe(false);
        expect(updateUserSchema.safeParse({ name: user.name, email: user.email }).success).toBe(false);
    });

    test("deve rejeitar uma nova senha vazia", () => {
        const result = updateUserSchema.safeParse({ ...user, password: "" });
        expect(result.success).toBe(false);
    });
});
