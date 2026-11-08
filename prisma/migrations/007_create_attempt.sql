CREATE TABLE tentativa (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quiz(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    student_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    score NUMERIC(4,1) NOT NULL CHECK (score BETWEEN 0 AND 100),
    approved BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX tentativa_quiz_id_idx ON tentativa(quiz_id);
CREATE INDEX tentativa_student_id_idx ON tentativa(student_id);
