import assert from "node:assert/strict";
import { Temporizador } from "../src/functions/temporizador.js";
import { Etapa } from "../src/functions/ritmos.js";
import { ejecutarAutomatico, type AccionAutomatica } from "../src/functions/automaticos/despachador.js";
import type { SalaAutomatica } from "../src/functions/automaticos/tipos.js";

function crearTemporizador() {
    const avisos: number[] = [];
    let vencimientos = 0;
    const temporizador = new Temporizador(
        (restante) => avisos.push(restante),
        () => { vencimientos += 1; }
    );
    return { temporizador, avisos, vencimientos: () => vencimientos };
}

describe("Temporizador", () => {
    it("cuenta hacia atras y avisa cada segundo", () => {
        const { temporizador, avisos } = crearTemporizador();

        temporizador.iniciar(3);
        temporizador.tick();
        temporizador.tick();

        assert.deepEqual(avisos, [3, 2, 1]);
        assert.equal(temporizador.restante, 1);
        assert.equal(temporizador.activo, true);
    });

    it("vence una sola vez al llegar a 0 y se detiene", () => {
        const { temporizador, vencimientos } = crearTemporizador();

        temporizador.iniciar(2);
        temporizador.tick();
        temporizador.tick();
        temporizador.tick();
        temporizador.tick();

        assert.equal(vencimientos(), 1);
        assert.equal(temporizador.restante, 0);
        assert.equal(temporizador.activo, false);
    });

    it("iniciar de nuevo reinicia la cuenta", () => {
        const { temporizador, vencimientos } = crearTemporizador();

        temporizador.iniciar(5);
        temporizador.tick();
        temporizador.tick();
        temporizador.iniciar(5);

        assert.equal(temporizador.restante, 5);
        assert.equal(vencimientos(), 0);
    });

    it("con 0 segundos no cuenta nada ni vence", () => {
        const { temporizador, avisos, vencimientos } = crearTemporizador();

        temporizador.iniciar(0);
        temporizador.tick();
        temporizador.tick();

        assert.equal(temporizador.activo, false);
        assert.deepEqual(avisos, [0]);
        assert.equal(vencimientos(), 0);
    });

    it("detener frena la cuenta y deja el tiempo en 0", () => {
        const { temporizador, avisos, vencimientos } = crearTemporizador();

        temporizador.iniciar(4);
        temporizador.tick();
        temporizador.detener();
        temporizador.tick();

        assert.equal(temporizador.restante, 0);
        assert.equal(temporizador.activo, false);
        assert.equal(avisos[avisos.length - 1], 0);
        assert.equal(vencimientos(), 0);
    });

    it("tick sin haber iniciado no hace nada", () => {
        const { temporizador, avisos, vencimientos } = crearTemporizador();

        temporizador.tick();

        assert.deepEqual(avisos, []);
        assert.equal(vencimientos(), 0);
    });
});

describe("despachador de acciones automaticas", () => {
    const ETAPAS = [
        Etapa.DADOS, Etapa.ACCIONES, Etapa.LADRON, Etapa.ROBO,
        Etapa.DESCARTE, Etapa.CARRETERAS, Etapa.COLOCACION
    ];

    it("llama a la accion de la etapa y solo a esa", () => {
        const llamadas: string[] = [];
        const acciones = {} as Record<Etapa, AccionAutomatica>;
        for (const etapa of ETAPAS) {
            acciones[etapa] = () => { llamadas.push(Etapa[etapa]); };
        }
        const sala = {} as SalaAutomatica;

        for (const etapa of ETAPAS) {
            llamadas.length = 0;
            ejecutarAutomatico(sala, etapa, acciones);
            assert.deepEqual(llamadas, [Etapa[etapa]]);
        }
    });

    it("le pasa la sala a la accion", () => {
        const sala = { marca: "sala" } as unknown as SalaAutomatica;
        let recibida: SalaAutomatica | null = null;
        const acciones = {} as Record<Etapa, AccionAutomatica>;
        for (const etapa of ETAPAS) acciones[etapa] = (s) => { recibida = s; };

        ejecutarAutomatico(sala, Etapa.DADOS, acciones);

        assert.equal(recibida, sala);
    });
});
