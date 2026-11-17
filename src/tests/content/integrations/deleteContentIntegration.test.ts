import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupContentIntegration } from "./helpers/setupContentIntegration";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

describe("Teste de integração de conteúdos", () => {
    const context = setupContentIntegration();

    test("deve permitir que o professor exclua seu próprio conteúdo", async () => {
        const content = {
            title: "Conteúdo para exclusão",
            description: "Este conteúdo será removido durante o teste."
        };

        const createResponse = await app.inject({
            method: "POST",
            url: "/api/contents",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: content
        });
        expect(createResponse.statusCode).toBe(201);
        const createdContent = createResponse.json();

        const response = await app.inject({
            method: "DELETE",
            url: `/api/contents/${createdContent.id}`,
            headers: { Authorization: `Bearer ${context.token}` }
        });
        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");

        const deletedContent = await prisma.conteudo.findUnique({ where: { id: createdContent.id } });
        expect(deletedContent).toBeNull();
    }, 30000);
});
