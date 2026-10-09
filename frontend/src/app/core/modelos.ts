export interface UsuarioSesion {
  id: string;
  usuario: string;
  nombreCompleto: string;
  correo: string;
  rol: string;
  permisos: string[];
  debeCambiarClave: boolean;
  ultimoAcceso: string | null;
}

export interface SeccionLegajo {
  numero: string;
  nombre: string;
}

export const SECCIONES_LEGAJO: readonly SeccionLegajo[] = [
  { numero: '01', nombre: 'Información personal y familiar' },
  { numero: '02', nombre: 'Incorporación' },
  { numero: '03', nombre: 'Formación académica y capacitación' },
  { numero: '04', nombre: 'Experiencia laboral' },
  { numero: '05', nombre: 'Movimientos del personal' },
  { numero: '06', nombre: 'Compensaciones' },
  { numero: '07', nombre: 'Evaluación de desempeño y progresión' },
  { numero: '08', nombre: 'Reconocimientos y sanciones' },
  { numero: '09', nombre: 'Relaciones laborales' },
  { numero: '10', nombre: 'Seguridad, salud en el trabajo y bienestar' },
  { numero: '11', nombre: 'Desvinculación' },
  { numero: '12', nombre: 'Otros documentos' },
  { numero: '13', nombre: 'Vacaciones, licencias y permisos' },
];
