import assert from "node:assert/strict";
import { MapSchema } from "@colyseus/schema";
import { Desarrollo, FasePartida } from "../src/common/enums.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { Banca } from "../src/schemas/Banca.js";
import { Partida } from "../src/schemas/Partida.js";
import { comprarCarta } from "../src/functions/comprarCarta.js";
import { verificarVictoria } from "../src/functions/verificarVictoria.js";

function jugadorConRecursosParaComprar(): Jugador {
    const jugador = new Jugador("Prueba");
    jugador.recursos.set("trigo", 5);
    jugador.recursos.set("lana", 5);
    jugador.recursos.set("mineral", 5);
    return jugador;
}

function bancaConCarta(carta: Desarrollo): Banca {
    const banca = new Banca();
    banca.cartas.clear();
    banca.cartas.push(carta);
    return banca;
}

describe("carta de punto de victoria", () => {
    it("queda oculta en el dato privado y baja los puntos que faltan", () => {
        const jugador = jugadorConRecursosParaComprar();
        const banca = bancaConCarta(Desarrollo.PUNTOS_VICTORIA);

        const resultado = comprarCarta(jugador, banca);

        assert.equal(resultado.error, false);
        assert.equal(jugador.privado.puntosVictoria, 1);
        assert.equal(jugador.privado.puntosParaGanar, 9);
    });

    it("no cambia nada visible para los rivales", () => {
        const jugador = jugadorConRecursosParaComprar();
        const banca = bancaConCarta(Desarrollo.PUNTOS_VICTORIA);

        comprarCarta(jugador, banca);

        assert.equal(jugador.puntuacion, 0);
        assert.equal(jugador.cartas_inusables.get(`${Desarrollo.PUNTOS_VICTORIA}`), 0);
        assert.equal(jugador.recursos.get("trigo"), 4);
        assert.equal(banca.cartas.length, 0);
    });

    it("otra carta se guarda como siempre y no toca los contadores privados", () => {
        const jugador = jugadorConRecursosParaComprar();
        const banca = bancaConCarta(Desarrollo.CABALLERO);

        comprarCarta(jugador, banca);

        assert.equal(jugador.cartas_inusables.get(`${Desarrollo.CABALLERO}`), 1);
        assert.equal(jugador.privado.puntosVictoria, 0);
        assert.equal(jugador.privado.puntosParaGanar, 10);
    });
});

describe("verificarVictoria con puntos ocultos", () => {
    function salaFalsa() {
        const logs: unknown[] = [];
        return { room: { jugadores: new MapSchema<Jugador>(), broadcast: (_tipo: string, mensaje: unknown) => logs.push(mensaje) } as never, logs };
    }

    it("gana cuando los puntos que faltan llegan a 0", () => {
        const partida = new Partida();
        partida.fase = FasePartida.JUEGO;
        const jugador = new Jugador("Ganador");
        jugador.privado.puntosParaGanar = 0;
        const { room, logs } = salaFalsa();

        verificarVictoria(partida, jugador, "ganador", room);

        assert.equal(partida.ganador, "ganador");
        assert.equal(partida.fase, FasePartida.FINALIZADA);
        assert.equal(logs.length, 1);
    });

    it("no gana mientras falte algun punto", () => {
        const partida = new Partida();
        partida.fase = FasePartida.JUEGO;
        const jugador = new Jugador("Jugador");
        jugador.privado.puntosParaGanar = 1;
        const { room } = salaFalsa();

        verificarVictoria(partida, jugador, "jugador", room);

        assert.equal(partida.ganador, "");
        assert.equal(partida.fase, FasePartida.JUEGO);
    });
});
