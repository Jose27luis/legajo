export interface PartesNombre {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
}

export function nombreTrabajador(trabajador: PartesNombre): string {
  const apellidos = [trabajador.apellidoPaterno, trabajador.apellidoMaterno].filter((parte) => parte !== null && parte !== '').join(' ');
  return `${apellidos}, ${trabajador.nombres}`;
}
