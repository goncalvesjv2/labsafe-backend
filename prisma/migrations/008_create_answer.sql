CREATE TABLE resposta (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES tentativa(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    question_id INTEGER NOT NULL REFERENCES questao(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    alternative_id INTEGER NOT NULL REFERENCES alternativa(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    UNIQUE (attempt_id, question_id)
);

CREATE INDEX resposta_question_id_idx ON resposta(question_id);
CREATE INDEX resposta_alternative_id_idx ON resposta(alternative_id);
