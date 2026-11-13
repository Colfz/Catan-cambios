import { MapSchema } from "@colyseus/schema";
import { Vertice } from "../schemas/Vertices.js";
import { Jugador } from "../schemas/Jugador.js";
import { Banca } from "../schemas/Banca.js";
import { Construccion } from "../common/enums.js";
import { COSTOS } from "../common/costos.js";
import { cobrarCosto, puedePagar } from "./cobrarCosto.js";

export function construirCiudad(
    vertices: MapSchema<Vertice>,
    h: number,
    d: number,
    p: number,
    jugador: Jugador,
    banca: Banca,
    sessionId: string
):{
    error: boolean,
    mensaje: string
}{
    //* Validar existencia del vertice
    const vertice = vertices.get(`${h},${d},${p}`);
    if(!vertice){
        return{
            error: true,
            mensaje: "El lugar seleccionado no es valido"
        };
    }

    //* Validar que tenga ciudades disponibles
    if(jugador.construccionesDisponibles.get(`${Construccion.CIUDAD}`) <= 0){
        return{
            error: true,
            mensaje: "No tienes ciudades disponibles"
        };
    }

    //* Validar que no exista ya una ciudad
    if(vertice.propietario !== sessionId){
        return{
            error: true,
            mensaje: "El asentamiento no te pertenece"
        };
    }

    //* Validar que no exista ya una ciudad
    if(vertice.constuccion === Construccion.CIUDAD){
        return{
            error: true,
            mensaje: "Ya hay una ciudad en este lugar"
        };
    }

    //* Verificacion de recursos sufientes
    if(!puedePagar(jugador, COSTOS.CIUDAD)){
        return{
            error: true,
            mensaje: "No tienes recursos para construir una ciduad"
        };
    }

    //* Cambiar el tipo de construccion a ciudad
    vertice.constuccion = Construccion.CIUDAD;

    //* Restar los materiales al jugador y darselos a la banca
    cobrarCosto(jugador, banca, COSTOS.CIUDAD);

    jugador.puntuacion += 1;
    jugador.privado.puntosParaGanar -= 1;

    //* Reintegrar el asentimiento y eliminar la ciudad
    jugador.construccionesDisponibles.set(
        `${Construccion.ASENTAMIENTO}`,
        jugador.construccionesDisponibles.get(`${Construccion.ASENTAMIENTO}`) + 1
    )

    jugador.construccionesDisponibles.set(
        `${Construccion.CIUDAD}`,
        jugador.construccionesDisponibles.get(`${Construccion.CIUDAD}`) - 1
    )

    return{
        error: false,
        mensaje: " ha construido una ciudad"
    }
}