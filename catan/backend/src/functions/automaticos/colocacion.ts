import { FasePartida, FasePreconstruccion } from "../../common/enums.js";
import { elegirArista, elegirVertice } from "../colocacionAleatoria.js";
import type { SalaAutomatica } from "./tipos.js";

//* Accion automatica cuando se acaba el tiempo en la colocacion inicial (issue #19).

function avisar(sala: SalaAutomatica, sessionId: string, accion: string): void {
    const nombre = sala.jugadores.get(sessionId)?.nombre;
    sala.broadcast("log", {
        jugador: "Sistema: ",
        mensaje: `Se acabo el tiempo de ${nombre}: ${accion}`
    });
}

function posicion(llave: string): [number, number, number] {
    const [h, d, p] = llave.split(",").map(Number);
    return [h, d, p];
}

//* Se acabo el tiempo de colocar: el servidor pone el asentamiento (si falta) y el camino.
//* ejecutarColocarAsentamiento ya entrega los recursos del segundo asentamiento
export function autoColocar(sala: SalaAutomatica): void {
    if (sala.partida.fase !== FasePartida.PRECONSTRUCCION) return;
    const turno = sala.partida.turnoActual;
    const colocado: string[] = [];

    if (sala.partida.fasePreconstruccion === FasePreconstruccion.ASENTAMIENTO) {
        const vertice = elegirVertice(sala.tablero.vertices);
        if (!vertice || sala.ejecutarColocarAsentamiento(turno, ...posicion(vertice)).error) {
            avisar(sala, turno, "el servidor no encontro lugar para el asentamiento");
            return;
        }
        colocado.push("un asentamiento");
    }

    const ultimo = sala.jugadores.get(turno)?.ultimoAsentamiento ?? "";
    const arista = ultimo ? elegirArista(sala.tablero.aristas, ultimo) : null;
    if (!arista || sala.ejecutarColocarCamino(turno, ...posicion(arista)).error) {
        const antes = colocado.length > 0 ? "el servidor coloco un asentamiento, pero " : "el servidor ";
        avisar(sala, turno, `${antes}no encontro lugar para el camino`);
        return;
    }
    colocado.push("un camino");

    avisar(sala, turno, `el servidor coloco ${colocado.join(" y ")}`);
}
