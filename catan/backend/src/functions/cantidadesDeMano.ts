import { MapSchema } from "@colyseus/schema";
import { Jugador } from "../schemas/Jugador.js";

//* Suma las cartas de un mapa de la mano (recursos o cartas de desarrollo)
function sumar(mapa: MapSchema<number>): number {
    let total = 0;
    mapa.forEach((cantidad) => { total += cantidad; });
    return total;
}

//* Cuantos recursos y cuantas cartas de desarrollo (usables mas nuevas) tiene un jugador
export function cantidadesDeMano(jugador: Jugador): { recursos: number, cartas: number } {
    return {
        recursos: sumar(jugador.recursos),
        cartas: sumar(jugador.cartas_usables) + sumar(jugador.cartas_inusables),
    };
}

//* Deja en cada jugador las cantidades que ven todos. Las manos solo las recibe su dueno,
//* asi que los rivales usan estos totales (contador de cartas, aviso de descarte, a quien robar).
//* Solo escribe si cambian, para no mandar cambios de mas.
export function sincronizarCantidadesDeMano(jugadores: MapSchema<Jugador>) {
    jugadores.forEach((jugador) => {
        const { recursos, cartas } = cantidadesDeMano(jugador);
        if (jugador.cantidadRecursos !== recursos) jugador.cantidadRecursos = recursos;
        if (jugador.cantidadCartas !== cartas) jugador.cantidadCartas = cartas;
    });
}
