import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { CatanState } from "../src/states/CatanState.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { Construccion, FaseJuego, FasePartida, FasePreconstruccion, Terreno } from "../src/common/enums.js";
import { verticesPos0, verticesPos1 } from "../src/functions/construirAsentamiento.js";
import { aristasConectadas, elegirArista, elegirVertice } from "../src/functions/colocacionAleatoria.js";
import { autoColocar } from "../src/functions/automaticos/colocacion.js";
import { tiempoDeEtapa, Etapa } from "../src/functions/ritmos.js";
import type { Resultado, SalaAutomatica } from "../src/functions/automaticos/tipos.js";

//* La regla de distancia, vista desde un vertice ya ocupado: ningun vecino puede estar ocupado
function cumpleDistancia(estado: CatanState, llave: string): boolean {
    const [h, d, p] = llave.split(",").map(Number);
    const vertice = estado.tablero.vertices.get(llave)!;
    const dueno = vertice.propietario;
    vertice.propietario = "";
    const libre = p === 0 ? verticesPos0(estado.tablero.vertices, h, d) : verticesPos1(estado.tablero.vertices, h, d);
    vertice.propietario = dueno;
    return libre;
}

describe("elegirVertice", () => {
    it("los asentamientos de 4 jugadores, dos cada uno, nunca quedan pegados", () => {
        for (let partida = 0; partida < 20; partida++) {
            const estado = new CatanState();
            const ocupados: string[] = [];
            for (let i = 0; i < 8; i++) {
                const llave = elegirVertice(estado.tablero.vertices)!;
                assert.ok(llave, "siempre hay un lugar libre");
                estado.tablero.vertices.get(llave)!.propietario = `j${i % 4}`;
                ocupados.push(llave);
            }
            for (const llave of ocupados) {
                assert.ok(cumpleDistancia(estado, llave), `${llave} quedo pegado a otro asentamiento`);
            }
        }
    });

    it("nunca elige un vertice ocupado ni pegado a uno ocupado", () => {
        const estado = new CatanState();
        const ocupado = "0,0,0";
        estado.tablero.vertices.get(ocupado)!.propietario = "otro";

        for (let azar = 0; azar < 1; azar += 0.01) {
            const llave = elegirVertice(estado.tablero.vertices, () => azar)!;
            assert.notEqual(llave, ocupado);
            assert.ok(cumpleDistancia(estado, llave), `${llave} esta pegado al ocupado`);
        }
    });

    it("devuelve null si no queda ningun lugar valido", () => {
        const estado = new CatanState();
        estado.tablero.vertices.forEach((vertice) => { vertice.propietario = "otro"; });

        assert.equal(elegirVertice(estado.tablero.vertices), null);
    });
});

describe("elegirArista", () => {
    it("las aristas candidatas son las tres que tocan al asentamiento", () => {
        assert.deepEqual(aristasConectadas("0,0,0").sort(), ["0,0,0", "0,0,1", "1,-1,2"].sort());
        assert.deepEqual(aristasConectadas("0,0,1").sort(), ["-1,0,0", "0,0,1", "0,0,2"].sort());
    });

    it("elige una arista libre que existe y toca al ultimo asentamiento", () => {
        const estado = new CatanState();
        for (const llave of Array.from(estado.tablero.vertices.keys())) {
            const arista = elegirArista(estado.tablero.aristas, llave);
            if (arista === null) continue;
            assert.ok(estado.tablero.aristas.has(arista));
            assert.ok(aristasConectadas(llave).includes(arista));
        }
    });

    it("no elige una arista ocupada", () => {
        const estado = new CatanState();
        const libres = aristasConectadas("0,0,0").filter((a) => estado.tablero.aristas.has(a));
        libres.slice(1).forEach((a) => { estado.tablero.aristas.get(a)!.propietario = "otro"; });

        for (const azar of [0, 0.5, 0.99]) {
            assert.equal(elegirArista(estado.tablero.aristas, "0,0,0", () => azar), libres[0]);
        }
    });
});

describe("autoColocar con una sala falsa", () => {
    function salaFalsa(fase: FasePreconstruccion, error = false) {
        const llamadas: string[] = [];
        const logs: { jugador: string, mensaje: string }[] = [];
        const estado = new CatanState();
        const jugador = new Jugador("Ana");
        jugador.ultimoAsentamiento = "0,0,0";
        estado.jugadores.set("a", jugador);
        estado.partida.fase = FasePartida.PRECONSTRUCCION;
        estado.partida.fasePreconstruccion = fase;
        estado.partida.turnoActual = "a";
        const respuesta = (): Resultado => ({ error, mensaje: error ? "fallo" : "" });
        const sala = {
            partida: estado.partida,
            tablero: estado.tablero,
            jugadores: estado.jugadores,
            broadcast: (_tipo: string, mensaje: { jugador: string, mensaje: string }) => logs.push(mensaje),
            ejecutarColocarAsentamiento: (sid: string, h: number, d: number, p: number) => {
                llamadas.push(`asentamiento ${sid} ${h},${d},${p}`);
                // Como la sala real: al colocar el asentamiento pasa a colocar el camino
                if (!error) {
                    estado.partida.fasePreconstruccion = FasePreconstruccion.CAMINO;
                    jugador.ultimoAsentamiento = `${h},${d},${p}`;
                }
                return respuesta();
            },
            ejecutarColocarCamino: (sid: string, h: number, d: number, p: number) => {
                llamadas.push(`camino ${sid} ${h},${d},${p}`);
                return respuesta();
            },
        } as unknown as SalaAutomatica;
        return { sala, llamadas, logs };
    }

    it("si toca el asentamiento, coloca el asentamiento y despues el camino", () => {
        const { sala, llamadas, logs } = salaFalsa(FasePreconstruccion.ASENTAMIENTO);

        autoColocar(sala);

        assert.equal(llamadas.length, 2);
        assert.match(llamadas[0], /^asentamiento a /);
        assert.match(llamadas[1], /^camino a /);
        assert.equal(logs.length, 1);
        assert.equal(logs[0].jugador, "Sistema: ");
        assert.match(logs[0].mensaje, /Se acabo el tiempo de Ana/);
    });

    it("si toca el camino, solo coloca el camino", () => {
        const { sala, llamadas } = salaFalsa(FasePreconstruccion.CAMINO);

        autoColocar(sala);

        assert.equal(llamadas.length, 1);
        assert.match(llamadas[0], /^camino a /);
    });

    it("si no logra colocar nada, lo anota y no revienta", () => {
        const { sala, logs } = salaFalsa(FasePreconstruccion.ASENTAMIENTO, true);

        assert.doesNotThrow(() => autoColocar(sala));
        assert.equal(logs.length, 1);
        assert.match(logs[0].mensaje, /no encontro/);
    });
});

describe("autoColocar en la sala real", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(server);
    });

    after(async () => {
        await colyseus.shutdown();
    });

    async function salaEnColocacion(ids: string[]): Promise<CatanRoom> {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });
        for (const id of ids) {
            sala.jugadores.set(id, new Jugador(id));
            sala.partida.ordenJugadores.push(id);
        }
        sala.partida.turnoActual = ids[0];
        sala.partida.fase = FasePartida.PRECONSTRUCCION;
        sala.partida.fasePreconstruccion = FasePreconstruccion.ASENTAMIENTO;
        return sala;
    }

    function piezasDe(sala: CatanRoom, id: string) {
        let asentamientos = 0;
        let caminos = 0;
        sala.tablero.vertices.forEach((v) => { if (v.propietario === id && v.constuccion === Construccion.ASENTAMIENTO) asentamientos++; });
        sala.tablero.aristas.forEach((a) => { if (a.propietario === id) caminos++; });
        return { asentamientos, caminos };
    }

    it("coloca asentamiento y camino conectado, y le pasa el turno al siguiente", async () => {
        const sala = await salaEnColocacion(["a", "b"]);

        autoColocar(sala);

        assert.deepEqual(piezasDe(sala, "a"), { asentamientos: 1, caminos: 1 });
        const ultimo = sala.jugadores.get("a")!.ultimoAsentamiento;
        const camino = Array.from(sala.tablero.aristas.entries()).find(([, a]) => a.propietario === "a")![0];
        assert.ok(aristasConectadas(ultimo).includes(camino));
        assert.equal(sala.partida.turnoActual, "b");
        assert.equal(sala.partida.fasePreconstruccion, FasePreconstruccion.ASENTAMIENTO);
    });

    it("con el asentamiento ya puesto solo coloca el camino", async () => {
        const sala = await salaEnColocacion(["a", "b"]);
        const llave = Array.from(sala.tablero.vertices.keys())[0];
        const [h, d, p] = llave.split(",").map(Number);
        assert.equal(sala.ejecutarColocarAsentamiento("a", h, d, p).error, false);

        autoColocar(sala);

        assert.deepEqual(piezasDe(sala, "a"), { asentamientos: 1, caminos: 1 });
        assert.equal(sala.partida.turnoActual, "b");
    });

    it("el segundo asentamiento entrega los recursos iniciales", async () => {
        const sala = await salaEnColocacion(["a", "b"]);
        sala.partida.direccionPreconstruccion = -1;
        const total = () => Array.from(sala.jugadores.get("a")!.recursos.values()).reduce((t, c) => t + c, 0);
        const antes = total();

        autoColocar(sala);

        //* Recursos esperados: un recurso por cada hexagono no desierto que toca el asentamiento
        const [h, d, p] = sala.jugadores.get("a")!.ultimoAsentamiento.split(",").map(Number);
        const vecinos = p === 0 ? [[h, d], [h + 1, d - 1], [h, d - 1]] : [[h, d], [h - 1, d], [h, d - 1]];
        const esperados = vecinos
            .map(([hh, dd]) => sala.tablero.hexagonos.get(`${hh},${dd}`))
            .filter((hex) => hex && hex.terreno !== Terreno.DESIERTO).length;
        assert.equal(total() - antes, esperados);
    });

    it("de punta a punta: con 4 jugadores inactivos el reloj hace toda la colocacion y empieza el juego", async () => {
        const ids = ["a", "b", "c", "d"];
        const sala = await salaEnColocacion(ids);
        sala.sincronizarTemporizador();

        const porPieza = tiempoDeEtapa(sala.partida.ritmo, Etapa.COLOCACION);
        for (let i = 0; i < porPieza * 16 && sala.partida.fase === FasePartida.PRECONSTRUCCION; i++) {
            sala.tick();
        }

        assert.equal(sala.partida.fase, FasePartida.JUEGO);
        assert.equal(sala.partida.faseJuego, FaseJuego.DADOS);
        for (const id of ids) {
            assert.deepEqual(piezasDe(sala, id), { asentamientos: 2, caminos: 2 }, id);
        }
        const ocupados = Array.from(sala.tablero.vertices.entries()).filter(([, v]) => v.propietario !== "");
        const estado = { tablero: sala.tablero } as CatanState;
        for (const [llave] of ocupados) {
            assert.ok(cumpleDistancia(estado, llave), `${llave} quedo pegado a otro asentamiento`);
        }
    });
});
