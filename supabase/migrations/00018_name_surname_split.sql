-- ============================================================
-- 00018: Split person names into first_name / surname
-- Allows separate filtering and reporting on name components.
-- The submission_persons table previously relied on freetext
-- `description` for identity; explicit columns enable structured
-- queries without touching the identity vault.
-- ============================================================

alter table editorial.submission_persons
  add column first_name text,
  add column surname text;

comment on column editorial.submission_persons.first_name is 'Given / first name(s) of the person';
comment on column editorial.submission_persons.surname is 'Family name / surname of the person';

create index idx_submission_persons_surname
  on editorial.submission_persons(surname);
