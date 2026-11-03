import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { FaseJuego, FasePartida, FasePreconstruccion } from "../src/common/enums.js";

//* Pruebas de las acciones del juego que el servidor puede ejecutar sin un cliente
describe("acciones del juego en la sala (ejecutar*)", () => {
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
        return sala;
    }

    it("lanzar dados rechaza al que no tiene el turno y la fase equivocada", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.DADOS;

        assert.equal(sala.ejecutarLanzarDados("b").error, true);

        sala.partida.faseJuego = FaseJuego.ACCIONES;
        const resultado = sala.ejecutarLanzarDados("a");
        assert.equal(resultado.error, true);
        assert.equal(resultado.mensaje, "Ya lanzaste los dados");
    });

    it("lanzar dados avanza a una etapa valida (acciones, descarte o ladron)", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.DADOS;

        const resultado = sala.ejecutarLanzarDados("a");

        assert.equal(resultado.error, false);
        assert.ok([FaseJuego.ACCIONES, FaseJuego.LADRON, FaseJuego.DESCARTE].includes(sala.partida.faseJuego));
    });

    it("pasar turno cambia el turno, habilita las cartas y cancela la oferta", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.ACCIONES;
        sala.partida.cartaJugable = false;

        assert.equal(sala.ejecutarPasarTurno("b").error, true);
        const resultado = sala.ejecutarPasarTurno("a");

        assert.equal(resultado.error, false);
        assert.equal(sala.partida.turnoActual, "b");
        assert.equal(sala.partida.faseJuego, FaseJuego.DADOS);
        assert.equal(sala.partida.cartaJugable, true);
    });

    it("descartar por lote deja la fase del ladron cuando nadie mas debe descartar", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.DESCARTE;
        const jugador = sala.jugadores.get("b")!;
        jugador.recursos.set("madera", 6);
        jugador.recursos.set("trigo", 2);
        sala.partida.jugadoresParaDescartar.set("b", 4);

        assert.equal(sala.ejecutarDescarte("a", { madera: 4 }).error, true);
        assert.equal(sala.ejecutarDescarte("b", { madera: 3 }).error, true);
        const resultado = sala.ejecutarDescarte("b", { madera: 4 });

        assert.equal(resultado.error, false);
        assert.equal(jugador.recursos.get("madera"), 2);
        assert.equal(sala.partida.jugadoresParaDescartar.size, 0);
        assert.equal(sala.partida.faseJuego, FaseJuego.LADRON);
    });

    it("mover el ladron a un hexagono sin vecinos vuelve a las acciones", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.LADRON;
        const destino = Array.from(sala.tablero.hexagonos.values()).find((hex) => !hex.esLadron)!;

        assert.equal(sala.ejecutarMoverLadron("b", destino.h, destino.d).error, true);
        const resultado = sala.ejecutarMoverLadron("a", destino.h, destino.d);

        assert.equal(resultado.error, false);
        assert.equal(sala.partida.faseJuego, FaseJuego.ACCIONES);
        assert.equal(sala.tablero.ladron.h, destino.h);
    });

    it("robar solo acepta a un jugador de la lista y vuelve a la fase de origen", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.ROBO;
        sala.partida.jugadoresParaRobar.push("b");
        sala.jugadores.get("b")!.recursos.set("lana", 2);

        assert.equal(sala.ejecutarRobar("a", "otro").error, true);
        const resultado = sala.ejecutarRobar("a", "b");

        assert.equal(resultado.error, false);
        assert.equal(sala.jugadores.get("b")!.recursos.get("lana"), 1);
        assert.equal(sala.partida.faseJuego, FaseJuego.ACCIONES);
        assert.equal(sala.partida.jugadoresParaRobar.length, 0);
    });

    it("cancelar las carreteras gratis pierde las que faltan y vuelve a las acciones", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.CARRETERAS;
        sala.partida.carreterasGratis = 2;

        assert.equal(sala.ejecutarCancelarCarreteras("b").error, true);
        const resultado = sala.ejecutarCancelarCarreteras("a");

        assert.equal(resultado.error, false);
        assert.equal(sala.partida.carreterasGratis, 0);
        assert.equal(sala.partida.faseJuego, FaseJuego.ACCIONES);
    });

    it("en la colocacion inicial el asentamiento pasa a colocar el camino", async () => {
        const sala = await salaConDosJugadores();
        sala.partida.fase = FasePartida.PRECONSTRUCCION;
        sala.partida.fasePreconstruccion = FasePreconstruccion.ASENTAMIENTO;

        const [h, d, p] = "0,0,0".split(",").map(Number);
        assert.equal(sala.ejecutarColocarCamino("a", h, d, p).error, true);
        const resultado = sala.ejecutarColocarAsentamiento("a", h, d, p);

        assert.equal(resultado.error, false);
        assert.equal(sala.partida.fasePreconstruccion, FasePreconstruccion.CAMINO);
    });
});
