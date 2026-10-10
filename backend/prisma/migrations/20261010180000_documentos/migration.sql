CREATE TYPE "NivelAcceso" AS ENUM ('NORMAL', 'RESTRINGIDO', 'MUY_RESTRINGIDO');

CREATE TYPE "EstadoDocumento" AS ENUM ('PROCESANDO', 'DISPONIBLE', 'ERROR', 'ANULADO');

CREATE TABLE "documento" (
    "id" UUID NOT NULL,
    "trabajador_id" UUID NOT NULL,
    "tipo_documento_id" INTEGER NOT NULL,
    "numero" VARCHAR(60),
    "fecha_emision" DATE,
    "fecha_vencimiento" DATE,
    "emisor" VARCHAR(160),
    "observaciones" VARCHAR(500),
    "ubicacion_fisica" VARCHAR(120),
    "datos" JSONB NOT NULL DEFAULT '{}',
    "nivel_acceso" "NivelAcceso" NOT NULL DEFAULT 'NORMAL',
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'PROCESANDO',
    "detalle_error" VARCHAR(300),
    "motivo_anulacion" VARCHAR(500),
    "subida_pendiente" VARCHAR(64),
    "archivo_actual_id" UUID,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_por" UUID,
    "modificado_en" TIMESTAMPTZ(3),
    "motivo_modificacion" VARCHAR(500),
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_documento_datos" CHECK (jsonb_typeof("datos") = 'object'),
    CONSTRAINT "ck_documento_anulado" CHECK (("estado" = 'ANULADO') = ("motivo_anulacion" IS NOT NULL)),
    CONSTRAINT "ck_documento_error" CHECK ("estado" <> 'ERROR' OR "detalle_error" IS NOT NULL),
    CONSTRAINT "ck_documento_disponible" CHECK ("estado" <> 'DISPONIBLE' OR "archivo_actual_id" IS NOT NULL),
    CONSTRAINT "ck_documento_vencimiento" CHECK (
        "fecha_vencimiento" IS NULL OR "fecha_emision" IS NULL OR "fecha_vencimiento" >= "fecha_emision"
    ),
    CONSTRAINT "ck_documento_modificacion" CHECK (("modificado_en" IS NULL) = ("modificado_por" IS NULL))
);

CREATE TABLE "documento_archivo" (
    "id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "ruta" VARCHAR(200) NOT NULL,
    "nombre_original" VARCHAR(200) NOT NULL,
    "tamano_original" BIGINT NOT NULL,
    "tamano_final" BIGINT NOT NULL,
    "hash_original" CHAR(64) NOT NULL,
    "hash_final" CHAR(64) NOT NULL,
    "paginas" INTEGER NOT NULL,
    "optimizado" BOOLEAN NOT NULL,
    "subido_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_archivo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_documento_archivo_version" CHECK ("version" >= 1),
    CONSTRAINT "ck_documento_archivo_paginas" CHECK ("paginas" >= 1),
    CONSTRAINT "ck_documento_archivo_tamanos" CHECK ("tamano_original" > 0 AND "tamano_final" > 0),
    CONSTRAINT "ck_documento_archivo_hashes" CHECK ("hash_original" ~ '^[0-9a-f]{64}$' AND "hash_final" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "documento_archivo_actual_id_key" ON "documento"("archivo_actual_id");

CREATE INDEX "ix_documento_legajo" ON "documento"("trabajador_id", "tipo_documento_id", "fecha_emision");

CREATE INDEX "ix_documento_estado" ON "documento"("estado");

CREATE INDEX "ix_archivo_hash_original" ON "documento_archivo"("hash_original");

CREATE UNIQUE INDEX "ux_documento_archivo_version" ON "documento_archivo"("documento_id", "version");

ALTER TABLE "documento" ADD CONSTRAINT "documento_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documento" ADD CONSTRAINT "documento_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipo_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documento" ADD CONSTRAINT "documento_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documento" ADD CONSTRAINT "documento_modificado_por_fkey" FOREIGN KEY ("modificado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documento" ADD CONSTRAINT "documento_archivo_actual_id_fkey" FOREIGN KEY ("archivo_actual_id") REFERENCES "documento_archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documento_archivo" ADD CONSTRAINT "documento_archivo_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documento_archivo" ADD CONSTRAINT "documento_archivo_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "documento_archivo_inmutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Las versiones de archivo no se modifican: se agrega una nueva';
END;
$$;

CREATE TRIGGER "tg_documento_archivo_inmutable"
BEFORE UPDATE OR DELETE ON "documento_archivo"
FOR EACH ROW EXECUTE FUNCTION "documento_archivo_inmutable"();
