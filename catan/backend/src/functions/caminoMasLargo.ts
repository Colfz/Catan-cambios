import { MapSchema } from "@colyseus/schema";
import { Arista } from "../schemas/Arista.js";
import { Vertice } from "../schemas/Vertices.js";

//* Los dos vertices que une una arista (la misma geometria que usa construirCaminos)
export function verticesDeArista(llaveArista: string): [string, string] {
    const [h, d, p] = llaveArista.split(",").map(Number);
    if (p === 0) return [`${h},${d},0`, `${h + 1},${d},1`];
    if (p === 1) return [`${h},${d},0`, `${h},${d},1`];
    return [`${h},${d},1`, `${h - 1},${d + 1},0`];
}

//* Texto del registro cuando cambia quien tiene el camino mas largo. Sin nombre: nadie lo tiene
export function avisoCaminoMasLargo(
    nombre: string | undefined,
    largo: number
): { jugador: string, mensaje: string } {
    if (!nombre) return { jugador: "Sistema: ", mensaje: "Nadie tiene el camino mas largo" };
    return { jugador: nombre, mensaje: ` tiene el camino mas largo (${largo} caminos)` };
}

//* Largo de la ruta continua mas larga de un jugador: cuenta caminos sin repetir ninguno,
//* puede cerrar ciclos y no puede pasar por un vertice con una construccion rival
export function calcularCaminoMasLargo(
    aristas: MapSchema<Arista>,
    vertices: MapSchema<Vertice>,
    sessionId: string
): number {
    //* Por cada vertice, los caminos del jugador que lo tocan
    const caminosPorVertice = new Map<string, string[]>();
    aristas.forEach((arista, llave) => {
        if (arista.propietario !== sessionId) return;
        for (const vertice of verticesDeArista(llave)) {
            if (!caminosPorVertice.has(vertice)) caminosPorVertice.set(vertice, []);
            caminosPorVertice.get(vertice)!.push(llave);
        }
    });

    //* Un vertice con una construccion de otro jugador corta la ruta: se puede llegar, no seguir
    const cortaLaRuta = (vertice: string) => {
        const dueno = vertices.get(vertice)?.propietario ?? "";
        return dueno !== "" && dueno !== sessionId;
    };

    const usados = new Set<string>();
    const recorrer = (vertice: string): number => {
        let mejor = 0;
        for (const camino of caminosPorVertice.get(vertice) ?? []) {
            if (usados.has(camino)) continue;
            const [a, b] = verticesDeArista(camino);
            const siguiente = a === vertice ? b : a;
            usados.add(camino);
            const largo = 1 + (cortaLaRuta(siguiente) ? 0 : recorrer(siguiente));
            usados.delete(camino);
            mejor = Math.max(mejor, largo);
        }
        return mejor;
    };

    //* Se prueba empezar desde cada vertice; empezar en uno rival es valido (es una punta)
    let maximo = 0;
    for (const vertice of caminosPorVertice.keys()) {
        maximo = Math.max(maximo, recorrer(vertice));
    }
    return maximo;
}
