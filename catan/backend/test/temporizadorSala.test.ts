import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { FaseJuego, FasePartida, Ritmo } from "../src/common/enums.js";

//* El temporizador dentro de la sala real. tick() se llama a mano, sin esperar segundos.
describe("temporizador en la sala", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(server);
    });

    after(async () => {
        await colyseus.shutdown();
    });

    async function salaEnJuego(ritmo = Ritmo.NORMAL): Promise<CatanRoom> {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });
        for (const id of ["a", "b"]) {
            sala.jugadores.set(id, new Jugador(id));
            sala.partida.ordenJugadores.push(id);
        }
        sala.partida.turnoActual = "a";
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.DADOS;
        sala.partida.ritmo = ritmo;
        return sala;
    }

    it("en el lobby no cuenta tiempo", async () => {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });

        sala.sincronizarTemporizador();

        assert.equal(sala.partida.tiempoRestante, 0);
    });

    it("al llegar a una etapa usa el tiempo del ritmo y cada tick lo reduce", async () => {
        const sala = await salaEnJuego();

        sala.sincronizarTemporizador();
        assert.equal(sala.partida.tiempoRestante, 45);

        sala.tick();
        sala.tick();
        assert.equal(sala.partida.tiempoRestante, 43);
    });

    it("al cambiar de etapa vuelve a empezar con el tiempo de la nueva etapa", async () => {
        const sala = await salaEnJuego();
        sala.sincronizarTemporizador();
        sala.tick();

        sala.partida.faseJuego = FaseJuego.ACCIONES;
        sala.sincronizarTemporizador();

        assert.equal(sala.partida.tiempoRestante, 180);
    });

    it("al cambiar de turno vuelve a empezar", async () => {
        const sala = await salaEnJuego();
        sala.partida.faseJuego = FaseJuego.ACCIONES;
        sala.sincronizarTemporizador();
        sala.tick();
        sala.tick();

        sala.ejecutarPasarTurno("a");
        sala.sincronizarTemporizador();

        assert.equal(sala.partida.turnoActual, "b");
        assert.equal(sala.partida.faseJuego, FaseJuego.DADOS);
        assert.equal(sala.partida.tiempoRestante, 45);
    });

    it("el ritmo Rapido usa la mitad del tiempo", async () => {
        const sala = await salaEnJuego(Ritmo.RAPIDO);

        sala.sincronizarTemporizador();

        assert.equal(sala.partida.tiempoRestante, 23);
    });

    it("con Sin limite no cuenta tiempo", async () => {
        const sala = await salaEnJuego(Ritmo.SIN_LIMITE);

        sala.sincronizarTemporizador();
        sala.tick();
        sala.tick();

        assert.equal(sala.partida.tiempoRestante, 0);
    });

    it("al terminar la partida se detiene", async () => {
        const sala = await salaEnJuego();
        sala.sincronizarTemporizador();
        sala.tick();

        sala.partida.fase = FasePartida.FINALIZADA;
        sala.sincronizarTemporizador();
        sala.tick();

        assert.equal(sala.partida.tiempoRestante, 0);
    });

    it("el descarte de un jugador no reinicia el tiempo de los demas", async () => {
        const sala = await salaEnJuego();
        sala.partida.faseJuego = FaseJuego.DESCARTE;
        sala.jugadores.get("a")!.recursos.set("madera", 8);
        sala.jugadores.get("b")!.recursos.set("madera", 8);
        sala.partida.jugadoresParaDescartar.set("a", 4);
        sala.partida.jugadoresParaDescartar.set("b", 4);
        sala.sincronizarTemporizador();
        sala.tick();
        sala.tick();
        sala.tick();
        assert.equal(sala.partida.tiempoRestante, 57);

        sala.ejecutarDescarte("a", { madera: 4 });
        sala.sincronizarTemporizador();

        assert.equal(sala.partida.faseJuego, FaseJuego.DESCARTE);
        assert.equal(sala.partida.tiempoRestante, 57);
    });

    it("al vencer el tiempo la cuenta vuelve a empezar aunque nada cambie", async () => {
        const sala = await salaEnJuego(Ritmo.RAPIDO);
        sala.sincronizarTemporizador();

        for (let i = 0; i < 23; i++) sala.tick();

        assert.equal(sala.partida.fase, FasePartida.JUEGO);
        assert.equal(sala.partida.tiempoRestante, 23);
    });

    it("onLeave con la partida terminada no vuelve a sacar al jugador", async () => {
        const sala = await salaEnJuego();
        sala.partida.fase = FasePartida.FINALIZADA;

        sala.onLeave({ sessionId: "b" } as never, 1000 as never);

        assert.equal(sala.jugadores.has("b"), true);
    });

    it("onLeave en juego saca al jugador y la partida termina por abandono", async () => {
        const sala = await salaEnJuego();
        sala.sincronizarTemporizador();

        sala.onLeave({ sessionId: "b" } as never, 1000 as never);

        assert.equal(sala.jugadores.has("b"), false);
        assert.equal(sala.partida.fase, FasePartida.FINALIZADA);
        assert.equal(sala.partida.tiempoRestante, 0);
    });
});
