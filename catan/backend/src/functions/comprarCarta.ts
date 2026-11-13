import { Desarrollo } from "../common/enums.js";
import { Jugador } from "../schemas/Jugador.js";
import { Banca } from "../schemas/Banca.js";
import { COSTOS } from "../common/costos.js";
import { cobrarCosto, puedePagar } from "./cobrarCosto.js";

export function comprarCarta(jugador: Jugador, banca: Banca): {
    error: boolean,
    mensaje: string
} {
    //* verificar que la banca tenga cartas disponibles
    if (banca.cartas.length === 0) {
        return {
            error: true,
            mensaje: "La banca no tiene cartas disponibles"
        };
    }

    //* verificar que el jugador tenga recursos suficientes para comprar la carta
    if (!puedePagar(jugador, COSTOS.CARTA)) {
        return {
            error: true,
            mensaje: "No tienes recursos suficientes para comprar una carta"
        };
    }

    //* colocar la carta en el jugador y sacarla de la banca
    sacarCarta(jugador, banca);

    //* Intercambio de recursos
    cobrarCosto(jugador, banca, COSTOS.CARTA);

    return {
        error: false,
        mensaje: " ha comprado una carta de desarrollo"
    };
}

function sacarCarta(jugador: Jugador, banca: Banca): void {
    //* sacar la carta de la banca
    const carta = banca.cartas.shift();

    //? CARTA DE PUNTOS DE VICTORIA: queda oculta en el dato privado del jugador
    if (carta === Desarrollo.PUNTOS_VICTORIA) {
        jugador.privado.puntosVictoria += 1;
        jugador.privado.puntosParaGanar -= 1;
        return;
    }

    //* agregar la carta al jugador
    jugador.cartas_inusables.set(`${carta}`, (jugador.cartas_inusables.get(`${carta}`)) + 1);
}
