ALTER TABLE tentativa
    ADD COLUMN correct_count INTEGER,
    ADD COLUMN total_questions INTEGER,
    ADD CONSTRAINT tentativa_question_counts_check CHECK (
        (correct_count IS NULL AND total_questions IS NULL)
        OR (
            correct_count IS NOT NULL
            AND total_questions IS NOT NULL
            AND total_questions BETWEEN 1 AND 10
            AND correct_count BETWEEN 0 AND total_questions
        )
    );
