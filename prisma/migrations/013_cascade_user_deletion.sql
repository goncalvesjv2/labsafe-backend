BEGIN;

ALTER TABLE "logs" DROP CONSTRAINT "fk_logs_user";
ALTER TABLE "logs" ADD CONSTRAINT "fk_logs_user"
    FOREIGN KEY ("user_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "conteudo" DROP CONSTRAINT "conteudo_professor_id_fkey";
ALTER TABLE "conteudo" ADD CONSTRAINT "conteudo_professor_id_fkey"
    FOREIGN KEY ("professor_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "quiz" DROP CONSTRAINT "quiz_conteudo_id_fkey";
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_conteudo_id_fkey"
    FOREIGN KEY ("conteudo_id") REFERENCES "conteudo"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "quiz" DROP CONSTRAINT "quiz_professor_id_fkey";
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_professor_id_fkey"
    FOREIGN KEY ("professor_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "tentativa" DROP CONSTRAINT "tentativa_student_id_fkey";
ALTER TABLE "tentativa" ADD CONSTRAINT "tentativa_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "resposta" DROP CONSTRAINT "resposta_question_id_fkey";
ALTER TABLE "resposta" ADD CONSTRAINT "resposta_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questao"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "resposta" DROP CONSTRAINT "resposta_alternative_id_fkey";
ALTER TABLE "resposta" ADD CONSTRAINT "resposta_alternative_id_fkey"
    FOREIGN KEY ("alternative_id") REFERENCES "alternativa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT;
