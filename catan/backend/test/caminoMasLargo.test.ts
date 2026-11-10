import assert from "node:assert/strict";
import { CatanState } from "../src/states/CatanState.js";
import { Construccion } from "../src/common/enums.js";
import { aristasConectadas } from "../src/functions/colocacionAleatoria.js";
import { avisoCaminoMasLargo, calcularCaminoMasLargo, verticesDeArista } from "../src/functions/caminoMasLargo.js";

//* Las seis aristas alrededor de un hexagono (las mismas que crea generarAristas)
function anilloDe(h: number, d: number): string[] {
    return [`${h},${d},0`, `${h},${d},1`, `${h},${d},2`, `${h - 1},${d + 1},0`, `${h},${d + 1},1`, `${h + 1},${d},2`];
}

//* Ordena las aristas de un anillo para que cada una toque a la siguiente
function ordenar(anillo: string[]): string[] {
    const orden = [anillo[0]];
    const resto = anillo.slice(1);
    while (resto.length) {
        const [a, b] = verticesDeArista(orden[orden.length - 1]);
        const i = resto.findIndex((x) => verticesDeArista(x).some((v) => v === a || v === b) && !orden.includes(x));
        orden.push(resto.splice(i, 1)[0]);
    }
    return orden;
}

//* El vertice que comparten dos aristas seguidas
function compartido(a: string, b: string): string {
    return verticesDeArista(a).find((v) => verticesDeArista(b).includes(v))!;
}

function tableroCon(caminos: Record<string, string[]>) {
    const estado = new CatanState();
    for (const [dueno, llaves] of Object.entries(caminos)) {
        for (const llave of llaves) {
            const arista = estado.tablero.aristas.get(llave);
            assert.ok(arista, `la arista ${llave} no existe`);
            arista.propietario = dueno;
        }
    }
    return estado;
}

function poner(estado: CatanState, vertice: string, dueno: string) {
    const v = estado.tablero.vertices.get(vertice)!;
    v.propietario = dueno;
    v.setConstruccion(Construccion.ASENTAMIENTO);
}

const largo = (estado: CatanState, id: string) =>
    calcularCaminoMasLargo(estado.tablero.aristas, estado.tablero.vertices, id);

describe("verticesDeArista", () => {
    it("coincide con las aristas que tocan cada vertice", () => {
        const estado = new CatanState();
        estado.tablero.aristas.forEach((_, llave) => {
            const extremos = verticesDeArista(llave);
            assert.equal(extremos.length, 2);
            for (const vertice of extremos) {
                if (!estado.tablero.vertices.has(vertice)) continue;
                assert.ok(aristasConectadas(vertice).includes(llave), `${llave} no toca ${vertice}`);
            }
        });
    });
});

describe("calcularCaminoMasLargo", () => {
    const anillo = ordenar(anilloDe(0, 0));

    it("sin caminos es 0", () => {
        assert.equal(largo(tableroCon({}), "a"), 0);
    });

    it("una ruta recta cuenta todos sus caminos", () => {
        assert.equal(largo(tableroCon({ a: anillo.slice(0, 5) }), "a"), 5);
        assert.equal(largo(tableroCon({ a: anillo.slice(0, 3) }), "a"), 3);
    });

    it("un ciclo cuenta todas sus aristas, sin repetir ninguna", () => {
        assert.equal(largo(tableroCon({ a: anillo }), "a"), 6);
    });

    it("una rama no suma: cuenta la ruta mas larga, no todos los caminos", () => {
        const ruta = anillo.slice(0, 4);
        const medio = compartido(ruta[1], ruta[2]);
        const rama = aristasConectadas(medio).find((x) => !anillo.includes(x))!;
        assert.equal(largo(tableroCon({ a: [...ruta, rama] }), "a"), 4);
    });

    it("un ciclo con una cola suma la vuelta completa y la cola", () => {
        const vertice = compartido(anillo[0], anillo[1]);
        const cola = aristasConectadas(vertice).find((x) => !anillo.includes(x))!;
        assert.equal(largo(tableroCon({ a: [...anillo, cola] }), "a"), 7);
    });

    it("un asentamiento rival en medio corta la ruta", () => {
        const estado = tableroCon({ a: anillo.slice(0, 5) });
        poner(estado, compartido(anillo[1], anillo[2]), "b");
        assert.equal(largo(estado, "a"), 3);
    });

    it("un asentamiento propio en medio no corta la ruta", () => {
        const estado = tableroCon({ a: anillo.slice(0, 5) });
        poner(estado, compartido(anillo[1], anillo[2]), "a");
        assert.equal(largo(estado, "a"), 5);
    });

    it("un asentamiento rival en la punta no resta", () => {
        const ruta = anillo.slice(0, 5);
        const estado = tableroCon({ a: ruta });
        const punta = verticesDeArista(ruta[0]).find((v) => v !== compartido(ruta[0], ruta[1]))!;
        poner(estado, punta, "b");
        assert.equal(largo(estado, "a"), 5);
    });

    it("solo cuenta los caminos del jugador y elige su ruta mas larga", () => {
        const otro = ordenar(anilloDe(2, -2));
        const estado = tableroCon({ a: [...anillo.slice(0, 2), ...otro.slice(0, 4)], b: anillo.slice(2, 6) });
        assert.equal(largo(estado, "a"), 4);
        assert.equal(largo(estado, "b"), 4);
    });
});

describe("avisoCaminoMasLargo", () => {
    it("anuncia al nuevo dueno con el largo de su ruta", () => {
        assert.deepEqual(avisoCaminoMasLargo("Ana", 6), { jugador: "Ana", mensaje: " tiene el camino mas largo (6 caminos)" });
    });

    it("avisa cuando nadie se queda con el camino mas largo", () => {
        assert.deepEqual(avisoCaminoMasLargo(undefined, 0), { jugador: "Sistema: ", mensaje: "Nadie tiene el camino mas largo" });
    });
});
