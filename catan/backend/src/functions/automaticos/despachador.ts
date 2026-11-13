import { Etapa } from "../ritmos.js";
import type { SalaAutomatica } from "./tipos.js";
import { autoLanzarDados, autoPasarTurno, autoDescartar, autoCarreteras } from "./turno.js";
import { autoMoverLadron, autoRobar } from "./ladron.js";
import { autoColocar } from "./colocacion.js";

export type AccionAutomatica = (sala: SalaAutomatica) => void;

//* Que hace el servidor cuando se acaba el tiempo de cada etapa
export const ACCIONES_POR_ETAPA: Record<Etapa, AccionAutomatica> = {
    [Etapa.DADOS]: autoLanzarDados,
    [Etapa.ACCIONES]: autoPasarTurno,
    [Etapa.LADRON]: autoMoverLadron,
    [Etapa.ROBO]: autoRobar,
    [Etapa.DESCARTE]: autoDescartar,
    [Etapa.CARRETERAS]: autoCarreteras,
    [Etapa.COLOCACION]: autoColocar
};

//* Las acciones se pueden inyectar para probar el despacho con acciones falsas
export function ejecutarAutomatico(
    sala: SalaAutomatica,
    etapa: Etapa,
    acciones: Record<Etapa, AccionAutomatica> = ACCIONES_POR_ETAPA
): void {
    acciones[etapa](sala);
}
