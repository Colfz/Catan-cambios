import assert from "node:assert/strict";
import { MapSchema } from "@colyseus/schema";
import { FasePartida } from "../src/common/enums.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { Partida } from "../src/schemas/Partida.js";
import { calcularResultadoFinal } from "../src/functions/calcularResultadoFinal.js";
import { verificarVictoria } from "../src/functions/verificarVictoria.js";

function jugadorCon(nombre: string, puntuacion: number, puntosVictoria: number): Jugador {
    const jugador = new Jugador(nombre);
    jugador.puntuacion = puntuacion;
    jugador.privado.puntosVictoria = puntosVictoria;
    jugador.privado.puntosParaGanar = 10 - puntuacion - puntosVictoria;
    return jugador;
}

function mapaDe(...jugadores: [string, Jugador][]): MapSchema<Jugador> {
    const mapa = new MapSchema<Jugador>();
    for (const [id, jugador] of jugadores) mapa.set(id, jugador);
    return mapa;
}

describe("calcularResultadoFinal", () => {
    it("ordena por total de mayor a menor", () => {
        const jugadores = mapaDe(
            ["a", jugadorCon("A", 3, 0)],
            ["b", jugadorCon("B", 8, 2)],
            ["c", jugadorCon("C", 5, 1)],
        );

        const resultado = calcularResultadoFinal(jugadores);

        assert.deepEqual(resultado.map((r) => r.sessionId), ["b", "c", "a"]);
    });

    it("el total suma la puntuacion publica y las cartas de victoria", () => {
        const jugadores = mapaDe(["a", jugadorCon("A", 7, 3)]);

        const [resultado] = calcularResultadoFinal(jugadores);

        assert.equal(resultado.nombre, "A");
        assert.equal(resultado.puntosPublicos, 7);
        assert.equal(resultado.cartasVictoria, 3);
        assert.equal(resultado.total, 10);
    });

    it("un jugador sin cartas de victoria muestra 0", () => {
        const jugadores = mapaDe(["a", jugadorCon("A", 4, 0)]);

        const [resultado] = calcularResultadoFinal(jugadores);

        assert.equal(resultado.cartasVictoria, 0);
        assert.equal(resultado.total, 4);
    });

    it("en empate conserva el orden original", () => {
        const jugadores = mapaDe(
            ["a", jugadorCon("A", 4, 1)],
            ["b", jugadorCon("B", 9, 1)],
            ["c", jugadorCon("C", 5, 0)],
        );

        const resultado = calcularResultadoFinal(jugadores);

        assert.deepEqual(resultado.map((r) => r.sessionId), ["b", "a", "c"]);
    });
});

describe("verificarVictoria guarda el resultado final", () => {
    function salaFalsa(jugadores: MapSchema<Jugador>) {
        const logs: { jugador: string, mensaje: string }[] = [];
        const room = {
            jugadores,
            broadcast: (_tipo: string, mensaje: { jugador: string, mensaje: string }) => logs.push(mensaje)
        } as never;
        return { room, logs };
    }

    it("al ganar llena resultadoFinal con el ganador primero y revela sus cartas", () => {
        const ganador = jugadorCon("Ganador", 8, 2);
        const rival = jugadorCon("Rival", 6, 1);
        const jugadores = mapaDe(["rival", rival], ["ganador", ganador]);
        const partida = new Partida();
        partida.fase = FasePartida.JUEGO;
        const { room, logs } = salaFalsa(jugadores);

        verificarVictoria(partida, ganador, "ganador", room);

        assert.equal(partida.fase, FasePartida.FINALIZADA);
        assert.deepEqual(partida.resultadoFinal.map((r) => r.sessionId), ["ganador", "rival"]);
        assert.equal(partida.resultadoFinal[0].total, 10);
        assert.ok(logs.some((l) => l.jugador === "Ganador" && l.mensaje === " revela 2 cartas de punto de victoria"));
    });

    it("sin cartas de victoria no manda el log de revelar", () => {
        const ganador = jugadorCon("Ganador", 10, 0);
        const partida = new Partida();
        partida.fase = FasePartida.JUEGO;
        const { room, logs } = salaFalsa(mapaDe(["ganador", ganador]));

        verificarVictoria(partida, ganador, "ganador", room);

        assert.equal(partida.resultadoFinal.length, 1);
        assert.ok(!logs.some((l) => l.mensaje.includes("revela")));
    });

    it("no llena resultadoFinal si nadie gana", () => {
        const jugador = jugadorCon("Jugador", 7, 2);
        const partida = new Partida();
        partida.fase = FasePartida.JUEGO;
        const { room, logs } = salaFalsa(mapaDe(["jugador", jugador]));

        verificarVictoria(partida, jugador, "jugador", room);

        assert.equal(partida.resultadoFinal.length, 0);
        assert.equal(logs.length, 0);
    });
});
