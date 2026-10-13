#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ejecutar() {
  docker compose run --rm --no-deps -T worker sh -c "$1"
}

if [ "$#" -ne 1 ]; then
  echo "Uso: infra/restore.sh <id de la copia>"
  echo
  echo "Copias de la base de datos guardadas (el id de la copia va en la etiqueta ejecucion-<id>):"
  ejecutar 'restic snapshots --tag bd --compact'
  exit 1
fi

ejecucion="$1"
if ! [[ "$ejecucion" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo "El id de la copia no es válido: $ejecucion"
  exit 1
fi

etiqueta="ejecucion-$ejecucion"
echo "Copias encontradas para $etiqueta:"
ejecutar "restic snapshots --compact --tag bd,$etiqueta && restic snapshots --compact --tag archivos,$etiqueta"
if ! ejecutar "restic snapshots --json --tag bd,$etiqueta | grep -q '\"id\"' && restic snapshots --json --tag archivos,$etiqueta | grep -q '\"id\"'"; then
  echo "No están completas las dos partes (base de datos y archivos) de esa copia."
  exit 1
fi

echo
echo "Se reemplazarán la base de datos y los archivos por los de esa copia."
echo "Los archivos actuales quedarán guardados en una carpeta .anterior-<fecha> dentro del volumen."
read -r -p "Escribe RESTAURAR para continuar: " confirmacion
if [ "$confirmacion" != "RESTAURAR" ]; then
  echo "Cancelado."
  exit 1
fi

fecha="$(date +%Y%m%d-%H%M%S)"

reanudar() {
  docker compose start api worker
}

docker compose stop api worker
trap reanudar EXIT

echo "Restaurando archivos..."
ejecutar "set -eu
destino=/data/archivos/.restaurado-$fecha
anterior=/data/archivos/.anterior-$fecha
restic restore --tag archivos,$etiqueta 'latest:/data/archivos' --target \"\$destino\"
mkdir \"\$anterior\"
find /data/archivos -mindepth 1 -maxdepth 1 ! -name '.restaurado-*' ! -name '.anterior-*' -exec mv {} \"\$anterior\"/ \\;
find \"\$destino\" -mindepth 1 -maxdepth 1 -exec mv {} /data/archivos/ \\;
rmdir \"\$destino\""

echo "Restaurando la base de datos..."
ejecutar "set -euo pipefail
restic dump --tag bd,$etiqueta latest /legajos.dump | pg_restore --clean --if-exists --no-owner --no-privileges --dbname=\"\${DATABASE_URL%%\\?*}\""

trap - EXIT
reanudar

echo "Verificando que cada documento disponible tenga su archivo..."
ejecutar "set -euo pipefail
psql \"\${DATABASE_URL%%\\?*}\" -Atc \"SELECT a.ruta FROM documento d JOIN documento_archivo a ON a.id = d.archivo_actual_id WHERE d.estado = 'DISPONIBLE'\" | {
  total=0
  faltantes=0
  while IFS= read -r ruta; do
    total=\$((total + 1))
    if [ ! -f \"/data/archivos/\$ruta\" ]; then
      echo \"Falta: \$ruta\"
      faltantes=\$((faltantes + 1))
    fi
  done
  echo \"Documentos disponibles: \$total. Archivos faltantes: \$faltantes.\"
  [ \"\$faltantes\" -eq 0 ]
}"

echo "Restauración correcta."
