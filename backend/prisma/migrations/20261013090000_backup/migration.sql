CREATE TYPE "OrigenBackup" AS ENUM ('PROGRAMADO', 'MANUAL');

CREATE TYPE "EstadoBackup" AS ENUM ('EN_CURSO', 'CORRECTO', 'ERROR');

CREATE TABLE "backup_ejecucion" (
    "id" UUID NOT NULL,
    "origen" "OrigenBackup" NOT NULL,
    "usuario_id" UUID,
    "inicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMPTZ(3),
    "estado" "EstadoBackup" NOT NULL DEFAULT 'EN_CURSO',
    "snapshot_bd" VARCHAR(64),
    "snapshot_archivos" VARCHAR(64),
    "bytes_agregados" BIGINT,
    "verificado" BOOLEAN,
    "error" TEXT,

    CONSTRAINT "backup_ejecucion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_backup_manual_usuario" CHECK (("origen" = 'MANUAL') = ("usuario_id" IS NOT NULL)),
    CONSTRAINT "ck_backup_fin" CHECK (("estado" = 'EN_CURSO') = ("fin" IS NULL)),
    CONSTRAINT "ck_backup_error" CHECK (("estado" = 'ERROR') = ("error" IS NOT NULL))
);

CREATE INDEX "ix_backup_inicio" ON "backup_ejecucion"("inicio" DESC);

CREATE UNIQUE INDEX "ux_backup_en_curso" ON "backup_ejecucion" ((true)) WHERE "estado" = 'EN_CURSO';

ALTER TABLE "backup_ejecucion" ADD CONSTRAINT "backup_ejecucion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
