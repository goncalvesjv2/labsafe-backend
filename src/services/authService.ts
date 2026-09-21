import bcrypt from 'bcrypt';
import { listUserByEmailRepository } from '../repositories/userRepository';

export async function loginService(email: string, password: string) {
    const isExistUser = await listUserByEmailRepository(email);

    if (!isExistUser) {
        throw new Error("O usuário não existe");
    }

    const passwordValidate = await bcrypt.compare(password, isExistUser.senha);

    if (passwordValidate) {
        return "A autenticação deu certo";
    } else {
        throw new Error("A autenticação falhou");
    }
}