ALTER TYPE "Movimiento" ADD VALUE 'DESIGNACION';
ALTER TYPE "Movimiento" ADD VALUE 'CAMBIO_FUNCIONES';
ALTER TYPE "Movimiento" ADD VALUE 'OTRO';

CREATE TYPE "AccionDocumento" AS ENUM ('NINGUNA', 'VINCULO', 'MOVIMIENTO', 'CESE');

ALTER TABLE "tipo_documento"
    ADD COLUMN "accion" "AccionDocumento" NOT NULL DEFAULT 'NINGUNA',
    ADD COLUMN "campos" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "documento"
    ADD COLUMN "vinculo_id" UUID,
    ADD COLUMN "confirmado_por" UUID,
    ADD COLUMN "confirmado_en" TIMESTAMPTZ(3),
    ADD CONSTRAINT "ck_documento_confirmado" CHECK (("confirmado_por" IS NULL) = ("confirmado_en" IS NULL));

CREATE INDEX "ix_documento_vinculo" ON "documento"("vinculo_id");

ALTER TABLE "documento" ADD CONSTRAINT "documento_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "vinculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documento" ADD CONSTRAINT "documento_confirmado_por_fkey" FOREIGN KEY ("confirmado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "movimiento_laboral" (
    "id" UUID NOT NULL,
    "trabajador_id" UUID NOT NULL,
    "tipo" "Movimiento" NOT NULL,
    "fecha" DATE NOT NULL,
    "area_origen_id" INTEGER NOT NULL,
    "area_destino_id" INTEGER NOT NULL,
    "documento_id" UUID,
    "observacion" VARCHAR(500),
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_laboral_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_movimiento_tipo" CHECK ("tipo"::text <> 'SIN_MOVIMIENTO')
);

CREATE UNIQUE INDEX "movimiento_laboral_documento_id_key" ON "movimiento_laboral"("documento_id");

CREATE INDEX "ix_movimiento_trabajador" ON "movimiento_laboral"("trabajador_id", "fecha" DESC);

ALTER TABLE "movimiento_laboral" ADD CONSTRAINT "movimiento_laboral_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimiento_laboral" ADD CONSTRAINT "movimiento_laboral_area_origen_id_fkey" FOREIGN KEY ("area_origen_id") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimiento_laboral" ADD CONSTRAINT "movimiento_laboral_area_destino_id_fkey" FOREIGN KEY ("area_destino_id") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimiento_laboral" ADD CONSTRAINT "movimiento_laboral_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimiento_laboral" ADD CONSTRAINT "movimiento_laboral_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "rol_seccion_restringida" (
    "rol_id" UUID NOT NULL,
    "seccion_id" INTEGER NOT NULL,

    CONSTRAINT "rol_seccion_restringida_pkey" PRIMARY KEY ("rol_id", "seccion_id")
);

ALTER TABLE "rol_seccion_restringida" ADD CONSTRAINT "rol_seccion_restringida_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rol_seccion_restringida" ADD CONSTRAINT "rol_seccion_restringida_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "tipo_documento" AS t SET "nombre" = n."nombre"
FROM (VALUES
    ('0101', 'Copia de DNI ampliado'),
    ('0102', 'Ficha INFORHUS'),
    ('0105', 'Declaración jurada de datos personales'),
    ('0202', 'Contrato CAS'),
    ('0205', 'Adenda contractual'),
    ('0210', 'Declaración jurada de ingreso'),
    ('0212', 'Acta de adjudicación de plaza'),
    ('0299', 'Otro documento de incorporación'),
    ('0301', 'Constancia de inscripción de grados y títulos – SUNEDU'),
    ('0306', 'Constancia de colegiatura'),
    ('0307', 'Habilitación profesional'),
    ('0310', 'Certificado de capacitación'),
    ('0311', 'Certificado de curso'),
    ('0401', 'Constancia de trabajo'),
    ('0403', 'Resolución que acredita servicios'),
    ('0499', 'Otro documento de experiencia'),
    ('0502', 'Documento de encargatura'),
    ('0603', 'Resolución de asignación'),
    ('0604', 'Resolución de beneficio'),
    ('0699', 'Otro documento de compensación'),
    ('0702', 'Informe de desempeño'),
    ('0704', 'Resolución de progresión'),
    ('0799', 'Otro documento de evaluación'),
    ('0802', 'Resolución de felicitación'),
    ('0803', 'Memorando de felicitación'),
    ('0806', 'Resolución de sanción'),
    ('0807', 'Documento de procedimiento disciplinario'),
    ('0902', 'Solicitud laboral'),
    ('0903', 'Acuerdo individual'),
    ('0999', 'Otro documento laboral'),
    ('1002', 'Aptitud ocupacional administrativa'),
    ('1003', 'Documento de bienestar'),
    ('1007', 'Acta de entrega EPP'),
    ('1099', 'Otro documento SST'),
    ('1103', 'Documento de término de contrato'),
    ('1104', 'Constancia de trabajo por cese'),
    ('1106', 'Acta de entrega de cargo'),
    ('1108', 'Documento de fallecimiento (sustento autorizado)'),
    ('1202', 'Documento de archivo'),
    ('1203', 'Anexo complementario'),
    ('1299', 'Otro documento')
) AS n("codigo", "nombre")
WHERE t."codigo" = n."codigo";

UPDATE "tipo_documento" SET "activo" = FALSE
WHERE "codigo" IN (
    '0103', '0104', '0199',
    '0206', '0208', '0209', '0211',
    '0305', '0308', '0309', '0313', '0314', '0399',
    '0507', '0508', '0599',
    '0601', '0602',
    '0703', '0705',
    '0801', '0804', '0808', '0899',
    '0904',
    '1001', '1004',
    '1105', '1199',
    '1303', '1304', '1305', '1307', '1399'
);
