-- CreateEnum
CREATE TYPE "ResultadoGate" AS ENUM ('APROBADO', 'BLOQUEADO', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoHallazgo" AS ENUM ('ABIERTO', 'EN_PROGRESO', 'RESUELTO', 'FALSO_POSITIVO');

-- CreateTable
CREATE TABLE "rol" (
    "id_rol" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,
    "descripcion" VARCHAR(150),

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "severidad" (
    "id_severidad" SERIAL NOT NULL,
    "nombre" VARCHAR(20) NOT NULL,
    "nivel" SMALLINT NOT NULL,
    "plazo_dias" SMALLINT NOT NULL,

    CONSTRAINT "severidad_pkey" PRIMARY KEY ("id_severidad")
);

-- CreateTable
CREATE TABLE "categoria_hallazgo" (
    "id_categoria" SERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" VARCHAR(255),
    "referencia_owasp" VARCHAR(20),

    CONSTRAINT "categoria_hallazgo_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "herramienta" (
    "id_herramienta" SERIAL NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "tipo_analisis" VARCHAR(30) NOT NULL,
    "version" VARCHAR(20),

    CONSTRAINT "herramienta_pkey" PRIMARY KEY ("id_herramienta")
);

-- CreateTable
CREATE TABLE "item_checklist" (
    "id_item" SERIAL NOT NULL,
    "pregunta" VARCHAR(200) NOT NULL,
    "descripcion" VARCHAR(255),
    "orden" SMALLINT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_checklist_pkey" PRIMARY KEY ("id_item")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "apellido" VARCHAR(60) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "usuario_github" VARCHAR(40),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acceso" TIMESTAMP(3),
    "version_sesion" INTEGER NOT NULL DEFAULT 0,
    "reset_hash" CHAR(64),
    "reset_expira" TIMESTAMP(3),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "bitacora_auditoria" (
    "id_evento" BIGSERIAL NOT NULL,
    "id_usuario" INTEGER,
    "accion" VARCHAR(40) NOT NULL,
    "entidad" VARCHAR(40) NOT NULL,
    "id_entidad" INTEGER,
    "detalle" VARCHAR(255),
    "direccion_ip" VARCHAR(45),
    "fecha_evento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_auditoria_pkey" PRIMARY KEY ("id_evento")
);

-- CreateTable
CREATE TABLE "repositorio" (
    "id_repositorio" SERIAL NOT NULL,
    "id_responsable" INTEGER NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "url_github" VARCHAR(255) NOT NULL,
    "rama_principal" VARCHAR(60) NOT NULL DEFAULT 'main',
    "token_hash" CHAR(64),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositorio_pkey" PRIMARY KEY ("id_repositorio")
);

-- CreateTable
CREATE TABLE "politica_seguridad" (
    "id_politica" SERIAL NOT NULL,
    "id_severidad_bloqueo" INTEGER NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(255),
    "cobertura_minima" DECIMAL(5,2),
    "exige_checklist_ia" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "politica_seguridad_pkey" PRIMARY KEY ("id_politica")
);

-- CreateTable
CREATE TABLE "repositorio_politica" (
    "id_repositorio" INTEGER NOT NULL,
    "id_politica" INTEGER NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositorio_politica_pkey" PRIMARY KEY ("id_repositorio","id_politica")
);

-- CreateTable
CREATE TABLE "escaneo" (
    "id_escaneo" SERIAL NOT NULL,
    "id_repositorio" INTEGER NOT NULL,
    "numero_pr" INTEGER,
    "rama_origen" VARCHAR(120) NOT NULL,
    "commit_sha" CHAR(40) NOT NULL,
    "autor_github" VARCHAR(40) NOT NULL,
    "resultado_analisis" "ResultadoGate" NOT NULL,
    "resultado" "ResultadoGate" NOT NULL,
    "motivo" VARCHAR(500),
    "total_hallazgos" INTEGER NOT NULL DEFAULT 0,
    "cobertura_pruebas" DECIMAL(5,2),
    "pruebas_fallidas" INTEGER NOT NULL DEFAULT 0,
    "url_ejecucion" VARCHAR(255),
    "fecha_ejecucion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escaneo_pkey" PRIMARY KEY ("id_escaneo")
);

-- CreateTable
CREATE TABLE "hallazgo" (
    "id_hallazgo" SERIAL NOT NULL,
    "id_escaneo" INTEGER NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "id_severidad" INTEGER NOT NULL,
    "id_herramienta" INTEGER NOT NULL,
    "id_asignado" INTEGER,
    "titulo" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "ruta_archivo" VARCHAR(255),
    "linea" INTEGER,
    "regla" VARCHAR(120),
    "huella" CHAR(64) NOT NULL,
    "estado" "EstadoHallazgo" NOT NULL DEFAULT 'ABIERTO',
    "fecha_deteccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),

    CONSTRAINT "hallazgo_pkey" PRIMARY KEY ("id_hallazgo")
);

-- CreateTable
CREATE TABLE "comentario_hallazgo" (
    "id_comentario" SERIAL NOT NULL,
    "id_hallazgo" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha_comentario" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentario_hallazgo_pkey" PRIMARY KEY ("id_comentario")
);

-- CreateTable
CREATE TABLE "respuesta_checklist" (
    "id_escaneo" INTEGER NOT NULL,
    "id_item" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "cumple" BOOLEAN NOT NULL,
    "observacion" VARCHAR(255),
    "fecha_respuesta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuesta_checklist_pkey" PRIMARY KEY ("id_escaneo","id_item")
);

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "severidad_nombre_key" ON "severidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "severidad_nivel_key" ON "severidad"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_hallazgo_nombre_key" ON "categoria_hallazgo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "herramienta_nombre_key" ON "herramienta"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_usuario_github_key" ON "usuario"("usuario_github");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_reset_hash_key" ON "usuario"("reset_hash");

-- CreateIndex
CREATE INDEX "idx_bitacora_usuario" ON "bitacora_auditoria"("id_usuario", "fecha_evento" DESC);

-- CreateIndex
CREATE INDEX "idx_bitacora_accion" ON "bitacora_auditoria"("accion", "fecha_evento" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "repositorio_url_github_key" ON "repositorio"("url_github");

-- CreateIndex
CREATE UNIQUE INDEX "repositorio_token_hash_key" ON "repositorio"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "politica_seguridad_nombre_key" ON "politica_seguridad"("nombre");

-- CreateIndex
CREATE INDEX "idx_escaneo_repo_fecha" ON "escaneo"("id_repositorio", "fecha_ejecucion" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "escaneo_id_repositorio_commit_sha_key" ON "escaneo"("id_repositorio", "commit_sha");

-- CreateIndex
CREATE INDEX "idx_hallazgo_estado_sev" ON "hallazgo"("estado", "id_severidad");

-- CreateIndex
CREATE INDEX "idx_hallazgo_asignado" ON "hallazgo"("id_asignado");

-- CreateIndex
CREATE INDEX "idx_hallazgo_huella" ON "hallazgo"("huella");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositorio" ADD CONSTRAINT "repositorio_id_responsable_fkey" FOREIGN KEY ("id_responsable") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politica_seguridad" ADD CONSTRAINT "politica_seguridad_id_severidad_bloqueo_fkey" FOREIGN KEY ("id_severidad_bloqueo") REFERENCES "severidad"("id_severidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositorio_politica" ADD CONSTRAINT "repositorio_politica_id_repositorio_fkey" FOREIGN KEY ("id_repositorio") REFERENCES "repositorio"("id_repositorio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositorio_politica" ADD CONSTRAINT "repositorio_politica_id_politica_fkey" FOREIGN KEY ("id_politica") REFERENCES "politica_seguridad"("id_politica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escaneo" ADD CONSTRAINT "escaneo_id_repositorio_fkey" FOREIGN KEY ("id_repositorio") REFERENCES "repositorio"("id_repositorio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgo" ADD CONSTRAINT "hallazgo_id_escaneo_fkey" FOREIGN KEY ("id_escaneo") REFERENCES "escaneo"("id_escaneo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgo" ADD CONSTRAINT "hallazgo_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria_hallazgo"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgo" ADD CONSTRAINT "hallazgo_id_severidad_fkey" FOREIGN KEY ("id_severidad") REFERENCES "severidad"("id_severidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgo" ADD CONSTRAINT "hallazgo_id_herramienta_fkey" FOREIGN KEY ("id_herramienta") REFERENCES "herramienta"("id_herramienta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hallazgo" ADD CONSTRAINT "hallazgo_id_asignado_fkey" FOREIGN KEY ("id_asignado") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario_hallazgo" ADD CONSTRAINT "comentario_hallazgo_id_hallazgo_fkey" FOREIGN KEY ("id_hallazgo") REFERENCES "hallazgo"("id_hallazgo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario_hallazgo" ADD CONSTRAINT "comentario_hallazgo_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_checklist" ADD CONSTRAINT "respuesta_checklist_id_escaneo_fkey" FOREIGN KEY ("id_escaneo") REFERENCES "escaneo"("id_escaneo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_checklist" ADD CONSTRAINT "respuesta_checklist_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "item_checklist"("id_item") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_checklist" ADD CONSTRAINT "respuesta_checklist_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
