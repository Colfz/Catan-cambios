import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { FaseJuego, FasePartida, Ritmo } from "../src/common/enums.js";
import { ritmoValido } from "../src/functions/ritmos.js";

describe("ritmoValido", () => {
    it("acepta los tres ritmos", () => {
        assert.equal(ritmoValido(Ritmo.NORMAL), Ritmo.NORMAL);
        assert.equal(ritmoValido(Ritmo.RAPIDO), Ritmo.RAPIDO);
        assert.equal(ritmoValido(Ritmo.SIN_LIMITE), Ritmo.SIN_LIMITE);
    });

    it("acepta el ritmo escrito como texto", () => {
        assert.equal(ritmoValido("2"), Ritmo.RAPIDO);
        assert.equal(ritmoValido("3"), Ritmo.SIN_LIMITE);
    });

    it("si falta o no es valido usa el Normal", () => {
        for (const valor of [undefined, null, 0, 4, -1, 1.5, "abc", "", {}, [], true]) {
            assert.equal(ritmoValido(valor), Ritmo.NORMAL);
        }
    });
});

describe("ritmo elegido al crear la sala", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(server);
    });

    after(async () => {
        await colyseus.shutdown();
    });

    async function salaEnJuego(opciones: Record<string, unknown>): Promise<CatanRoom> {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion", ...opciones });
        for (const id of ["a", "b"]) {
            sala.jugadores.set(id, new Jugador(id));
            sala.partida.ordenJugadores.push(id);
        }
        sala.partida.turnoActual = "a";
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.DADOS;
        return sala;
    }

    it("sin ritmo la sala usa el Normal", async () => {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });

        assert.equal(sala.partida.ritmo, Ritmo.NORMAL);
    });

    it("guarda el ritmo que eligio quien creo la sala", async () => {
        const rapida = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion", ritmo: Ritmo.RAPIDO });
        const libre = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion", ritmo: Ritmo.SIN_LIMITE });

        assert.equal(rapida.partida.ritmo, Ritmo.RAPIDO);
        assert.equal(libre.partida.ritmo, Ritmo.SIN_LIMITE);
    });

    it("un ritmo invalido se cambia por el Normal", async () => {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion", ritmo: 99 });

        assert.equal(sala.partida.ritmo, Ritmo.NORMAL);
    });

    it("la partida se juega con los tiempos del ritmo elegido", async () => {
        const normal = await salaEnJuego({ ritmo: Ritmo.NORMAL });
        const rapida = await salaEnJuego({ ritmo: Ritmo.RAPIDO });

        normal.sincronizarTemporizador();
        rapida.sincronizarTemporizador();

        assert.equal(normal.partida.tiempoRestante, 45);
        assert.equal(rapida.partida.tiempoRestante, 23);
    });

    it("con Sin limite no cuenta el tiempo ni hay acciones automaticas", async () => {
        const sala = await salaEnJuego({ ritmo: Ritmo.SIN_LIMITE });
        sala.sincronizarTemporizador();

        for (let i = 0; i < 400; i++) sala.tick();

        assert.equal(sala.partida.tiempoRestante, 0);
        assert.equal(sala.partida.faseJuego, FaseJuego.DADOS);
        assert.equal(sala.partida.turnoActual, "a");
    });
});
