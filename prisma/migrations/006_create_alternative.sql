CREATE TABLE alternativa (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questao(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    text TEXT NOT NULL,
    correct BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX alternativa_question_id_idx ON alternativa(question_id);