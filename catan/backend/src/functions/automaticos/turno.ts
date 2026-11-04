import { armarDescarteAleatorio } from "../descarteAleatorio.js";
import type { Resultado, SalaAutomatica } from "./tipos.js";

//* Acciones automaticas cuando se acaba el tiempo de dados, acciones, descarte
//* y carreteras gratis (issue #17).

//* Avisa en el registro que se acabo el tiempo de un jugador y que hizo el servidor
function avisar(sala: SalaAutomatica, sessionId: string, accion: string): void {
    const nombre = sala.jugadores.get(sessionId)?.nombre;
    sala.broadcast("log", {
        jugador: "Sistema: ",
        mensaje: `Se acabo el tiempo de ${nombre}: ${accion}`
    });
}

function reportarError(accion: string, resultado: Resultado): void {
    if (resultado.error) {
        console.error(`No se pudo ${accion} automaticamente:`, resultado.mensaje);
    }
}

//* Se acabo el tiempo de lanzar: si sale 7, el flujo normal sigue con el descarte o el ladron
export function autoLanzarDados(sala: SalaAutomatica): void {
    const turno = sala.partida.turnoActual;
    avisar(sala, turno, "el servidor lanzo los dados");
    reportarError("lanzar los dados", sala.ejecutarLanzarDados(turno));
}

//* Se acabo el tiempo de acciones: pasar el turno ya cancela la oferta y activa las cartas compradas
export function autoPasarTurno(sala: SalaAutomatica): void {
    const turno = sala.partida.turnoActual;
    avisar(sala, turno, "paso su turno");
    reportarError("pasar el turno", sala.ejecutarPasarTurno(turno));
}

//* Se acabo el tiempo de descartar: cada jugador pendiente descarta al azar lo que debe
export function autoDescartar(sala: SalaAutomatica): void {
    //* Se copia porque el mapa cambia mientras se descarta
    const pendientes = Array.from(sala.partida.jugadoresParaDescartar.entries());

    for (const [sessionId, cartasDebidas] of pendientes) {
        const jugador = sala.jugadores.get(sessionId);
        if (!jugador) continue;

        avisar(sala, sessionId, `se descartaron ${cartasDebidas} cartas al azar`);
        const lote = armarDescarteAleatorio(jugador, cartasDebidas);
        reportarError("descartar", sala.ejecutarDescarte(sessionId, lote));
    }
}

//* Se acabo el tiempo de las carreteras gratis: se pierden las que falten
export function autoCarreteras(sala: SalaAutomatica): void {
    const turno = sala.partida.turnoActual;
    avisar(sala, turno, "se perdieron las carreteras gratis que faltaban");
    reportarError("cancelar las carreteras", sala.ejecutarCancelarCarreteras(turno));
}
