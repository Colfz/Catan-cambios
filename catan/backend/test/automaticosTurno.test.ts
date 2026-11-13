import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { FaseJuego, FasePartida } from "../src/common/enums.js";
import { armarDescarteAleatorio } from "../src/functions/descarteAleatorio.js";
import { autoCarreteras, autoDescartar, autoLanzarDados, autoPasarTurno } from "../src/functions/automaticos/turno.js";
import { tiempoDeEtapa, Etapa } from "../src/functions/ritmos.js";
import type { Resultado, SalaAutomatica } from "../src/functions/automaticos/tipos.js";

function jugadorConRecursos(recursos: Record<string, number>): Jugador {
    const jugador = new Jugador("Prueba");
    for (const [recurso, cantidad] of Object.entries(recursos)) {
        jugador.recursos.set(recurso, cantidad);
    }
    return jugador;
}

function sumar(lote: Record<string, number>): number {
    return Object.values(lote).reduce((total, cantidad) => total + cantidad, 0);
}

describe("armarDescarteAleatorio", () => {
    const azares = [() => 0, () => 0.5, () => 0.999, Math.random];

    it("arma un lote con la suma exacta y sin exceder la mano", () => {
        const mano = { madera: 4, ladrillo: 3, trigo: 2, lana: 1, mineral: 0 };
        for (const azar of azares) {
            const lote = armarDescarteAleatorio(jugadorConRecursos(mano), 5, azar);

            assert.equal(sumar(lote), 5);
            for (const [recurso, cantidad] of Object.entries(lote)) {
                assert.ok(cantidad <= mano[recurso as keyof typeof mano], `${recurso}: ${cantidad}`);
            }
        }
    });

    it("con un solo recurso en la mano pide solo ese", () => {
        for (const azar of azares) {
            const lote = armarDescarteAleatorio(jugadorConRecursos({ madera: 9 }), 4, azar);
            assert.deepEqual(lote, { madera: 4 });
        }
    });

    it("con una mano justo de 8 cartas pide 4", () => {
        const mano = { madera: 2, ladrillo: 2, trigo: 2, lana: 2, mineral: 0 };
        for (const azar of azares) {
            const lote = armarDescarteAleatorio(jugadorConRecursos(mano), 4, azar);
            assert.equal(sumar(lote), 4);
        }
    });

    it("nunca incluye un recurso que no se tiene ni cantidades en 0", () => {
        const lote = armarDescarteAleatorio(jugadorConRecursos({ trigo: 8, lana: 0 }), 4);
        assert.deepEqual(lote, { trigo: 4 });
    });

    it("usa el azar para decidir que cartas salen", () => {
        const jugador = () => jugadorConRecursos({ madera: 5, trigo: 5 });
        assert.deepEqual(armarDescarteAleatorio(jugador(), 2, () => 0), { madera: 2 });
        assert.deepEqual(armarDescarteAleatorio(jugador(), 2, () => 0.999), { trigo: 2 });
    });

    it("si debe mas de lo que tiene, pide solo lo que tiene", () => {
        assert.deepEqual(armarDescarteAleatorio(jugadorConRecursos({ madera: 2 }), 4), { madera: 2 });
    });
});

describe("acciones automaticas del turno con una sala falsa", () => {
    function salaFalsa(error = false) {
        const llamadas: unknown[][] = [];
        const logs: { jugador: string, mensaje: string }[] = [];
        const registrar = (nombre: string) => (...argumentos: unknown[]): Resultado => {
            llamadas.push([nombre, ...argumentos]);
            return { error, mensaje: error ? "fallo" : "" };
        };
        const jugadores = new Map<string, Jugador>();
        jugadores.set("a", new Jugador("Ana"));
        const pendientes = new Map<string, number>();
        const sala = {
            partida: { turnoActual: "a", jugadoresParaDescartar: pendientes },
            jugadores,
            broadcast: (_tipo: string, mensaje: { jugador: string, mensaje: string }) => logs.push(mensaje),
            ejecutarLanzarDados: registrar("dados"),
            ejecutarPasarTurno: registrar("pasar"),
            ejecutarDescarte: (sessionId: string, recursos: Record<string, number>) => {
                // Como la sala real: al descartar sale de la lista mientras se recorre
                pendientes.delete(sessionId);
                return registrar("descarte")(sessionId, recursos);
            },
            ejecutarCancelarCarreteras: registrar("carreteras"),
        } as unknown as SalaAutomatica;
        return { sala, llamadas, logs, jugadores, pendientes };
    }

    it("autoLanzarDados lanza por el jugador del turno y lo anota", () => {
        const { sala, llamadas, logs } = salaFalsa();
        autoLanzarDados(sala);
        assert.deepEqual(llamadas, [["dados", "a"]]);
        assert.equal(logs.length, 1);
        assert.equal(logs[0].jugador, "Sistema: ");
        assert.match(logs[0].mensaje, /Se acabo el tiempo de Ana/);
    });

    it("autoPasarTurno pasa por el jugador del turno y lo anota", () => {
        const { sala, llamadas, logs } = salaFalsa();
        autoPasarTurno(sala);
        assert.deepEqual(llamadas, [["pasar", "a"]]);
        assert.match(logs[0].mensaje, /Se acabo el tiempo de Ana/);
    });

    it("autoCarreteras cancela por el jugador del turno y lo anota", () => {
        const { sala, llamadas, logs } = salaFalsa();
        autoCarreteras(sala);
        assert.deepEqual(llamadas, [["carreteras", "a"]]);
        assert.match(logs[0].mensaje, /Se acabo el tiempo de Ana/);
    });

    it("autoDescartar llama una vez por cada jugador pendiente, con su lote exacto", () => {
        const { sala, llamadas, logs, jugadores, pendientes } = salaFalsa();
        jugadores.set("b", jugadorConRecursos({ madera: 9 }));
        jugadores.set("c", jugadorConRecursos({ trigo: 8 }));
        jugadores.set("d", jugadorConRecursos({ lana: 10 }));
        pendientes.set("b", 4);
        pendientes.set("c", 4);
        pendientes.set("d", 5);

        autoDescartar(sala);

        assert.deepEqual(llamadas, [
            ["descarte", "b", { madera: 4 }],
            ["descarte", "c", { trigo: 4 }],
            ["descarte", "d", { lana: 5 }],
        ]);
        assert.equal(logs.length, 3);
    });

    it("no revienta si la sala rechaza la accion", () => {
        const { sala, jugadores, pendientes } = salaFalsa(true);
        jugadores.set("b", jugadorConRecursos({ madera: 9 }));
        pendientes.set("b", 4);
        const errorOriginal = console.error;
        console.error = () => {};
        try {
            assert.doesNotThrow(() => {
                autoLanzarDados(sala);
                autoPasarTurno(sala);
                autoCarreteras(sala);
                autoDescartar(sala);
            });
        } finally {
            console.error = errorOriginal;
        }
    });
});

describe("acciones automaticas del turno en la sala real", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(server);
    });

    after(async () => {
        await colyseus.shutdown();
    });

    async function salaEnJuego(faseJuego: FaseJuego): Promise<CatanRoom> {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });
        for (const id of ["a", "b", "c"]) {
            sala.jugadores.set(id, new Jugador(id));
            sala.partida.ordenJugadores.push(id);
        }
        sala.partida.turnoActual = "a";
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = faseJuego;
        return sala;
    }

    it("autoLanzarDados sale de la fase de dados", async () => {
        const sala = await salaEnJuego(FaseJuego.DADOS);

        autoLanzarDados(sala);

        assert.notEqual(sala.partida.faseJuego, FaseJuego.DADOS);
    });

    it("autoPasarTurno cancela la oferta, activa las cartas compradas y pasa el turno", async () => {
        const sala = await salaEnJuego(FaseJuego.ACCIONES);
        sala.partida.ofertaIntercambio.jugador = "a";
        sala.jugadores.get("a")!.cartas_inusables.set("1", 1);

        autoPasarTurno(sala);

        assert.equal(sala.partida.turnoActual, "b");
        assert.equal(sala.partida.faseJuego, FaseJuego.DADOS);
        assert.equal(sala.partida.ofertaIntercambio.jugador, "");
        assert.equal(sala.jugadores.get("a")!.cartas_usables.get("1"), 1);
    });

    it("autoDescartar deja a cada mano con lo que debe y sigue con el ladron", async () => {
        const sala = await salaEnJuego(FaseJuego.DESCARTE);
        const manoB = { madera: 3, trigo: 3, lana: 3, ladrillo: 0, mineral: 0 };
        const manoC = { madera: 4, trigo: 4, lana: 0, ladrillo: 0, mineral: 0 };
        for (const [id, mano] of [["b", manoB], ["c", manoC]] as const) {
            for (const [recurso, cantidad] of Object.entries(mano)) {
                sala.jugadores.get(id)!.recursos.set(recurso, cantidad);
            }
        }
        sala.partida.jugadoresParaDescartar.set("b", 4);
        sala.partida.jugadoresParaDescartar.set("c", 4);
        const totalBancaAntes = Array.from(sala.banca.recursos.values()).reduce((t, c) => t + c, 0);

        autoDescartar(sala);

        const total = (id: string) =>
            Array.from(sala.jugadores.get(id)!.recursos.values()).reduce((t, c) => t + c, 0);
        assert.equal(total("b"), 5);
        assert.equal(total("c"), 4);
        assert.equal(sala.partida.jugadoresParaDescartar.size, 0);
        assert.equal(sala.partida.faseJuego, FaseJuego.LADRON);
        const totalBanca = Array.from(sala.banca.recursos.values()).reduce((t, c) => t + c, 0);
        assert.equal(totalBanca, totalBancaAntes + 8);
    });

    it("autoDescartar solo descarta por quien sigue pendiente", async () => {
        const sala = await salaEnJuego(FaseJuego.DESCARTE);
        sala.jugadores.get("b")!.recursos.set("madera", 8);
        sala.jugadores.get("c")!.recursos.set("trigo", 5);
        sala.partida.jugadoresParaDescartar.set("b", 4);

        autoDescartar(sala);

        assert.equal(sala.jugadores.get("b")!.recursos.get("madera"), 4);
        assert.equal(sala.jugadores.get("c")!.recursos.get("trigo"), 5);
    });

    it("autoCarreteras pierde las que faltan y vuelve a las acciones", async () => {
        const sala = await salaEnJuego(FaseJuego.CARRETERAS);
        sala.partida.carreterasGratis = 1;

        autoCarreteras(sala);

        assert.equal(sala.partida.carreterasGratis, 0);
        assert.equal(sala.partida.faseJuego, FaseJuego.ACCIONES);
    });

    it("de punta a punta: el reloj pasa el turno solo al acabarse el tiempo", async () => {
        const sala = await salaEnJuego(FaseJuego.ACCIONES);
        sala.sincronizarTemporizador();

        for (let i = 0; i < tiempoDeEtapa(sala.partida.ritmo, Etapa.ACCIONES); i++) {
            sala.tick();
        }

        assert.equal(sala.partida.turnoActual, "b");
        assert.equal(sala.partida.faseJuego, FaseJuego.DADOS);
        assert.equal(sala.partida.tiempoRestante, tiempoDeEtapa(sala.partida.ritmo, Etapa.DADOS));
    });
});
