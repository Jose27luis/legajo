CREATE TABLE "rol" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permiso" (
    "codigo" VARCHAR(60) NOT NULL,
    "modulo" VARCHAR(40) NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("codigo")
);

CREATE TABLE "rol_permiso" (
    "rol_id" UUID NOT NULL,
    "permiso_codigo" VARCHAR(60) NOT NULL,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id","permiso_codigo")
);

CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "usuario" VARCHAR(30) NOT NULL,
    "nombre_completo" VARCHAR(120) NOT NULL,
    "correo" VARCHAR(120) NOT NULL,
    "clave_hash" TEXT NOT NULL,
    "rol_id" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(3),
    "debe_cambiar_clave" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_usuario_usuario" CHECK ("usuario" ~ '^[a-z0-9._-]{4,30}$'),
    CONSTRAINT "ck_usuario_correo" CHECK ("correo" = lower("correo") AND position('@' in "correo") > 1),
    CONSTRAINT "ck_usuario_intentos" CHECK ("intentos_fallidos" >= 0),
    CONSTRAINT "ck_usuario_nombre" CHECK (length(trim("nombre_completo")) > 0)
);

CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID,
    "accion" VARCHAR(60) NOT NULL,
    "entidad" VARCHAR(60) NOT NULL,
    "entidad_id" VARCHAR(60),
    "trabajador_id" UUID,
    "ip" INET,
    "user_agent" TEXT,
    "detalle" JSONB,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

CREATE UNIQUE INDEX "usuario_usuario_key" ON "usuario"("usuario");

CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

CREATE INDEX "ix_auditoria_usuario" ON "auditoria"("usuario_id", "fecha" DESC);

CREATE INDEX "ix_auditoria_legajo" ON "auditoria"("trabajador_id", "fecha" DESC);

CREATE INDEX "ix_auditoria_accion" ON "auditoria"("accion", "fecha" DESC);

ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_codigo_fkey" FOREIGN KEY ("permiso_codigo") REFERENCES "permiso"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "auditoria_inmutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'La auditoría no se puede modificar ni eliminar';
END;
$$;

CREATE TRIGGER "tg_auditoria_inmutable"
BEFORE UPDATE OR DELETE ON "auditoria"
FOR EACH ROW EXECUTE FUNCTION "auditoria_inmutable"();

CREATE TRIGGER "tg_auditoria_sin_truncate"
BEFORE TRUNCATE ON "auditoria"
FOR EACH STATEMENT EXECUTE FUNCTION "auditoria_inmutable"();
