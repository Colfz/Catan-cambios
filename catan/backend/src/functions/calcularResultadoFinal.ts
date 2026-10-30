import { MapSchema } from "@colyseus/schema";
import { Jugador } from "../schemas/Jugador.js";
import { ResultadoJugador } from "../schemas/ResultadoJugador.js";

export function calcularResultadoFinal(
    jugadores: MapSchema<Jugador>
): ResultadoJugador[] {
    const resultados: ResultadoJugador[] = [];

    //* Un resultado por jugador, revelando sus cartas de victoria ocultas
    jugadores.forEach((jugador, sessionId) => {
        const resultado = new ResultadoJugador();
        resultado.sessionId = sessionId;
        resultado.nombre = jugador.nombre;
        resultado.puntosPublicos = jugador.puntuacion;
        resultado.cartasVictoria = jugador.privado.puntosVictoria;
        resultado.total = resultado.puntosPublicos + resultado.cartasVictoria;
        resultados.push(resultado);
    });

    //* De mayor a menor total; sort es estable, asi el empate respeta el orden original
    return resultados.sort((a, b) => b.total - a.total);
}
