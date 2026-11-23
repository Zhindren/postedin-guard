-- Restricciones de dominio que Prisma no expresa en el esquema, y la vista del plazo de
-- remediación (dato derivado: se calcula desde la severidad, no se almacena).

ALTER TABLE "severidad"
  ADD CONSTRAINT "severidad_nivel_check" CHECK ("nivel" BETWEEN 1 AND 4),
  ADD CONSTRAINT "severidad_plazo_check" CHECK ("plazo_dias" > 0);

ALTER TABLE "politica_seguridad"
  ADD CONSTRAINT "politica_cobertura_check" CHECK ("cobertura_minima" IS NULL OR "cobertura_minima" BETWEEN 0 AND 100);

ALTER TABLE "escaneo"
  ADD CONSTRAINT "escaneo_cobertura_check" CHECK ("cobertura_pruebas" IS NULL OR "cobertura_pruebas" BETWEEN 0 AND 100),
  ADD CONSTRAINT "escaneo_pruebas_check" CHECK ("pruebas_fallidas" >= 0),
  ADD CONSTRAINT "escaneo_total_check" CHECK ("total_hallazgos" >= 0),
  ADD CONSTRAINT "escaneo_sha_check" CHECK ("commit_sha" ~ '^[0-9a-f]{40}$');

ALTER TABLE "hallazgo"
  ADD CONSTRAINT "hallazgo_linea_check" CHECK ("linea" IS NULL OR "linea" > 0),
  ADD CONSTRAINT "hallazgo_huella_check" CHECK ("huella" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "hallazgo_cierre_check" CHECK ("fecha_cierre" IS NULL OR "fecha_cierre" >= "fecha_deteccion");

ALTER TABLE "usuario"
  ADD CONSTRAINT "usuario_email_check" CHECK ("email" = lower("email") AND "email" LIKE '%_@_%');

ALTER TABLE "repositorio"
  ADD CONSTRAINT "repositorio_url_check" CHECK ("url_github" LIKE 'https://github.com/%');

CREATE VIEW "v_hallazgo_plazo" AS
SELECT h."id_hallazgo",
       e."id_repositorio",
       s."nombre" AS "severidad",
       h."estado",
       h."fecha_deteccion",
       h."fecha_deteccion" + (s."plazo_dias" * INTERVAL '1 day') AS "fecha_limite",
       (h."estado" IN ('ABIERTO', 'EN_PROGRESO')
        AND CURRENT_TIMESTAMP > h."fecha_deteccion" + (s."plazo_dias" * INTERVAL '1 day')) AS "vencido"
FROM "hallazgo" h
JOIN "escaneo" e   ON e."id_escaneo" = h."id_escaneo"
JOIN "severidad" s ON s."id_severidad" = h."id_severidad";
