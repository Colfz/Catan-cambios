import { Schema, type } from "@colyseus/schema";

//* Resultado publico de un jugador al terminar la partida (incluye los puntos que estaban ocultos)
export class ResultadoJugador extends Schema {
    @type("string") sessionId = "";
    @type("string") nombre = "";
    //* Puntos que todos veian (jugador.puntuacion)
    @type("uint8") puntosPublicos = 0;
    //* Cartas de punto de victoria que estaban ocultas (privado.puntosVictoria)
    @type("uint8") cartasVictoria = 0;
    //* puntosPublicos + cartasVictoria
    @type("uint8") total = 0;
}
