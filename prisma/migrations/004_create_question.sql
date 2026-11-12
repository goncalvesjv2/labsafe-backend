CREATE TABLE questao (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quiz(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    statement TEXT NOT NULL
);

CREATE INDEX questao_quiz_id_idx ON questao(quiz_id);