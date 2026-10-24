import { FaseJuego } from "../common/enums.js";

export function faseTrasLadron(
    faseOrigen: FaseJuego,
    cantidadVictimas: number
): FaseJuego {
    //* Con 2 o mas victimas el jugador debe elegir a quien robar
    if (cantidadVictimas >= 2) return FaseJuego.ROBO;
    //* Con 0 o 1 victima se vuelve a la fase desde la que se jugo
    return faseOrigen;
}
