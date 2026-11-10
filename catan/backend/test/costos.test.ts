import assert from "node:assert/strict";
import { CatanState } from "../src/states/CatanState.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { Banca } from "../src/schemas/Banca.js";
import { Construccion, Desarrollo, FaseJuego, FasePartida } from "../src/common/enums.js";
import { COSTOS } from "../src/common/costos.js";
import { cobrarCosto, puedePagar } from "../src/functions/cobrarCosto.js";
import { comprarCarta } from "../src/functions/comprarCarta.js";
import { construirAsentamiento } from "../src/functions/construirAsentamiento.js";
import { construirCamino } from "../src/functions/construirCaminos.js";
import { construirCiudad } from "../src/functions/construirCiudad.js";

const RECURSOS = ["madera", "ladrillo", "trigo", "lana", "mineral"];

function jugadorCon(recursos: Record<string, number>): Jugador {
    const jugador = new Jugador("Prueba");
    for (const recurso of RECURSOS) jugador.recursos.set(recurso, recursos[recurso] ?? 0);
    return jugador;
}

function mano(jugador: Jugador): Record<string, number> {
    return Object.fromEntries(RECURSOS.map((r) => [r, jugador.recursos.get(r)]));
}

function bancaComo(banca: Banca): Record<string, number> {
    return Object.fromEntries(RECURSOS.map((r) => [r, banca.recursos.get(r)]));
}

//* Lo que debe quedar en la mano y en la banca despues de pagar un costo
function despuesDePagar(antes: Record<string, number>, costo: Record<string, number>, signo: number) {
    return Object.fromEntries(RECURSOS.map((r) => [r, antes[r] + signo * (costo[r] ?? 0)]));
}

describe("costos del juego", () => {
    it("estan definidos como en las reglas de Catan", () => {
        assert.deepEqual(COSTOS.CAMINO, { madera: 1, ladrillo: 1 });
        assert.deepEqual(COSTOS.ASENTAMIENTO, { madera: 1, ladrillo: 1, trigo: 1, lana: 1 });
        assert.deepEqual(COSTOS.CIUDAD, { trigo: 2, mineral: 3 });
        assert.deepEqual(COSTOS.CARTA, { trigo: 1, lana: 1, mineral: 1 });
    });
});

describe("puedePagar y cobrarCosto", () => {
    it("puede pagar con justo lo necesario y no con una carta menos", () => {
        assert.equal(puedePagar(jugadorCon({ trigo: 2, mineral: 3 }), COSTOS.CIUDAD), true);
        assert.equal(puedePagar(jugadorCon({ trigo: 2, mineral: 2 }), COSTOS.CIUDAD), false);
        assert.equal(puedePagar(jugadorCon({}), COSTOS.CAMINO), false);
    });

    it("cobrar pasa exactamente el costo de la mano a la banca", () => {
        const jugador = jugadorCon({ madera: 3, ladrillo: 2, trigo: 1, lana: 1, mineral: 0 });
        const banca = new Banca();
        const manoAntes = mano(jugador);
        const bancaAntes = bancaComo(banca);

        cobrarCosto(jugador, banca, COSTOS.ASENTAMIENTO);

        assert.deepEqual(mano(jugador), despuesDePagar(manoAntes, COSTOS.ASENTAMIENTO, -1));
        assert.deepEqual(bancaComo(banca), despuesDePagar(bancaAntes, COSTOS.ASENTAMIENTO, 1));
    });
});

//* Fijan lo que ya cobraba cada accion antes del refactor, para comprobar que no cambia
describe("cada accion cobra su costo", () => {
    it("comprar una carta cobra su costo, y sin recursos no cambia nada", () => {
        const jugador = jugadorCon({ trigo: 1, lana: 1, mineral: 1 });
        const banca = new Banca();
        banca.cartas.clear();
        banca.cartas.push(Desarrollo.CABALLERO, Desarrollo.CABALLERO);
        const bancaAntes = bancaComo(banca);

        assert.equal(comprarCarta(jugador, banca).error, false);
        assert.deepEqual(mano(jugador), despuesDePagar({ madera: 0, ladrillo: 0, trigo: 1, lana: 1, mineral: 1 }, COSTOS.CARTA, -1));
        assert.deepEqual(bancaComo(banca), despuesDePagar(bancaAntes, COSTOS.CARTA, 1));

        assert.equal(comprarCarta(jugador, banca).error, true);
        assert.equal(banca.cartas.length, 1);
    });

    it("construir un asentamiento en juego cobra su costo; en la colocacion inicial es gratis", () => {
        for (const fase of [FasePartida.JUEGO, FasePartida.PRECONSTRUCCION]) {
            const estado = new CatanState();
            estado.partida.fase = fase;
            estado.partida.faseJuego = FaseJuego.ACCIONES;
            estado.tablero.aristas.get("0,0,0")!.propietario = "a";
            const jugador = jugadorCon({ madera: 1, ladrillo: 1, trigo: 1, lana: 1 });
            const manoAntes = mano(jugador);
            const bancaAntes = bancaComo(estado.banca);

            const resultado = construirAsentamiento(
                estado.tablero.vertices, estado.tablero.aristas, estado.partida,
                0, 0, 0, jugador, estado.banca, "a");

            assert.equal(resultado.error, false);
            const signo = fase === FasePartida.JUEGO ? 1 : 0;
            assert.deepEqual(mano(jugador), despuesDePagar(manoAntes, COSTOS.ASENTAMIENTO, -signo));
            assert.deepEqual(bancaComo(estado.banca), despuesDePagar(bancaAntes, COSTOS.ASENTAMIENTO, signo));
        }
    });

    it("construir un asentamiento sin recursos falla y no cambia nada", () => {
        const estado = new CatanState();
        estado.partida.fase = FasePartida.JUEGO;
        estado.tablero.aristas.get("0,0,0")!.propietario = "a";
        const jugador = jugadorCon({ madera: 1, ladrillo: 1, trigo: 1 });

        const resultado = construirAsentamiento(
            estado.tablero.vertices, estado.tablero.aristas, estado.partida,
            0, 0, 0, jugador, estado.banca, "a");

        assert.equal(resultado.error, true);
        assert.deepEqual(mano(jugador), { madera: 1, ladrillo: 1, trigo: 1, lana: 0, mineral: 0 });
    });

    it("construir un camino en acciones cobra su costo; con carreteras gratis no", () => {
        for (const faseJuego of [FaseJuego.ACCIONES, FaseJuego.CARRETERAS]) {
            const estado = new CatanState();
            estado.partida.fase = FasePartida.JUEGO;
            estado.partida.faseJuego = faseJuego;
            const vertice = estado.tablero.vertices.get("0,0,0")!;
            vertice.propietario = "a";
            vertice.setConstruccion(Construccion.ASENTAMIENTO);
            const jugador = jugadorCon({ madera: 1, ladrillo: 1 });
            const manoAntes = mano(jugador);
            const bancaAntes = bancaComo(estado.banca);

            const resultado = construirCamino(
                estado.tablero.vertices, estado.tablero.aristas, estado.partida,
                0, 0, 1, jugador, estado.banca, "a");

            assert.equal(resultado.error, false, resultado.mensaje);
            const signo = faseJuego === FaseJuego.ACCIONES ? 1 : 0;
            assert.deepEqual(mano(jugador), despuesDePagar(manoAntes, COSTOS.CAMINO, -signo));
            assert.deepEqual(bancaComo(estado.banca), despuesDePagar(bancaAntes, COSTOS.CAMINO, signo));
        }
    });

    it("construir un camino sin recursos falla y no cambia nada", () => {
        const estado = new CatanState();
        estado.partida.fase = FasePartida.JUEGO;
        estado.partida.faseJuego = FaseJuego.ACCIONES;
        estado.tablero.vertices.get("0,0,0")!.propietario = "a";
        const jugador = jugadorCon({ madera: 1 });

        const resultado = construirCamino(
            estado.tablero.vertices, estado.tablero.aristas, estado.partida,
            0, 0, 1, jugador, estado.banca, "a");

        assert.equal(resultado.error, true);
        assert.equal(estado.tablero.aristas.get("0,0,1")!.propietario, "");
        assert.deepEqual(mano(jugador), { madera: 1, ladrillo: 0, trigo: 0, lana: 0, mineral: 0 });
    });

    it("construir una ciudad cobra su costo, y sin recursos no cambia nada", () => {
        const estado = new CatanState();
        const vertice = estado.tablero.vertices.get("0,0,0")!;
        vertice.propietario = "a";
        vertice.setConstruccion(Construccion.ASENTAMIENTO);
        const pobre = jugadorCon({ trigo: 2, mineral: 2 });

        assert.equal(construirCiudad(estado.tablero.vertices, 0, 0, 0, pobre, estado.banca, "a").error, true);
        assert.equal(vertice.constuccion, Construccion.ASENTAMIENTO);

        const jugador = jugadorCon({ trigo: 3, mineral: 3 });
        const bancaAntes = bancaComo(estado.banca);
        assert.equal(construirCiudad(estado.tablero.vertices, 0, 0, 0, jugador, estado.banca, "a").error, false);
        assert.deepEqual(mano(jugador), despuesDePagar({ madera: 0, ladrillo: 0, trigo: 3, lana: 0, mineral: 3 }, COSTOS.CIUDAD, -1));
        assert.deepEqual(bancaComo(estado.banca), despuesDePagar(bancaAntes, COSTOS.CIUDAD, 1));
    });
});
