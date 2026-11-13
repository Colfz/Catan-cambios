import { Schema, type } from "@colyseus/schema";

//* Datos que solo recibe el dueno del jugador (ver Jugador.privado y la vista en CatanRoom)
export class PrivadoJugador extends Schema {
    //* Puntos que le faltan para ganar. Incluye los de las cartas de victoria
    @type("int8") puntosParaGanar: number = 10;
    //* Cartas de punto de victoria compradas, ocultas hasta ganar
    @type("uint8") puntosVictoria: number = 0;
}
