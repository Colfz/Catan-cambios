import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { FaseJuego, FasePartida, Ritmo } from "../src/common/enums.js";
import { verticesDelHexagono } from "../src/functions/verticesDelHexagono.js";
import { autoMoverLadron, autoRobar, elegirHexagonoDistinto, elegirVictima } from "../src/functions/automaticos/ladron.js";

describe("elegirHexagonoDistinto", () => {
    const hexagonos = [{ h: 0, d: 0 }, { h: 1, d: 0 }, { h: 0, d: 1 }];

    it("nunca elige el hexagono donde esta el ladron", () => {
        for (const azar of [0, 0.34, 0.5, 0.99]) {
            const elegido = elegirHexagonoDistinto(hexagonos, { h: 1, d: 0 }, () => azar)!;
            assert.notDeepEqual(elegido, { h: 1, d: 0 });
        }
    });

    it("usa el azar para escoger entre los demas", () => {
        assert.deepEqual(elegirHexagonoDistinto(hexagonos, { h: 0, d: 0 }, () => 0), { h: 1, d: 0 });
        assert.deepEqual(elegirHexagonoDistinto(hexagonos, { h: 0, d: 0 }, () => 0.99), { h: 0, d: 1 });
    });

    it("devuelve null si no hay otro hexagono", () => {
        assert.equal(elegirHexagonoDistinto([{ h: 0, d: 0 }], { h: 0, d: 0 }), null);
        assert.equal(elegirHexagonoDistinto([], { h: 0, d: 0 }), null);
    });
});

describe("elegirVictima", () => {
    it("elige segun el azar", () => {
        assert.equal(elegirVictima(["a", "b", "c"], () => 0), "a");
        assert.equal(elegirVictima(["a", "b", "c"], () => 0.5), "b");
        assert.equal(elegirVictima(["a", "b", "c"], () => 0.99), "c");
    });

    it("devuelve null con la lista vacia", () => {
        assert.equal(elegirVictima([]), null);
    });
});

describe("acciones automaticas del ladron en la sala", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(server);
    });

    after(async () => {
        await colyseus.shutdown();
    });

    async function salaConDosJugadores(): Promise<CatanRoom> {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });
        for (const id of ["a", "b"]) {
            sala.jugadores.set(id, new Jugador(id));
            sala.partida.ordenJugadores.push(id);
        }
        sala.partida.turnoActual = "a";
        sala.partida.fase = FasePartida.JUEGO;
        return sala;
    }

    it("autoMoverLadron mueve el ladron a otro hexagono y sigue con las acciones", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.faseJuego = FaseJuego.LADRON;
        const antes = { h: sala.tablero.ladron.h, d: sala.tablero.ladron.d };

        autoMoverLadron(sala);

        assert.notDeepEqual({ h: sala.tablero.ladron.h, d: sala.tablero.ladron.d }, antes);
        assert.equal(sala.partida.faseJuego, FaseJuego.ACCIONES);
    });

    it("autoMoverLadron avisa en el registro de que se acabo el tiempo", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.faseJuego = FaseJuego.LADRON;
        const registro: string[] = [];
        const original = sala.broadcast.bind(sala);
        sala.broadcast = ((tipo: string, mensaje?: { mensaje?: string }) => {
            if (tipo === "log" && mensaje?.mensaje) registro.push(mensaje.mensaje);
            return original(tipo, mensaje);
        }) as typeof sala.broadcast;

        autoMoverLadron(sala);

        assert.ok(registro.some((linea) => linea.startsWith("Se acabo el tiempo de a")));
    });

    it("autoMoverLadron pasa a robar cuando hay 2 o mas victimas", async () => {
        const sala = await salaConDosJugadores();
        sala.jugadores.set("c", new Jugador("c"));
        sala.partida.ordenJugadores.push("c");
        sala.partida.faseJuego = FaseJuego.LADRON;
        //* Todos los hexagonos donde pueda caer el ladron quedan junto a dos rivales con cartas
        for (const hexagono of sala.tablero.hexagonos.values()) {
            const vertices = verticesDelHexagono(sala.tablero.vertices, hexagono);
            vertices[0].propietario = "b";
            vertices[1].propietario = "c";
        }
        sala.jugadores.get("b")!.recursos.set("lana", 1);
        sala.jugadores.get("c")!.recursos.set("trigo", 1);

        autoMoverLadron(sala);

        assert.equal(sala.partida.faseJuego, FaseJuego.ROBO);
        assert.equal(sala.partida.jugadoresParaRobar.length, 2);
    });

    it("autoRobar roba una carta y vuelve a las acciones despues de un 7", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.faseJuego = FaseJuego.ROBO;
        sala.faseRetornoLadron = FaseJuego.ACCIONES;
        sala.partida.jugadoresParaRobar.push("b");
        sala.jugadores.get("b")!.recursos.set("lana", 2);

        autoRobar(sala);

        assert.equal(sala.jugadores.get("b")!.recursos.get("lana"), 1);
        assert.equal(sala.jugadores.get("a")!.recursos.get("lana"), 1);
        assert.equal(sala.partida.faseJuego, FaseJuego.ACCIONES);
        assert.equal(sala.partida.jugadoresParaRobar.length, 0);
    });

    it("autoRobar vuelve a los dados si el caballero se jugo antes de tirar", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.faseJuego = FaseJuego.ROBO;
        sala.faseRetornoLadron = FaseJuego.DADOS;
        sala.partida.jugadoresParaRobar.push("b");
        sala.jugadores.get("b")!.recursos.set("mineral", 1);

        autoRobar(sala);

        assert.equal(sala.jugadores.get("a")!.recursos.get("mineral"), 1);
        assert.equal(sala.partida.faseJuego, FaseJuego.DADOS);
    });

    it("autoRobar no hace nada si no hay victimas", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.faseJuego = FaseJuego.ROBO;

        autoRobar(sala);

        assert.equal(sala.partida.faseJuego, FaseJuego.ROBO);
    });

    it("de punta a punta: si nadie mueve el ladron, el reloj lo mueve solo", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.ritmo = Ritmo.RAPIDO;
        sala.partida.faseJuego = FaseJuego.LADRON;
        const antes = { h: sala.tablero.ladron.h, d: sala.tablero.ladron.d };
        sala.sincronizarTemporizador();
        assert.equal(sala.partida.tiempoRestante, 23);

        for (let i = 0; i < 23; i++) sala.tick();

        assert.notDeepEqual({ h: sala.tablero.ladron.h, d: sala.tablero.ladron.d }, antes);
        assert.equal(sala.partida.faseJuego, FaseJuego.ACCIONES);
        //* Y empieza el tiempo de la etapa siguiente
        assert.equal(sala.partida.tiempoRestante, 90);
    });

    it("de punta a punta: si nadie elige a quien robar, el reloj lo elige solo", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.ritmo = Ritmo.RAPIDO;
        sala.partida.faseJuego = FaseJuego.ROBO;
        sala.faseRetornoLadron = FaseJuego.DADOS;
        sala.partida.jugadoresParaRobar.push("b");
        sala.jugadores.get("b")!.recursos.set("madera", 1);
        sala.sincronizarTemporizador();

        for (let i = 0; i < 15; i++) sala.tick();

        assert.equal(sala.jugadores.get("a")!.recursos.get("madera"), 1);
        assert.equal(sala.partida.faseJuego, FaseJuego.DADOS);
    });
});
