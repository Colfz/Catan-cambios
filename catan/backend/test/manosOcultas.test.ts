import assert from "node:assert/strict";
import { Room, Client, defineServer, defineRoom } from "colyseus";
import { Schema, MapSchema, StateView, type } from "@colyseus/schema";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { Jugador } from "../src/schemas/Jugador.js";
import { cantidadesDeMano, sincronizarCantidadesDeMano } from "../src/functions/cantidadesDeMano.js";

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
        client.view.add(jugador.recursos);
        client.view.add(jugador.cartas_usables);
        client.view.add(jugador.cartas_inusables);
    }
}

describe("cantidades de la mano", () => {
    it("suma los recursos y las cartas de desarrollo, usables mas nuevas", () => {
        const jugador = new Jugador("a");
        jugador.recursos.set("madera", 3);
        jugador.recursos.set("trigo", 2);
        jugador.cartas_usables.set("1", 1);
        jugador.cartas_inusables.set("3", 2);

        assert.deepEqual(cantidadesDeMano(jugador), { recursos: 5, cartas: 3 });
    });

    it("una mano vacia da 0 y 0", () => {
        assert.deepEqual(cantidadesDeMano(new Jugador("a")), { recursos: 0, cartas: 0 });
    });

    it("deja las cantidades en cada jugador y las actualiza al cambiar la mano", () => {
        const jugadores = new MapSchema<Jugador>();
        const a = new Jugador("a");
        const b = new Jugador("b");
        jugadores.set("a", a);
        jugadores.set("b", b);
        a.recursos.set("madera", 4);
        b.cartas_usables.set("2", 1);

        sincronizarCantidadesDeMano(jugadores);
        assert.equal(a.cantidadRecursos, 4);
        assert.equal(a.cantidadCartas, 0);
        assert.equal(b.cantidadRecursos, 0);
        assert.equal(b.cantidadCartas, 1);

        a.recursos.set("madera", 1);
        sincronizarCantidadesDeMano(jugadores);
        assert.equal(a.cantidadRecursos, 1);
    });
});

describe("privacidad de las manos", () => {
    let colyseus: ColyseusTestServer;

    before(async () => {
        colyseus = await boot(defineServer({ rooms: { manos: defineRoom(SalaPrueba) } }));
    });

    after(async () => {
        await colyseus.shutdown();
    });

    it("un rival no recibe los recursos ni las cartas de otro jugador, pero si sus cantidades", async () => {
        const sala = await colyseus.createRoom<SalaPrueba>("manos");
        const a = await colyseus.connectTo(sala);
        const b = await colyseus.connectTo(sala);
        await sala.waitForNextPatch();

        const jugadorA = sala.state.jugadores.get(a.sessionId)!;
        const jugadorB = sala.state.jugadores.get(b.sessionId)!;
        jugadorA.recursos.set("madera", 3);
        jugadorA.cartas_usables.set("1", 2);
        jugadorA.cartas_inusables.set("3", 1);
        jugadorB.recursos.set("trigo", 5);
        jugadorA.cantidadRecursos = 3;
        jugadorA.cantidadCartas = 3;
        jugadorB.cantidadRecursos = 5;
        await sala.waitForNextPatch();
        await new Promise((resolver) => setTimeout(resolver, 200));

        const estadoA = a.state as unknown as EstadoPrueba;
        const estadoB = b.state as unknown as EstadoPrueba;

        //* Cada uno ve su propia mano completa
        assert.equal(estadoA.jugadores.get(a.sessionId)?.recursos?.get("madera"), 3);
        assert.equal(estadoA.jugadores.get(a.sessionId)?.cartas_usables?.get("1"), 2);
        assert.equal(estadoA.jugadores.get(a.sessionId)?.cartas_inusables?.get("3"), 1);
        assert.equal(estadoB.jugadores.get(b.sessionId)?.recursos?.get("trigo"), 5);

        //* Y nada de la mano del rival
        assert.equal(estadoA.jugadores.get(b.sessionId)?.recursos?.get("trigo"), undefined);
        assert.equal(estadoB.jugadores.get(a.sessionId)?.recursos?.get("madera"), undefined);
        assert.equal(estadoB.jugadores.get(a.sessionId)?.cartas_usables?.get("1"), undefined);
        assert.equal(estadoB.jugadores.get(a.sessionId)?.cartas_inusables?.get("3"), undefined);

        //* Todos ven cuantas cartas tiene cada uno
        assert.equal(estadoB.jugadores.get(a.sessionId)?.cantidadRecursos, 3);
        assert.equal(estadoB.jugadores.get(a.sessionId)?.cantidadCartas, 3);
        assert.equal(estadoA.jugadores.get(b.sessionId)?.cantidadRecursos, 5);
    });

    it("el dueno recibe los cambios posteriores de su mano y el rival solo la cantidad", async () => {
        const sala = await colyseus.createRoom<SalaPrueba>("manos");
        const a = await colyseus.connectTo(sala);
        const b = await colyseus.connectTo(sala);
        await sala.waitForNextPatch();

        const jugadorA = sala.state.jugadores.get(a.sessionId)!;
        jugadorA.recursos.set("lana", 2);
        jugadorA.cantidadRecursos = 2;
        await sala.waitForNextPatch();
        jugadorA.recursos.set("lana", 6);
        jugadorA.cantidadRecursos = 6;
        await sala.waitForNextPatch();
        await new Promise((resolver) => setTimeout(resolver, 200));

        const estadoA = a.state as unknown as EstadoPrueba;
        const estadoB = b.state as unknown as EstadoPrueba;

        assert.equal(estadoA.jugadores.get(a.sessionId)?.recursos?.get("lana"), 6);
        assert.equal(estadoB.jugadores.get(a.sessionId)?.recursos?.get("lana"), undefined);
        assert.equal(estadoB.jugadores.get(a.sessionId)?.cantidadRecursos, 6);
    });
});
