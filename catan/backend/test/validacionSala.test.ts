import assert from "node:assert/strict";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import server from "../src/app.config.js";
import { CatanRoom } from "../src/rooms/CatanRoom.js";
import { Jugador } from "../src/schemas/Jugador.js";
import { FaseJuego, FasePartida } from "../src/common/enums.js";

//* Mensajes que primero comprueban que la partida siga en curso y despues el turno
const CON_PARTIDA_EN_CURSO: [string, unknown][] = [
    ["msgLanzarDados", undefined],
    ["msgPasarTurno", undefined],
    ["msgColocarAsentamiento", { h: 0, d: 0, p: 0 }],
    ["msgColocarCamino", { h: 0, d: 0, p: 0 }],
    ["msgColocarCiudad", { h: 0, d: 0, p: 0 }],
    ["msgRobarJugador", { jugadorRobado: "b" }],
    ["msgCartaCaballero", { h: 0, d: 0 }],
    ["msgComprarCarta", undefined],
    ["msgCartaCarreteras", undefined],
    ["msgCaminoGratis", { h: 0, d: 0, p: 0 }],
    ["msgCartaAbundancia", {}],
    ["msgCartaMonopolio", {}],
];

//* Mensajes que solo comprueban el turno
const SOLO_TURNO: [string, unknown][] = [
    ["msgIntercambiarBanca", {}],
    ["msgIntercambiarJugador", {}],
    ["msgMoverLadron", { h: 0, d: 0 }],
];

describe("validaciones comunes de los mensajes de la sala", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(server);
    });

    after(async () => {
        await colyseus.shutdown();
    });

    async function sala(fase: FasePartida, turno: string): Promise<CatanRoom> {
        const sala = await colyseus.createRoom<CatanRoom>("catan", { nombre: "anfitrion" });
        for (const id of ["a", "b"]) {
            sala.jugadores.set(id, new Jugador(id));
            sala.partida.ordenJugadores.push(id);
        }
        sala.partida.fase = fase;
        sala.partida.faseJuego = FaseJuego.ACCIONES;
        sala.partida.turnoActual = turno;
        return sala;
    }

    //* Manda el mensaje como el jugador "a" y devuelve el primer error que recibe
    function enviar(sala: CatanRoom, nombre: string, mensaje: unknown): string | undefined {
        const errores: string[] = [];
        const cliente = { sessionId: "a", send: (_tipo: string, m: { mensajeError: string }) => errores.push(m.mensajeError) };
        (sala.messages as Record<string, (c: unknown, m: unknown) => void>)[nombre](cliente, mensaje);
        return errores[0];
    }

    for (const [nombre, mensaje] of CON_PARTIDA_EN_CURSO) {
        it(`${nombre}: rechaza la partida terminada antes que el turno`, async () => {
            assert.equal(enviar(await sala(FasePartida.FINALIZADA, "a"), nombre, mensaje), "La partida ha finalizado");
            assert.equal(enviar(await sala(FasePartida.FINALIZADA, "b"), nombre, mensaje), "La partida ha finalizado");
            assert.equal(enviar(await sala(FasePartida.JUEGO, "b"), nombre, mensaje), "No es tu turno");
        });
    }

    for (const [nombre, mensaje] of SOLO_TURNO) {
        it(`${nombre}: solo comprueba el turno`, async () => {
            assert.equal(enviar(await sala(FasePartida.JUEGO, "b"), nombre, mensaje), "No es tu turno");
            assert.equal(enviar(await sala(FasePartida.FINALIZADA, "b"), nombre, mensaje), "No es tu turno");
            assert.notEqual(enviar(await sala(FasePartida.FINALIZADA, "a"), nombre, mensaje), "La partida ha finalizado");
        });
    }
});
