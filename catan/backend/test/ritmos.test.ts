import assert from "node:assert/strict";
import { Ritmo } from "../src/common/enums.js";
import { Etapa, TIEMPOS_NORMAL, tiempoDeEtapa } from "../src/functions/ritmos.js";

const ETAPAS = [
    Etapa.DADOS, Etapa.ACCIONES, Etapa.LADRON, Etapa.ROBO,
    Etapa.DESCARTE, Etapa.CARRETERAS, Etapa.COLOCACION
];

describe("tiempos por ritmo", () => {
    it("el ritmo Normal usa los tiempos acordados", () => {
        assert.equal(tiempoDeEtapa(Ritmo.NORMAL, Etapa.DADOS), 45);
        assert.equal(tiempoDeEtapa(Ritmo.NORMAL, Etapa.ACCIONES), 180);
        assert.equal(tiempoDeEtapa(Ritmo.NORMAL, Etapa.LADRON), 45);
        assert.equal(tiempoDeEtapa(Ritmo.NORMAL, Etapa.ROBO), 30);
        assert.equal(tiempoDeEtapa(Ritmo.NORMAL, Etapa.DESCARTE), 60);
        assert.equal(tiempoDeEtapa(Ritmo.NORMAL, Etapa.CARRETERAS), 60);
        assert.equal(tiempoDeEtapa(Ritmo.NORMAL, Etapa.COLOCACION), 90);
    });

    it("el ritmo Rapido es la mitad del Normal en cada etapa", () => {
        for (const etapa of ETAPAS) {
            assert.equal(tiempoDeEtapa(Ritmo.RAPIDO, etapa), Math.round(TIEMPOS_NORMAL[etapa] / 2));
        }
    });

    it("Sin limite no cuenta tiempo en ninguna etapa", () => {
        for (const etapa of ETAPAS) {
            assert.equal(tiempoDeEtapa(Ritmo.SIN_LIMITE, etapa), 0);
        }
    });
});
