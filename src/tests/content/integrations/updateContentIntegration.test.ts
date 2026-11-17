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

    test("deve permitir que o professor atualize seu próprio conteúdo", async () => {
        const content = {
            title: "Orientações iniciais",
            description: "Leia as orientações antes de entrar no laboratório."
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

        const updatedContent = {
            title: "Orientações atualizadas",
            description: "Confira as novas orientações de segurança do laboratório."
        };
        const response = await app.inject({
            method: "PATCH",
            url: `/api/contents/${createdContent.id}`,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: updatedContent
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
            id: createdContent.id,
            teacherId: context.teacherId,
            title: updatedContent.title,
            description: updatedContent.description
        });

        const savedContent = await prisma.conteudo.findUniqueOrThrow({ where: { id: createdContent.id } });
        expect(savedContent).toMatchObject({
            id: createdContent.id,
            professor_id: context.teacherId,
            title: updatedContent.title,
            description: updatedContent.description
        });
    }, 30000);
});
