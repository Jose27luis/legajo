CREATE TYPE "TipoPersonal" AS ENUM ('ADMINISTRATIVO', 'ASISTENCIAL');

CREATE TYPE "AplicaA" AS ENUM ('ACTIVO', 'CESADO', 'TODOS');

CREATE TABLE "regimen" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "es_laboral" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "regimen_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_regimen_codigo" CHECK ("codigo" ~ '^[A-Z0-9_]{2,20}$'),
    CONSTRAINT "ck_regimen_nombre" CHECK (length(trim("nombre")) > 0)
);

CREATE TABLE "area" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(140) NOT NULL,
    "padre_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_area_nombre" CHECK (length(trim("nombre")) > 0),
    CONSTRAINT "ck_area_padre" CHECK ("padre_id" IS NULL OR "padre_id" <> "id")
);

CREATE TABLE "cargo" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_cargo_nombre" CHECK (length(trim("nombre")) > 0)
);

CREATE TABLE "seccion" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "carpeta" VARCHAR(80) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "campos" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "seccion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_seccion_numero" CHECK ("numero" BETWEEN 1 AND 13),
    CONSTRAINT "ck_seccion_campos" CHECK (jsonb_typeof("campos") = 'array')
);

CREATE TABLE "tipo_documento" (
    "id" SERIAL NOT NULL,
    "seccion_id" INTEGER NOT NULL,
    "codigo" CHAR(4) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "restringido" BOOLEAN NOT NULL DEFAULT false,
    "requiere_numero" BOOLEAN NOT NULL DEFAULT false,
    "tiene_vencimiento" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tipo_documento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_tipo_documento_codigo" CHECK ("codigo" ~ '^[0-9]{4}$'),
    CONSTRAINT "ck_tipo_documento_nombre" CHECK (length(trim("nombre")) > 0),
    CONSTRAINT "ck_tipo_documento_orden" CHECK ("orden" >= 0)
);

CREATE TABLE "requisito" (
    "id" SERIAL NOT NULL,
    "tipo_documento_id" INTEGER NOT NULL,
    "regimen_id" INTEGER,
    "tipo_personal" "TipoPersonal",
    "aplica_a" "AplicaA" NOT NULL DEFAULT 'TODOS',

    CONSTRAINT "requisito_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "regimen_codigo_key" ON "regimen"("codigo");

CREATE UNIQUE INDEX "ux_area_nombre_padre" ON "area"(lower("nombre"), "padre_id") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "cargo_nombre_key" ON "cargo"("nombre");

CREATE UNIQUE INDEX "ux_cargo_nombre_minusculas" ON "cargo"(lower("nombre"));

CREATE UNIQUE INDEX "seccion_numero_key" ON "seccion"("numero");

CREATE UNIQUE INDEX "tipo_documento_codigo_key" ON "tipo_documento"("codigo");

CREATE INDEX "ix_tipo_documento_seccion" ON "tipo_documento"("seccion_id", "orden");

CREATE UNIQUE INDEX "ux_requisito" ON "requisito"("tipo_documento_id", "regimen_id", "tipo_personal", "aplica_a") NULLS NOT DISTINCT;

ALTER TABLE "area" ADD CONSTRAINT "area_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tipo_documento" ADD CONSTRAINT "tipo_documento_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "requisito" ADD CONSTRAINT "requisito_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipo_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "requisito" ADD CONSTRAINT "requisito_regimen_id_fkey" FOREIGN KEY ("regimen_id") REFERENCES "regimen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
