import { MapSchema } from "@colyseus/schema";
import { Jugador } from "../schemas/Jugador.js";
import { Partida } from "../schemas/Partida.js";
import { Tablero } from "../schemas/Tablero.js";
import { avisoCaminoMasLargo, calcularCaminoMasLargo } from "./caminoMasLargo.js";

//* Largo minimo de la ruta para tener el camino mas largo
export const LARGO_MINIMO_CAMINO = 5;
//* Puntos que da el camino mas largo
export const PUNTOS_CAMINO_MAS_LARGO = 2;

//* Lo que necesita la funcion de la sala (CatanRoom lo cumple; las pruebas usan una sala falsa)
export interface SalaCaminoLargo {
    partida: Partida;
    tablero: Tablero;
    jugadores: MapSchema<Jugador>;
    broadcast(tipo: string, mensaje: unknown): void;
}

//* Quien deberia tener el camino mas largo con estos largos.
//* El dueno actual lo conserva si sigue empatado en lo mas largo; si no, solo lo toma
//* quien lo supera solo. Con menos de 5 caminos, o con un empate entre otros, nadie lo tiene.
export function duenoDelCaminoMasLargo(largos: Map<string, number>, actual: string): string {
    let maximo = 0;
    largos.forEach((largo) => { maximo = Math.max(maximo, largo); });
    if (maximo < LARGO_MINIMO_CAMINO) return "";

    if (actual !== "" && largos.get(actual) === maximo) return actual;

    const candidatos = [...largos.entries()].filter(([, largo]) => largo === maximo);
    return candidatos.length === 1 ? candidatos[0][0] : "";
}

//* Recalcula el camino mas largo de todos y pasa los 2 puntos si cambia de dueno.
//* Se llama cuando cambian los caminos o las construcciones, o cuando alguien se va.
//* Devuelve true si cambio de dueno.
export function recalcularCaminoMasLargo(sala: SalaCaminoLargo): boolean {
    const { partida, tablero, jugadores } = sala;

    const largos = new Map<string, number>();
    jugadores.forEach((_, sessionId) => {
        largos.set(sessionId, calcularCaminoMasLargo(tablero.aristas, tablero.vertices, sessionId));
    });

    const anterior = partida.caminoMasLargo;
    const nuevo = duenoDelCaminoMasLargo(largos, anterior);

    partida.largoCaminoMasLargo = nuevo === "" ? 0 : largos.get(nuevo) ?? 0;
    if (nuevo === anterior) return false;

    //* Quitar los 2 puntos a quien lo tenia (si ya no esta en la partida, no hay nada que quitar)
    const jugadorAnterior = jugadores.get(anterior);
    if (jugadorAnterior) {
        jugadorAnterior.puntuacion -= PUNTOS_CAMINO_MAS_LARGO;
        jugadorAnterior.privado.puntosParaGanar += PUNTOS_CAMINO_MAS_LARGO;
    }

    //* Darlos a quien lo toma
    const jugadorNuevo = jugadores.get(nuevo);
    if (jugadorNuevo) {
        jugadorNuevo.puntuacion += PUNTOS_CAMINO_MAS_LARGO;
        jugadorNuevo.privado.puntosParaGanar -= PUNTOS_CAMINO_MAS_LARGO;
    }

    partida.caminoMasLargo = nuevo;

    const aviso = avisoCaminoMasLargo(jugadorNuevo?.nombre, partida.largoCaminoMasLargo);
    sala.broadcast("log", aviso);
    return true;
}
