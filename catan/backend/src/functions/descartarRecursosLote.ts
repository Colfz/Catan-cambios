import { Banca } from "../schemas/Banca.js";
import { Jugador } from "../schemas/Jugador.js";
import { descartarRecurso } from "./descartarRecurso.js";

export function descartarRecursosLote(
    jugador: Jugador,
    banca: Banca,
    recursos: Record<string, number>,
    cartasDebidas: number
): {
    error: boolean,
    mensaje: string
} {
    //* Verificar que el lote sea un objeto
    if (!recursos || typeof recursos !== "object" || Array.isArray(recursos)) {
        return {
            error: true,
            mensaje: "El descarte no es valido"
        };
    }

    //* Validar todo el lote antes de descartar, para no dejar un descarte a medias
    let total = 0;
    for (const [recurso, cantidad] of Object.entries(recursos)) {
        if (!Number.isInteger(cantidad) || cantidad < 0) {
            return {
                error: true,
                mensaje: "La cantidad a descartar no es valida"
            };
        }

        if (cantidad === 0) continue;

        if (!jugador.recursos.has(recurso)) {
            return {
                error: true,
                mensaje: "El recurso seleccionado no es valido"
            };
        }

        if (jugador.recursos.get(recurso) < cantidad) {
            return {
                error: true,
                mensaje: "No tienes tantas cartas de ese recurso"
            };
        }

        total += cantidad;
    }

    //* El lote debe cubrir exactamente las cartas que debe descartar
    if (total !== cartasDebidas) {
        return {
            error: true,
            mensaje: `Debes descartar exactamente ${cartasDebidas} cartas`
        };
    }

    //* Descartar cada carta del lote
    for (const [recurso, cantidad] of Object.entries(recursos)) {
        for (let i = 0; i < cantidad; i++) {
            descartarRecurso(jugador, banca, recurso);
        }
    }

    return {
        error: false,
        mensaje: "Recursos descartados exitosamente"
    };
}
