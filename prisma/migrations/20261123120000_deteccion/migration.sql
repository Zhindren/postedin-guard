-- Relación N:M entre escaneo y hallazgo: en qué análisis apareció cada hallazgo.
CREATE TABLE "deteccion" (
    "id_escaneo" INTEGER NOT NULL,
    "id_hallazgo" INTEGER NOT NULL,

    CONSTRAINT "deteccion_pkey" PRIMARY KEY ("id_escaneo","id_hallazgo")
);

CREATE INDEX "idx_deteccion_hallazgo" ON "deteccion"("id_hallazgo");

ALTER TABLE "deteccion" ADD CONSTRAINT "deteccion_id_escaneo_fkey" FOREIGN KEY ("id_escaneo") REFERENCES "escaneo"("id_escaneo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deteccion" ADD CONSTRAINT "deteccion_id_hallazgo_fkey" FOREIGN KEY ("id_hallazgo") REFERENCES "hallazgo"("id_hallazgo") ON DELETE CASCADE ON UPDATE CASCADE;

-- Los hallazgos existentes quedan registrados al menos en el escaneo en que se detectaron.
INSERT INTO "deteccion" ("id_escaneo", "id_hallazgo")
SELECT "id_escaneo", "id_hallazgo" FROM "hallazgo";
