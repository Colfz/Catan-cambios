import { Jugador } from "../schemas/Jugador.js";

//* Arma un lote al azar con las cartas que debe descartar, sin pedir nunca mas de las que tiene.
//* Cada carta de la mano tiene la misma probabilidad de salir
export function armarDescarteAleatorio(
    jugador: Jugador,
    cartasDebidas: number,
    azar: () => number = Math.random
): Record<string, number> {
    //* La mano como una lista con una entrada por carta
    const mano: string[] = [];
    jugador.recursos.forEach((cantidad, recurso) => {
        for (let i = 0; i < cantidad; i++) {
            mano.push(recurso);
        }
    });

    const lote: Record<string, number> = {};
    const cartas = Math.min(cartasDebidas, mano.length);
    for (let i = 0; i < cartas; i++) {
        const indice = Math.floor(azar() * mano.length);
        const [recurso] = mano.splice(indice, 1);
        lote[recurso] = (lote[recurso] ?? 0) + 1;
    }

    return lote;
}
