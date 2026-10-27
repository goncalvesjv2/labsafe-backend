import { prisma } from "../database/prisma";
import { ICreateContent } from "../interfaces/IContent";

export async function listContentsRepository() {
    const contents = await prisma.conteudo.findMany();
    return contents.map((content) => ({
        id: content.id,
        teacherId: content.professor_id,
        title: content.title,
        description: content.description
    }));
}

export async function listContentByIdRepository(id: number) {
    const content = await prisma.conteudo.findUnique({
        where: { id },
    });

    if (!content) {
        return null;
    }

    return {
        id: content.id,
        teacherId: content.professor_id,
        title: content.title,
        description: content.description
    };
}

export async function createContentRepository(content: ICreateContent, teacherId: number) {
    const newContent = await prisma.conteudo.create({
        data: {
            title: content.title,
            description: content.description,
            professor_id: teacherId
        }
    });

    return {
        id: newContent.id,
        teacherId: newContent.professor_id,
        title: newContent.title,
        description: newContent.description
    };
}

export async function updateContentRepository(id: number, content: Partial<ICreateContent>, teacherId: number) {
    const updateContent = await prisma.conteudo.update({
        where: {
            id, 
            professor_id: teacherId
        },
        data: {
            title: content.title,
            description: content.description
        }
    });

    return {
        id: updateContent.id,
        teacherId: updateContent.professor_id,
        title: updateContent.title,
        description: updateContent.description
    }
}

export async function deleteContentRepository(id: number, teacherId: number) {
    await prisma.conteudo.delete({
        where: {
            id,
            professor_id: teacherId
        }
    });
}