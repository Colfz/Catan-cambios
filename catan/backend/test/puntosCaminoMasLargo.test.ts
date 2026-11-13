import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { CatanState } from "../src/states/CatanState.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { Construccion, FaseJuego, FasePartida } from "../src/common/enums.js";
import { verticesDeArista } from "../src/functions/caminoMasLargo.js";
import {
    duenoDelCaminoMasLargo,
    recalcularCaminoMasLargo,
    SalaCaminoLargo,
} from "../src/functions/puntosCaminoMasLargo.js";
import { sacarJugador } from "../src/functions/sacarJugador.js";

//* Las seis aristas alrededor de un hexagono, ordenadas para que cada una toque a la siguiente
function anillo(h: number, d: number): string[] {
    const aristas = [`${h},${d},0`, `${h},${d},1`, `${h},${d},2`, `${h - 1},${d + 1},0`, `${h},${d + 1},1`, `${h + 1},${d},2`];
    const orden = [aristas[0]];
    const resto = aristas.slice(1);
    while (resto.length) {
        const [a, b] = verticesDeArista(orden[orden.length - 1]);
        const i = resto.findIndex((x) => !orden.includes(x) && verticesDeArista(x).some((v) => v === a || v === b));
        orden.push(resto.splice(i, 1)[0]);
    }
    return orden;
}

const compartido = (a: string, b: string) => verticesDeArista(a).find((v) => verticesDeArista(b).includes(v))!;

//* Sala falsa con el estado real y un registro de lo que se avisa
function salaFalsa(ids: string[] = ["a", "b"]) {
    const estado = new CatanState();
    for (const id of ids) {
        estado.jugadores.set(id, new Jugador(id));
        estado.partida.ordenJugadores.push(id);
    }
    const avisos: { jugador: string, mensaje: string }[] = [];
    const sala: SalaCaminoLargo = {
        partida: estado.partida,
        tablero: estado.tablero,
        jugadores: estado.jugadores,
        broadcast: (_tipo, mensaje) => { avisos.push(mensaje as { jugador: string, mensaje: string }); },
    };
    return { estado, sala, avisos };
}

function darCaminos(estado: CatanState, dueno: string, llaves: string[]) {
    for (const llave of llaves) {
        const arista = estado.tablero.aristas.get(llave);
        assert.ok(arista, `la arista ${llave} no existe`);
        arista.propietario = dueno;
    }
}

const puntos = (estado: CatanState, id: string) => estado.jugadores.get(id)!.puntuacion;
const faltan = (estado: CatanState, id: string) => estado.jugadores.get(id)!.privado.puntosParaGanar;

describe("duenoDelCaminoMasLargo", () => {
    const largos = (o: Record<string, number>) => new Map(Object.entries(o));

    it("con menos de 5 caminos nadie lo tiene", () => {
        assert.equal(duenoDelCaminoMasLargo(largos({ a: 4, b: 3 }), ""), "");
    });

    it("lo tiene quien llega a 5 con la ruta mas larga", () => {
        assert.equal(duenoDelCaminoMasLargo(largos({ a: 5, b: 3 }), ""), "a");
    });

    it("quien lo tenia lo conserva si empata", () => {
        assert.equal(duenoDelCaminoMasLargo(largos({ a: 6, b: 6 }), "b"), "b");
    });

    it("pasa a quien lo supera", () => {
        assert.equal(duenoDelCaminoMasLargo(largos({ a: 5, b: 7 }), "a"), "b");
    });

    it("si dos empatan en lo mas largo y ninguno lo tenia, nadie lo tiene", () => {
        assert.equal(duenoDelCaminoMasLargo(largos({ a: 4, b: 6, c: 6 }), "a"), "");
        assert.equal(duenoDelCaminoMasLargo(largos({ a: 6, b: 6 }), ""), "");
    });

    it("quien lo tenia lo pierde si baja de 5", () => {
        assert.equal(duenoDelCaminoMasLargo(largos({ a: 4, b: 4 }), "a"), "");
    });
});

describe("recalcularCaminoMasLargo", () => {
    const ruta = anillo(0, 0);

    it("con 4 caminos no pasa nada", () => {
        const { estado, sala, avisos } = salaFalsa();
        darCaminos(estado, "a", ruta.slice(0, 4));

        assert.equal(recalcularCaminoMasLargo(sala), false);

        assert.equal(estado.partida.caminoMasLargo, "");
        assert.equal(estado.partida.largoCaminoMasLargo, 0);
        assert.equal(puntos(estado, "a"), 0);
        assert.equal(avisos.length, 0);
    });

    it("con 5 caminos gana 2 puntos, que cuentan para ganar, y se avisa", () => {
        const { estado, sala, avisos } = salaFalsa();
        darCaminos(estado, "a", ruta.slice(0, 5));

        assert.equal(recalcularCaminoMasLargo(sala), true);

        assert.equal(estado.partida.caminoMasLargo, "a");
        assert.equal(estado.partida.largoCaminoMasLargo, 5);
        assert.equal(puntos(estado, "a"), 2);
        assert.equal(faltan(estado, "a"), 8);
        assert.deepEqual(avisos, [{ jugador: "a", mensaje: " tiene el camino mas largo (5 caminos)" }]);
    });

    it("recalcular sin cambios no repite los puntos ni el aviso, pero actualiza el largo", () => {
        const { estado, sala, avisos } = salaFalsa();
        darCaminos(estado, "a", ruta.slice(0, 5));
        recalcularCaminoMasLargo(sala);

        darCaminos(estado, "a", ruta.slice(5, 6));
        assert.equal(recalcularCaminoMasLargo(sala), false);

        assert.equal(puntos(estado, "a"), 2);
        assert.equal(estado.partida.largoCaminoMasLargo, 6);
        assert.equal(avisos.length, 1);
    });

    it("si alguien lo supera, los puntos pasan a esa persona", () => {
        const { estado, sala, avisos } = salaFalsa();
        darCaminos(estado, "a", ruta.slice(0, 5));
        recalcularCaminoMasLargo(sala);

        const otra = anillo(2, -2);
        darCaminos(estado, "b", otra);
        assert.equal(recalcularCaminoMasLargo(sala), true);

        assert.equal(estado.partida.caminoMasLargo, "b");
        assert.equal(estado.partida.largoCaminoMasLargo, 6);
        assert.equal(puntos(estado, "a"), 0);
        assert.equal(faltan(estado, "a"), 10);
        assert.equal(puntos(estado, "b"), 2);
        assert.equal(faltan(estado, "b"), 8);
        assert.equal(avisos[1].jugador, "b");
    });

    it("en empate se lo queda quien ya lo tenia", () => {
        const { estado, sala } = salaFalsa();
        darCaminos(estado, "a", ruta.slice(0, 5));
        recalcularCaminoMasLargo(sala);

        darCaminos(estado, "b", anillo(2, -2).slice(0, 5));
        assert.equal(recalcularCaminoMasLargo(sala), false);

        assert.equal(estado.partida.caminoMasLargo, "a");
        assert.equal(puntos(estado, "a"), 2);
        assert.equal(puntos(estado, "b"), 0);
    });

    it("un asentamiento rival que corta la ruta le quita los puntos a quien lo tenia", () => {
        const { estado, sala, avisos } = salaFalsa();
        darCaminos(estado, "a", ruta.slice(0, 5));
        recalcularCaminoMasLargo(sala);

        const vertice = estado.tablero.vertices.get(compartido(ruta[1], ruta[2]))!;
        vertice.propietario = "b";
        vertice.setConstruccion(Construccion.ASENTAMIENTO);
        assert.equal(recalcularCaminoMasLargo(sala), true);

        assert.equal(estado.partida.caminoMasLargo, "");
        assert.equal(estado.partida.largoCaminoMasLargo, 0);
        assert.equal(puntos(estado, "a"), 0);
        assert.equal(faltan(estado, "a"), 10);
        assert.deepEqual(avisos[1], { jugador: "Sistema: ", mensaje: "Nadie tiene el camino mas largo" });
    });

    it("al cortarlo, los puntos pasan al otro si tiene 5 o mas", () => {
        const { estado, sala } = salaFalsa();
        darCaminos(estado, "a", ruta.slice(0, 5));
        recalcularCaminoMasLargo(sala);
        darCaminos(estado, "b", anillo(2, -2).slice(0, 5));

        const vertice = estado.tablero.vertices.get(compartido(ruta[1], ruta[2]))!;
        vertice.propietario = "b";
        vertice.setConstruccion(Construccion.ASENTAMIENTO);
        recalcularCaminoMasLargo(sala);

        assert.equal(estado.partida.caminoMasLargo, "b");
        assert.equal(puntos(estado, "a"), 0);
        assert.equal(puntos(estado, "b"), 2);
    });

    it("si quien lo tenia abandona, los puntos van a quien le corresponde", () => {
        const { estado, sala } = salaFalsa(["a", "b", "c"]);
        darCaminos(estado, "a", ruta.slice(0, 6));
        darCaminos(estado, "b", anillo(2, -2).slice(0, 5));
        recalcularCaminoMasLargo(sala);
        assert.equal(estado.partida.caminoMasLargo, "a");

        estado.partida.turnoActual = "c";
        sacarJugador(estado.partida, estado.tablero, estado.banca, estado.jugadores, "a");
        assert.equal(estado.partida.caminoMasLargo, "");
        recalcularCaminoMasLargo(sala);

        assert.equal(estado.partida.caminoMasLargo, "b");
        assert.equal(estado.partida.largoCaminoMasLargo, 5);
        assert.equal(puntos(estado, "b"), 2);
    });
});

describe("camino mas largo en la sala", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(server);
    });

    after(async () => {
        await colyseus.shutdown();
    });

    async function salaEnJuego(): Promise<CatanRoom> {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });
        for (const id of ["a", "b"]) {
            sala.jugadores.set(id, new Jugador(id));
            sala.partida.ordenJugadores.push(id);
        }
        sala.partida.turnoActual = "a";
        sala.partida.fase = FasePartida.JUEGO;
        sala.partida.faseJuego = FaseJuego.ACCIONES;
        return sala;
    }

    function ponerCaminos(sala: CatanRoom, dueno: string, llaves: string[]) {
        for (const llave of llaves) sala.tablero.aristas.get(llave)!.propietario = dueno;
    }

    it("construir el quinto camino da el camino mas largo", async () => {
        const sala = await salaEnJuego();
        const ruta = anillo(0, 0);
        ponerCaminos(sala, "a", ruta.slice(0, 4));
        const jugador = sala.jugadores.get("a")!;
        jugador.recursos.set("madera", 1);
        jugador.recursos.set("ladrillo", 1);
        const [h, d, p] = ruta[4].split(",").map(Number);

        const resultado = sala.ejecutarColocarCamino("a", h, d, p);

        assert.equal(resultado.error, false);
        assert.equal(sala.partida.caminoMasLargo, "a");
        assert.equal(sala.partida.largoCaminoMasLargo, 5);
        assert.equal(jugador.puntuacion, 2);
        assert.equal(jugador.privado.puntosParaGanar, 8);
    });

    it("los 2 puntos del camino mas largo pueden darle la victoria", async () => {
        const sala = await salaEnJuego();
        const ruta = anillo(0, 0);
        ponerCaminos(sala, "a", ruta.slice(0, 4));
        const jugador = sala.jugadores.get("a")!;
        jugador.recursos.set("madera", 1);
        jugador.recursos.set("ladrillo", 1);
        jugador.privado.puntosParaGanar = 2;
        const [h, d, p] = ruta[4].split(",").map(Number);

        sala.ejecutarColocarCamino("a", h, d, p);

        assert.equal(sala.partida.ganador, "a");
        assert.equal(sala.partida.fase, FasePartida.FINALIZADA);
    });

    it("un camino que no llega a 5 no cambia nada", async () => {
        const sala = await salaEnJuego();
        const ruta = anillo(0, 0);
        ponerCaminos(sala, "a", ruta.slice(0, 2));
        const jugador = sala.jugadores.get("a")!;
        jugador.recursos.set("madera", 1);
        jugador.recursos.set("ladrillo", 1);
        const [h, d, p] = ruta[2].split(",").map(Number);

        sala.ejecutarColocarCamino("a", h, d, p);

        assert.equal(sala.partida.caminoMasLargo, "");
        assert.equal(jugador.puntuacion, 0);
    });
});
