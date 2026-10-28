import { ICreateContent } from "../interfaces/IContent";
import { createContentRepository, listContentByIdRepository, listContentsRepository, updateContentRepository, deleteContentRepository } from "../repositories/contentRepository";
import { listUserByIdRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import { createLogService } from "./logService";

export async function listContentsService() {
    const contents = await listContentsRepository();
    return contents;
}

export async function listContentByIdService(id: number) {
    const content = await listContentByIdRepository(id);
    
    if (!content) {
        throw new Error("Conteúdo não encontrado");
    }
    
    return content;
}

export async function createContentService(content: ICreateContent, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem criar conteúdos");
    }
    
    const createContent = await createContentRepository(content, teacherId);
    
    await createLogService({
        userId: teacherId,
        action: "CADASTRO_CONTEUDO",
        description: `O usuário com o e-mail ${teacher.email} criou um conteúdo de ID ${createContent.id}`
    });

    return createContent;
}

export async function updateContentService(id: number, content: Partial<ICreateContent>, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem atualizar conteúdos");
    }

    const isExistContent = await listContentByIdRepository(id);

    if (!isExistContent) {
        throw new Error("Conteúdo não encontrado");
    }

    if (isExistContent.teacherId !== teacherId) {
        throw new Error("Você pode somente atualizar seus próprios conteúdos");
    }

    if (content.title === undefined && content.description === undefined) {
        throw new Error("Informe ao menos um campo para atualizar");
    }

    const updateContent = await updateContentRepository(id, content, teacherId);

    await createLogService({
        userId: teacherId,
        action: "ALTERACAO_CONTEUDO",
        description: `O usuário com o e-mail ${teacher.email} atualizou o conteúdo de ID ${id}`
    });

    return updateContent;
}

export async function deleteContentService(id: number, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem excluir conteúdos");
    }

    const isExistContent = await listContentByIdService(id);

    if (isExistContent.teacherId !== teacherId) {
        throw new Error("Você só pode excluir seus próprios conteúdos");
    }

    await deleteContentRepository(id, teacherId);

    await createLogService({
        userId: teacherId,
        action: "EXCLUSAO_CONTEUDO",
        description: `O usuário com o e-mail ${teacher.email} excluiu o conteúdo de ID ${id}`
    });
}