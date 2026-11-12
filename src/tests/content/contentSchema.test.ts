import { describe, test, expect } from "@jest/globals";
import { contentSchema, updateSchema } from "../../schemas/contentSchema";

describe("Validação de criação de conteúdo", () => {
    const content = {
        title: "Segurança no laboratório",
        description: "Utilize os equipamentos de proteção."
    };

    test("deve aceitar um conteúdo válido", () => {
        const result = contentSchema.parse(content);
        expect(result).toEqual(content);
    });

    test("deve remover os espaços do início e do fim dos campos", () => {
        const result = contentSchema.parse({
            title: "  Segurança no laboratório  ",
            description: "  Utilize os equipamentos de proteção.  "
        });
        expect(result).toEqual(content);
    });

    test("deve aceitar título e descrição com um caractere", () => {
        const result = contentSchema.safeParse({ title: "A", description: "B" });
        expect(result.success).toBe(true);
    });

    test("deve aceitar um título com exatamente 150 caracteres", () => {
        const result = contentSchema.safeParse({ ...content, title: "a".repeat(150) });
        expect(result.success).toBe(true);
    });

    test("deve retornar erro para um título com mais de 150 caracteres", () => {
        const result = contentSchema.safeParse({ ...content, title: "a".repeat(151) });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["title"]);
        expect(result.error?.issues[0].message).toBe("O título deve ter no máximo 150 caracteres");
    });

    test("deve contar o tamanho do título depois de remover os espaços externos", () => {
        const title = "a".repeat(150);
        const result = contentSchema.parse({ ...content, title: `  ${title}  ` });
        expect(result.title).toBe(title);
    });

    test("deve retornar erro para um título vazio", () => {
        const result = contentSchema.safeParse({ ...content, title: "" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("O título é obrigatório");
    });

    test("deve retornar erro para um título formado somente por espaços", () => {
        const result = contentSchema.safeParse({ ...content, title: "   " });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("O título é obrigatório");
    });

    test("deve retornar erro quando o título não foi enviado", () => {
        const result = contentSchema.safeParse({ description: content.description });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["title"]);
    });

    test("deve retornar erro quando o título é um número", () => {
        const result = contentSchema.safeParse({ ...content, title: 123 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["title"]);
    });

    test("deve retornar erro quando o título é null", () => {
        const result = contentSchema.safeParse({ ...content, title: null });
        expect(result.success).toBe(false);
    });

    test("deve retornar erro para uma descrição vazia", () => {
        const result = contentSchema.safeParse({ ...content, description: "" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("A descrição é obrigatória");
    });

    test("deve retornar erro para uma descrição formada somente por espaços", () => {
        const result = contentSchema.safeParse({ ...content, description: " \n\t " });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("A descrição é obrigatória");
    });

    test("deve retornar erro quando a descrição não foi enviada", () => {
        const result = contentSchema.safeParse({ title: content.title });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["description"]);
    });

    test("deve retornar erro quando a descrição é um número", () => {
        const result = contentSchema.safeParse({ ...content, description: 123 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["description"]);
    });

    test("deve retornar erro quando a descrição é null", () => {
        const result = contentSchema.safeParse({ ...content, description: null });
        expect(result.success).toBe(false);
    });

    test("deve aceitar uma descrição longa e manter o texto completo", () => {
        const description = "a".repeat(20000);
        const result = contentSchema.parse({ ...content, description });
        expect(result.description).toBe(description);
    });

    test("deve manter os espaços internos e os parágrafos da descrição", () => {
        const description = "Primeiro  parágrafo.\n\nSegundo parágrafo.";
        const result = contentSchema.parse({ ...content, description });
        expect(result.description).toBe(description);
    });

    test("deve remover os campos que não fazem parte do formulário", () => {
        const result = contentSchema.parse({
            ...content,
            id: 50,
            teacherId: 99,
            professor_id: 99
        });
        expect(result).toEqual(content);
    });

    test("deve retornar erro quando o formulário é null", () => {
        const result = contentSchema.safeParse(null);
        expect(result.success).toBe(false);
    });
});

describe("Validação de atualização de conteúdo", () => {
    test("deve aceitar a atualização do título e da descrição", () => {
        const content = { title: "Novo título", description: "Nova descrição" };
        const result = updateSchema.parse(content);
        expect(result).toEqual(content);
    });

    test("deve aceitar a atualização somente do título", () => {
        const result = updateSchema.parse({ title: "Novo título" });
        expect(result).toEqual({ title: "Novo título" });
    });

    test("deve aceitar a atualização somente da descrição", () => {
        const result = updateSchema.parse({ description: "Nova descrição" });
        expect(result).toEqual({ description: "Nova descrição" });
    });

    test("deve retornar erro quando nenhum campo foi enviado", () => {
        const result = updateSchema.safeParse({});
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Informe ao menos um campo para atualizar");
    });

    test("deve retornar erro quando os dois campos são undefined", () => {
        const result = updateSchema.safeParse({
            title: undefined,
            description: undefined
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("Informe ao menos um campo para atualizar");
    });

    test("deve retornar erro para um título vazio mesmo com uma descrição válida", () => {
        const result = updateSchema.safeParse({ title: "", description: "Novo texto" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("O título é obrigatório");
    });

    test("deve retornar erro para um título formado somente por espaços", () => {
        const result = updateSchema.safeParse({ title: "   " });
        expect(result.success).toBe(false);
    });

    test("deve retornar erro para uma descrição vazia mesmo com um título válido", () => {
        const result = updateSchema.safeParse({ title: "Novo título", description: "" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe("A descrição é obrigatória");
    });

    test("deve retornar erro para uma descrição formada somente por espaços", () => {
        const result = updateSchema.safeParse({ description: "   " });
        expect(result.success).toBe(false);
    });

    test("deve retornar erro quando o novo título é um número", () => {
        const result = updateSchema.safeParse({ title: 123 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["title"]);
    });

    test("deve retornar erro quando a nova descrição é um número", () => {
        const result = updateSchema.safeParse({ description: 123 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(["description"]);
    });

    test("deve retornar erro quando o novo título é null", () => {
        const result = updateSchema.safeParse({ title: null });
        expect(result.success).toBe(false);
    });

    test("deve retornar erro quando a nova descrição é null", () => {
        const result = updateSchema.safeParse({ description: null });
        expect(result.success).toBe(false);
    });

    test("deve aceitar um novo título com exatamente 150 caracteres", () => {
        const result = updateSchema.safeParse({ title: "a".repeat(150) });
        expect(result.success).toBe(true);
    });

    test("deve retornar erro para um novo título com mais de 150 caracteres", () => {
        const result = updateSchema.safeParse({ title: "a".repeat(151) });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe(
            "O título deve ter no máximo 150 caracteres"
        );
    });

    test("deve remover os espaços externos dos campos atualizados", () => {
        const result = updateSchema.parse({
            title: "  Novo título  ",
            description: "  Nova descrição  "
        });
        expect(result).toEqual({ title: "Novo título", description: "Nova descrição" });
    });

    test("deve aceitar uma nova descrição longa e manter o texto completo", () => {
        const description = "a".repeat(20000);
        const result = updateSchema.parse({ description });
        expect(result.description).toBe(description);
    });

    test("deve retornar erro quando foram enviados somente campos desconhecidos", () => {
        const result = updateSchema.safeParse({ teacherId: 99 });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe(
            "Informe ao menos um campo para atualizar"
        );
    });

    test("deve remover os campos extras e manter somente os campos do formulário", () => {
        const result = updateSchema.parse({
            title: "Novo título",
            id: 50,
            teacherId: 99,
            professor_id: 99
        });
        expect(result).toEqual({ title: "Novo título" });
    });
});