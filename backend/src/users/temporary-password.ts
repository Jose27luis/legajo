import { randomInt } from 'node:crypto';

const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITOS = '23456789';
const TODOS = LETRAS + DIGITOS;

function caracter(alfabeto: string): string {
  return alfabeto.charAt(randomInt(alfabeto.length));
}

export function generarClaveTemporal(longitud = 12): string {
  const caracteres = [caracter(LETRAS), caracter(DIGITOS)];
  while (caracteres.length < longitud) {
    caracteres.push(caracter(TODOS));
  }
  for (let indice = caracteres.length - 1; indice > 0; indice -= 1) {
    const destino = randomInt(indice + 1);
    [caracteres[indice], caracteres[destino]] = [caracteres[destino], caracteres[indice]];
  }
  return caracteres.join('');
}
