import assert from "node:assert/strict";
import { Room, Client, defineServer, defineRoom } from "colyseus";
import { Schema, MapSchema, StateView, type } from "@colyseus/schema";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { Jugador } from "../src/schemas/Jugador.js";

//* Sala minima que repite lo que hace CatanRoom.asignarVista con el Jugador real
class EstadoPrueba extends Schema {
    @type({ map: Jugador }) jugadores = new MapSchema<Jugador>();
}

class SalaPrueba extends Room {
    state = new EstadoPrueba();

    onJoin(client: Client) {
        const jugador = new Jugador(client.sessionId);
        this.state.jugadores.set(client.sessionId, jugador);
        client.view = new StateView();
        client.view.add(jugador.privado);
    }
}

describe("privacidad de los puntos de victoria", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(defineServer({ rooms: { privacidad: defineRoom(SalaPrueba) } }));
    });

    after(async () => {
        await colyseus.shutdown();
    });

    it("cada cliente solo recibe el dato privado de su propio jugador", async () => {
        const sala = await colyseus.createRoom<SalaPrueba>("privacidad");
        const a = await colyseus.connectTo(sala);
        const b = await colyseus.connectTo(sala);
        await sala.waitForNextPatch();

        sala.state.jugadores.get(a.sessionId)!.privado.puntosVictoria = 2;
        sala.state.jugadores.get(b.sessionId)!.privado.puntosVictoria = 1;
        await sala.waitForNextPatch();
        await new Promise((resolver) => setTimeout(resolver, 200));

        const estadoA = a.state as unknown as EstadoPrueba;
        const estadoB = b.state as unknown as EstadoPrueba;

        assert.equal(estadoA.jugadores.get(a.sessionId)?.privado?.puntosVictoria, 2);
        assert.equal(estadoB.jugadores.get(b.sessionId)?.privado?.puntosVictoria, 1);
        assert.equal(estadoA.jugadores.get(b.sessionId)?.privado?.puntosVictoria, undefined);
        assert.equal(estadoB.jugadores.get(a.sessionId)?.privado?.puntosVictoria, undefined);
    });
});
