import { FasePartida } from "../common/enums.js";
import { CatanRoom } from "../rooms/CatanRoom.js";
import { Jugador } from "../schemas/Jugador.js";
import { Partida } from "../schemas/Partida.js";
import { calcularResultadoFinal } from "./calcularResultadoFinal.js";

export function verificarVictoria(
    partida: Partida,
    jugador: Jugador,
    sessionId: string,
    room: CatanRoom
) {
    if (jugador.privado.puntosParaGanar <= 0) {
        partida.ganador = sessionId;
        partida.fase = FasePartida.FINALIZADA

        //* Guardar en el estado publico el resultado de todos, ya sin puntos ocultos
        partida.resultadoFinal.clear();
        partida.resultadoFinal.push(...calcularResultadoFinal(room.jugadores));

        //* Si gano con cartas de victoria ocultas, avisar cuantas revela
        const cartasVictoria = jugador.privado.puntosVictoria;
        if (cartasVictoria > 0) {
            room.broadcast("log", {
                jugador: jugador.nombre,
                mensaje: ` revela ${cartasVictoria} cartas de punto de victoria`
            })
        }

        //* Avisar a todos del ganador con el log
        room.broadcast("log", {
            jugador: "Sistema: ",
            mensaje: `${jugador.nombre} HA GANADO LA PARTIDA!!`
        })
    }
    
}