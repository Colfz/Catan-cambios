import { MapSchema } from "@colyseus/schema";
import { Vertice } from "../schemas/Vertices.js";
import { Arista } from "../schemas/Arista.js";
import { verticesPos0, verticesPos1 } from "./construirAsentamiento.js";

//* Elige al azar un vertice libre que cumple la regla de distancia. null si no queda ninguno
export function elegirVertice(
    vertices: MapSchema<Vertice>,
    azar: () => number = Math.random
): string | null {
    const candidatos: string[] = [];
    vertices.forEach((vertice, llave) => {
        if (vertice.propietario !== "") return;
        const libre = vertice.p === 0
            ? verticesPos0(vertices, vertice.h, vertice.d)
            : verticesPos1(vertices, vertice.h, vertice.d);
        if (libre) candidatos.push(llave);
    });

    if (candidatos.length === 0) return null;
    return candidatos[Math.floor(azar() * candidatos.length)];
}

//* Las tres aristas que tocan un vertice (las mismas que valida comprobarCaminoPreconstruccion)
export function aristasConectadas(llaveVertice: string): string[] {
    const [h, d, p] = llaveVertice.split(",").map(Number);
    return p === 0
        ? [`${h},${d},0`, `${h},${d},1`, `${h + 1},${d - 1},2`]
        : [`${h},${d},1`, `${h},${d},2`, `${h - 1},${d},0`];
}

//* Elige al azar una arista libre pegada al ultimo asentamiento. null si no hay ninguna
export function elegirArista(
    aristas: MapSchema<Arista>,
    ultimoAsentamiento: string,
    azar: () => number = Math.random
): string | null {
    const candidatas = aristasConectadas(ultimoAsentamiento)
        .filter((llave) => aristas.get(llave)?.propietario === "");

    if (candidatas.length === 0) return null;
    return candidatas[Math.floor(azar() * candidatas.length)];
}
