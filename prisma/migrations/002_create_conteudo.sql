CREATE TABLE conteudo (
    id SERIAL PRIMARY KEY,
    professor_id INTEGER NOT NULL REFERENCES usuario(id),
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL
);