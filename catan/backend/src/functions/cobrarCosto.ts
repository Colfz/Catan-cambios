import type { Costo } from "../common/costos.js";
import { Jugador } from "../schemas/Jugador.js";
import { Banca } from "../schemas/Banca.js";

//* El jugador tiene al menos lo que pide el costo de cada recurso
export function puedePagar(jugador: Jugador, costo: Costo): boolean {
    return Object.entries(costo).every(
        ([recurso, cantidad]) => (jugador.recursos.get(recurso) ?? 0) >= cantidad
    );
}

//* Pasa el costo de la mano del jugador a la banca. Antes hay que comprobar puedePagar
export function cobrarCosto(jugador: Jugador, banca: Banca, costo: Costo): void {
    for (const [recurso, cantidad] of Object.entries(costo)) {
        jugador.recursos.set(recurso, jugador.recursos.get(recurso) - cantidad);
        banca.recursos.set(recurso, banca.recursos.get(recurso) + cantidad);
    }
}
