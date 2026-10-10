CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION "f_unaccent"(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE TYPE "TipoDocIdentidad" AS ENUM ('DNI', 'CE');

CREATE TYPE "EstadoTrabajador" AS ENUM ('ACTIVO', 'CESADO');

CREATE TYPE "Movimiento" AS ENUM ('SIN_MOVIMIENTO', 'ROTACION', 'DESTAQUE', 'ENCARGATURA', 'REASIGNACION');

CREATE TYPE "MotivoFin" AS ENUM ('RENUNCIA', 'JUBILACION', 'FALLECIMIENTO', 'FIN_CONTRATO', 'DESTITUCION', 'OTRA_CAUSA', 'RENOVACION', 'CAMBIO_REGIMEN', 'CAMBIO_CARGO_O_AREA');

CREATE TABLE "trabajador" (
    "id" UUID NOT NULL,
    "tipo_doc_identidad" "TipoDocIdentidad" NOT NULL DEFAULT 'DNI',
    "numero_doc" VARCHAR(12) NOT NULL,
    "apellido_paterno" VARCHAR(80) NOT NULL,
    "apellido_materno" VARCHAR(80),
    "nombres" VARCHAR(100) NOT NULL,
    "nombre_busqueda" TEXT GENERATED ALWAYS AS (
        lower("f_unaccent"("nombres" || ' ' || "apellido_paterno" || ' ' || coalesce("apellido_materno", '')))
    ) STORED,
    "fecha_nacimiento" DATE,
    "sexo" CHAR(1),
    "estado_civil" VARCHAR(20),
    "direccion" VARCHAR(200),
    "departamento" VARCHAR(60),
    "provincia" VARCHAR(60),
    "distrito" VARCHAR(60),
    "telefono" VARCHAR(20),
    "correo" VARCHAR(120),
    "fecha_ingreso" DATE NOT NULL,
    "estado" "EstadoTrabajador" NOT NULL DEFAULT 'ACTIVO',
    "movimiento_actual" "Movimiento" NOT NULL DEFAULT 'SIN_MOVIMIENTO',
    "movimiento_fecha" DATE,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trabajador_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_trabajador_doc" CHECK (
        ("tipo_doc_identidad" = 'DNI' AND "numero_doc" ~ '^[0-9]{8}$')
        OR ("tipo_doc_identidad" = 'CE' AND "numero_doc" ~ '^[A-Z0-9]{9,12}$')
    ),
    CONSTRAINT "ck_trabajador_nombres" CHECK (length(trim("nombres")) > 0 AND length(trim("apellido_paterno")) > 0),
    CONSTRAINT "ck_trabajador_sexo" CHECK ("sexo" IS NULL OR "sexo" IN ('F', 'M')),
    CONSTRAINT "ck_trabajador_movimiento" CHECK ("estado" = 'ACTIVO' OR "movimiento_actual" = 'SIN_MOVIMIENTO')
);

CREATE TABLE "vinculo" (
    "id" UUID NOT NULL,
    "trabajador_id" UUID NOT NULL,
    "regimen_id" INTEGER NOT NULL,
    "tipo_personal" "TipoPersonal" NOT NULL,
    "cargo_id" INTEGER NOT NULL,
    "area_id" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "motivo_fin" "MotivoFin",
    "referencia" VARCHAR(160),
    "actual" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_vinculo_fechas" CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_inicio"),
    CONSTRAINT "ck_vinculo_motivo" CHECK (("fecha_fin" IS NULL) = ("motivo_fin" IS NULL)),
    CONSTRAINT "ck_vinculo_vigente_actual" CHECK ("fecha_fin" IS NOT NULL OR "actual")
);

CREATE TABLE "familiar" (
    "id" UUID NOT NULL,
    "trabajador_id" UUID NOT NULL,
    "parentesco" VARCHAR(30) NOT NULL,
    "nombres_apellidos" VARCHAR(160) NOT NULL,
    "numero_doc" VARCHAR(12),
    "fecha_nacimiento" DATE,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "familiar_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_familiar_nombre" CHECK (length(trim("nombres_apellidos")) > 0)
);

CREATE INDEX "ix_trabajador_estado" ON "trabajador"("estado", "movimiento_actual");

CREATE UNIQUE INDEX "ux_trabajador_doc" ON "trabajador"("tipo_doc_identidad", "numero_doc");

CREATE INDEX "ix_trabajador_nombre_trgm" ON "trabajador" USING gin ("nombre_busqueda" gin_trgm_ops);

CREATE INDEX "ix_vinculo_trabajador" ON "vinculo"("trabajador_id", "fecha_inicio" DESC);

CREATE INDEX "ix_vinculo_area" ON "vinculo"("area_id", "actual");

CREATE UNIQUE INDEX "ux_vinculo_actual" ON "vinculo"("trabajador_id") WHERE "actual";

CREATE INDEX "ix_familiar_trabajador" ON "familiar"("trabajador_id");

ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_regimen_id_fkey" FOREIGN KEY ("regimen_id") REFERENCES "regimen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "familiar" ADD CONSTRAINT "familiar_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
