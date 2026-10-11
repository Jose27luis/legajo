CREATE TYPE "EstadoLote" AS ENUM ('SUBIENDO', 'EN_BANDEJA', 'TERMINADO');

CREATE TYPE "EstadoItemLote" AS ENUM ('SUBIENDO', 'PENDIENTE', 'CLASIFICADO', 'DIVIDIDO', 'ERROR');

CREATE TABLE "lote_carga" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "estado" "EstadoLote" NOT NULL DEFAULT 'SUBIENDO',
    "total" INTEGER NOT NULL,
    "clasificados" INTEGER NOT NULL DEFAULT 0,
    "pendientes" INTEGER NOT NULL DEFAULT 0,
    "con_error" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminado_en" TIMESTAMPTZ(3),

    CONSTRAINT "lote_carga_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_lote_carga_total" CHECK ("total" BETWEEN 1 AND 500),
    CONSTRAINT "ck_lote_carga_contadores" CHECK ("clasificados" >= 0 AND "pendientes" >= 0 AND "con_error" >= 0 AND "clasificados" + "pendientes" + "con_error" <= "total"),
    CONSTRAINT "ck_lote_carga_terminado" CHECK (("estado" = 'TERMINADO') = ("terminado_en" IS NOT NULL))
);

CREATE TABLE "lote_item" (
    "id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "tamano" BIGINT NOT NULL,
    "subida_id" VARCHAR(64),
    "trabajador_id" UUID,
    "tipo_documento_id" INTEGER,
    "estado" "EstadoItemLote" NOT NULL DEFAULT 'SUBIENDO',
    "motivo" VARCHAR(300),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lote_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_lote_item_tamano" CHECK ("tamano" > 0),
    CONSTRAINT "ck_lote_item_motivo" CHECK ("estado" NOT IN ('PENDIENTE', 'ERROR') OR "motivo" IS NOT NULL),
    CONSTRAINT "ck_lote_item_subida" CHECK ("estado" <> 'PENDIENTE' OR "subida_id" IS NOT NULL)
);

ALTER TABLE "documento" ADD COLUMN "lote_item_id" UUID;

CREATE INDEX "ix_lote_carga_creado" ON "lote_carga"("creado_en");

CREATE UNIQUE INDEX "lote_item_subida_id_key" ON "lote_item"("subida_id");

CREATE UNIQUE INDEX "ux_lote_item_orden" ON "lote_item"("lote_id", "orden");

CREATE INDEX "ix_lote_item_estado" ON "lote_item"("estado", "actualizado_en");

CREATE INDEX "ix_documento_lote_item" ON "documento"("lote_item_id");

ALTER TABLE "documento" ADD CONSTRAINT "documento_lote_item_id_fkey" FOREIGN KEY ("lote_item_id") REFERENCES "lote_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lote_carga" ADD CONSTRAINT "lote_carga_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lote_item" ADD CONSTRAINT "lote_item_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote_carga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lote_item" ADD CONSTRAINT "lote_item_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lote_item" ADD CONSTRAINT "lote_item_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipo_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
