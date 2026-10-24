import assert from "node:assert/strict";
import { CatanState } from "../src/states/CatanState.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { Banca } from "../src/schemas/Banca.js";
import { descartarRecursosLote } from "../src/functions/descartarRecursosLote.js";
import { moverLadron } from "../src/functions/moverLadron.js";
import { robarJugador } from "../src/functions/robarJugador.js";
import { darRecursosJugador } from "../src/functions/darRecursosJugador.js";
import { verticesDelHexagono } from "../src/functions/verticesDelHexagono.js";

function jugadorConRecursos(recursos: Record<string, number>): Jugador {
    const jugador = new Jugador("Prueba");
    for (const [recurso, cantidad] of Object.entries(recursos)) {
        jugador.recursos.set(recurso, cantidad);
    }
    return jugador;
}

function total(jugador: Jugador): number {
    let suma = 0;
    jugador.recursos.forEach((cantidad) => { suma += cantidad; });
    return suma;
}

describe("descartarRecursosLote", () => {
    it("descarta varias cartas en un solo paso y las manda a la banca", () => {
        const jugador = jugadorConRecursos({ madera: 4, ladrillo: 3, trigo: 2 });
        const banca = new Banca();
        const maderaBanca = banca.recursos.get("madera");

        const resultado = descartarRecursosLote(jugador, banca, { madera: 3, trigo: 1 }, 4);

        assert.equal(resultado.error, false);
        assert.equal(jugador.recursos.get("madera"), 1);
        assert.equal(jugador.recursos.get("trigo"), 1);
        assert.equal(jugador.recursos.get("ladrillo"), 3);
        assert.equal(banca.recursos.get("madera"), maderaBanca + 3);
    });

    it("rechaza un lote que no suma las cartas debidas y no cambia nada", () => {
        const jugador = jugadorConRecursos({ madera: 4, ladrillo: 3 });
        const banca = new Banca();

        const resultado = descartarRecursosLote(jugador, banca, { madera: 2 }, 3);

        assert.equal(resultado.error, true);
        assert.equal(total(jugador), 7);
    });

    it("rechaza descartar mas cartas de las que tiene sin descartar nada", () => {
        const jugador = jugadorConRecursos({ madera: 1, ladrillo: 8 });
        const banca = new Banca();

        const resultado = descartarRecursosLote(jugador, banca, { madera: 2, ladrillo: 2 }, 4);

        assert.equal(resultado.error, true);
        assert.equal(jugador.recursos.get("madera"), 1);
        assert.equal(jugador.recursos.get("ladrillo"), 8);
    });

    it("rechaza recursos inventados y cantidades invalidas", () => {
        const jugador = jugadorConRecursos({ madera: 8 });
        const banca = new Banca();

        assert.equal(descartarRecursosLote(jugador, banca, { oro: 4 }, 4).error, true);
        assert.equal(descartarRecursosLote(jugador, banca, { madera: -4 }, -4).error, true);
        assert.equal(descartarRecursosLote(jugador, banca, { madera: 1.5 }, 1.5).error, true);
        assert.equal(descartarRecursosLote(jugador, banca, null as never, 4).error, true);
        assert.equal(total(jugador), 8);
    });
});

describe("moverLadron", () => {
    it("rechaza mover el ladron al mismo hexagono", () => {
        const estado = new CatanState();
        const { h, d } = estado.tablero.ladron;

        const resultado = moverLadron(estado.tablero, estado.jugadores, "a", h, d);

        assert.equal(resultado.error, true);
    });

    it("rechaza un hexagono que no existe", () => {
        const estado = new CatanState();

        const resultado = moverLadron(estado.tablero, estado.jugadores, "a", 99, 99);

        assert.equal(resultado.error, true);
    });

    it("mueve el ladron y solo lista victimas con cartas que no sean el jugador", () => {
        const estado = new CatanState();
        const destino = Array.from(estado.tablero.hexagonos.values())
            .find((hex) => !hex.esLadron)!;
        const vertices = verticesDelHexagono(estado.tablero.vertices, destino);

        estado.jugadores.set("yo", jugadorConRecursos({ madera: 2 }));
        estado.jugadores.set("conCartas", jugadorConRecursos({ trigo: 1 }));
        estado.jugadores.set("sinCartas", jugadorConRecursos({}));
        vertices[0].propietario = "yo";
        vertices[1].propietario = "conCartas";
        vertices[2].propietario = "sinCartas";

        const resultado = moverLadron(estado.tablero, estado.jugadores, "yo", destino.h, destino.d);

        assert.equal(resultado.error, false);
        assert.deepEqual(resultado.jugadoresInvolucrados, ["conCartas"]);
        assert.equal(estado.tablero.ladron.h, destino.h);
        assert.equal(estado.tablero.ladron.d, destino.d);
        assert.equal(destino.esLadron, true);
    });
});

describe("robarJugador", () => {
    it("pasa exactamente una carta del robado al receptor", () => {
        const receptor = jugadorConRecursos({});
        const robado = jugadorConRecursos({ lana: 3 });

        robarJugador(receptor, robado);

        assert.equal(total(receptor), 1);
        assert.equal(robado.recursos.get("lana"), 2);
    });

    it("no hace nada si el robado no tiene cartas", () => {
        const receptor = jugadorConRecursos({});
        const robado = jugadorConRecursos({});

        robarJugador(receptor, robado);

        assert.equal(total(receptor), 0);
    });
});

describe("produccion con el ladron", () => {
    function escenario() {
        const estado = new CatanState();
        const hexagono = Array.from(estado.tablero.hexagonos.values())
            .find((hex) => !hex.esLadron)!;
        const vertice = verticesDelHexagono(estado.tablero.vertices, hexagono)[0];
        const jugador = jugadorConRecursos({});
        estado.jugadores.set("yo", jugador);
        vertice.propietario = "yo";
        vertice.constuccion = 1;
        return { estado, hexagono, vertice, jugador };
    }

    it("el hexagono sin ladron entrega recursos (control)", () => {
        const { estado, hexagono, vertice, jugador } = escenario();

        darRecursosJugador(hexagono, vertice, estado.jugadores, estado.banca, estado.tablero.ladron);

        assert.equal(total(jugador), 1);
    });

    it("el hexagono con el ladron no entrega recursos", () => {
        const { estado, hexagono, vertice, jugador } = escenario();
        estado.tablero.ladron.h = hexagono.h;
        estado.tablero.ladron.d = hexagono.d;

        darRecursosJugador(hexagono, vertice, estado.jugadores, estado.banca, estado.tablero.ladron);

        assert.equal(total(jugador), 0);
    });
});
