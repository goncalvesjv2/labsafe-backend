import { connect } from "../database/db";
import { ICreateUser } from "../interfaces/IUser";

export async function listUsersRepository() {
    const client = await connect();

    try {
        const sql = "SELECT * FROM usuario";
        const res = await client.query(sql);
        return res.rows;
    } catch (error) {
        console.error(error);
    } finally {
        client.release();
    }
}

export async function listUserByIdRepository(id: number) {
    const client = await connect();

    try {
        const sql = "SELECT * FROM usuario WHERE id=$1";
        const res = await client.query(sql, [id]);
        return res.rows[0];
    } catch (error) {
        console.error(error);
    } finally {
        client.release();
    }
}

export async function listUserByEmailRepository(email: string) {
    const client = await connect();
    
    try {        
        const sql = "SELECT * FROM usuario WHERE email=$1";
        const res = await client.query(sql, [email]);
        return res.rows[0];
    } catch (error) {
        console.error(error);
    } finally {
        client.release();
    }
}

export async function createUserRepository(user: ICreateUser, password: string) {
    const client = await connect();

    try {
        const sql = "INSERT INTO usuario (name, email, senha, role) VALUES ($1, $2, $3, $4) RETURNING *";
        const values = [user.name, user.email, password, user.role];
        const res = await client.query(sql, values);
        return res.rows[0];
    } catch (error) {
        console.error(error);
    } finally {
        client.release();
    }
}

export async function updateUserRepository(id: number, user: ICreateUser, password: string) {
    const client = await connect();

    try {
        const sql = "UPDATE usuario SET name=$1, email=$2, senha=$3, role=$4 WHERE id=$5 RETURNING *";
        const values = [user.name, user.email, password, user.role, id];
        const res = await client.query(sql, values);
        return res.rows[0];
    } catch (error) {
        console.error(error);
    } finally {
        client.release();
    }
}

export async function deleteUserRepository(id: number) {
    const client = await connect();

    try {
        const sql = "DELETE FROM usuario WHERE id=$1";
        const res = await client.query(sql, [id]);
        return res.rows;
    } catch (error) {
        console.error(error);
    } finally {
        client.release();
    }
}