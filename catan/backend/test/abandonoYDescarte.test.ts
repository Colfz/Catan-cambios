import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { CatanState } from "../src/states/CatanState.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { FaseJuego, FasePartida } from "../src/common/enums.js";
import { sacarJugador } from "../src/functions/sacarJugador.js";

describe("tabla final al ganar por abandono", () => {
    function partidaCon(ids: string[]): CatanState {
        const estado = new CatanState();
        for (const id of ids) {
            estado.jugadores.set(id, new Jugador(id));
            estado.partida.ordenJugadores.push(id);
        }
        estado.partida.fase = FasePartida.JUEGO;
        estado.partida.turnoActual = ids[0];
        return estado;
    }

    const salir = (estado: CatanState, id: string) =>
        sacarJugador(estado.partida, estado.tablero, estado.banca, estado.jugadores, id);

    it("si solo queda uno, gana y la tabla final muestra sus puntos con los ocultos", () => {
        const estado = partidaCon(["a", "b", "c"]);
        const a = estado.jugadores.get("a")!;
        a.puntuacion = 6;
        a.privado.puntosVictoria = 2;

        salir(estado, "b");
        salir(estado, "c");

        assert.equal(estado.partida.fase, FasePartida.FINALIZADA);
        assert.equal(estado.partida.ganador, "a");
        assert.equal(estado.partida.resultadoFinal.length, 1);
        const [fila] = estado.partida.resultadoFinal;
        assert.equal(fila.sessionId, "a");
        assert.equal(fila.puntosPublicos, 6);
        assert.equal(fila.cartasVictoria, 2);
        assert.equal(fila.total, 8);
    });

    it("si todavia quedan dos o mas, no hay tabla final", () => {
        const estado = partidaCon(["a", "b", "c"]);

        salir(estado, "c");

        assert.equal(estado.partida.fase, FasePartida.JUEGO);
        assert.equal(estado.partida.resultadoFinal.length, 0);
    });
});

describe("el descarte solo acepta el formato por lote", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(server);
    });

    after(async () => {
        await colyseus.shutdown();
    });

    async function salaEnDescarte(): Promise<CatanRoom> {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });
        for (const id of ["a", "b"]) {
            sala.jugadores.set(id, new Jugador(id));
            sala.partida.ordenJugadores.push(id);
        }
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.DESCARTE;
        sala.partida.turnoActual = "a";
        sala.jugadores.get("a")!.recursos.set("madera", 8);
        sala.partida.jugadoresParaDescartar.set("a", 4);
        return sala;
    }

    function enviar(sala: CatanRoom, mensaje: unknown): string | undefined {
        const errores: string[] = [];
        const cliente = { sessionId: "a", send: (_t: string, m: { mensajeError: string }) => errores.push(m.mensajeError) };
        (sala.messages as Record<string, (c: unknown, m: unknown) => void>).msgDescartarRecursos(cliente, mensaje);
        return errores[0];
    }

    it("el formato viejo de una carta ya no descarta nada", async () => {
        const sala = await salaEnDescarte();

        assert.equal(enviar(sala, { recurso: "madera" }), "El descarte no es valido");
        assert.equal(sala.jugadores.get("a")!.recursos.get("madera"), 8);
        assert.equal(sala.partida.jugadoresParaDescartar.get("a"), 4);
    });

    it("el lote completo sigue funcionando", async () => {
        const sala = await salaEnDescarte();

        assert.equal(enviar(sala, { recursos: { madera: 4 } }), undefined);
        assert.equal(sala.jugadores.get("a")!.recursos.get("madera"), 4);
        assert.equal(sala.partida.jugadoresParaDescartar.has("a"), false);
        assert.equal(sala.partida.faseJuego, FaseJuego.LADRON);
    });
});
