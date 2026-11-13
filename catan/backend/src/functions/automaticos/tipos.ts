import { MapSchema } from "@colyseus/schema";
import { Jugador } from "../../schemas/Jugador.js";
import { Partida } from "../../schemas/Partida.js";
import { Tablero } from "../../schemas/Tablero.js";
import { Banca } from "../../schemas/Banca.js";

//* Respuesta de cualquier accion del juego, venga de un jugador o del servidor
export interface Resultado {
    error: boolean;
    mensaje: string;
}

//* Lo que necesitan las acciones automaticas de la sala. CatanRoom lo cumple,
//* y en las pruebas se puede usar una sala falsa con solo estos miembros.
export interface SalaAutomatica {
    partida: Partida;
    tablero: Tablero;
    jugadores: MapSchema<Jugador>;
    banca: Banca;
    broadcast(tipo: string, mensaje?: unknown): void;

    ejecutarLanzarDados(sessionId: string): Resultado;
    ejecutarPasarTurno(sessionId: string): Resultado;
    ejecutarDescarte(sessionId: string, recursos: Record<string, number>): Resultado;
    ejecutarMoverLadron(sessionId: string, h: number, d: number): Resultado;
    ejecutarRobar(sessionId: string, victima: string): Resultado;
    ejecutarColocarAsentamiento(sessionId: string, h: number, d: number, p: number): Resultado;
    ejecutarColocarCamino(sessionId: string, h: number, d: number, p: number): Resultado;
    ejecutarCancelarCarreteras(sessionId: string): Resultado;
}
