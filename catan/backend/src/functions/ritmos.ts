import { Ritmo } from "../common/enums.js";

//* Etapas del turno que tienen tiempo limite
export enum Etapa {
    DADOS = 1,
    ACCIONES = 2,
    LADRON = 3,
    ROBO = 4,
    DESCARTE = 5,
    CARRETERAS = 6,
    COLOCACION = 7
}

//* Segundos de cada etapa con el ritmo Normal (colocacion: por cada pieza)
export const TIEMPOS_NORMAL: Record<Etapa, number> = {
    [Etapa.DADOS]: 45,
    [Etapa.ACCIONES]: 180,
    [Etapa.LADRON]: 45,
    [Etapa.ROBO]: 30,
    [Etapa.DESCARTE]: 60,
    [Etapa.CARRETERAS]: 60,
    [Etapa.COLOCACION]: 90
};

//* Segundos que dura una etapa segun el ritmo. 0 significa sin limite
export function tiempoDeEtapa(ritmo: Ritmo, etapa: Etapa): number {
    if (ritmo === Ritmo.SIN_LIMITE) return 0;
    const normal = TIEMPOS_NORMAL[etapa];
    return ritmo === Ritmo.RAPIDO ? Math.round(normal / 2) : normal;
}

//* Ritmo que pidio quien crea la sala. Si no llega o no es valido, se usa el Normal
export function ritmoValido(valor: unknown): Ritmo {
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (numero === Ritmo.NORMAL || numero === Ritmo.RAPIDO || numero === Ritmo.SIN_LIMITE) {
    return numero;
  }
  return Ritmo.NORMAL;
}
