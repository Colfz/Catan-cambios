import assert from "node:assert/strict";
import { FaseJuego } from "../src/common/enums.js";
import { faseTrasLadron } from "../src/functions/faseTrasLadron.js";

describe("faseTrasLadron", () => {
    it("caballero en DADOS sin victimas vuelve a DADOS", () => {
        assert.equal(faseTrasLadron(FaseJuego.DADOS, 0), FaseJuego.DADOS);
    });

    it("caballero en DADOS con una victima vuelve a DADOS", () => {
        assert.equal(faseTrasLadron(FaseJuego.DADOS, 1), FaseJuego.DADOS);
    });

    it("caballero en DADOS con dos victimas pasa a ROBO", () => {
        assert.equal(faseTrasLadron(FaseJuego.DADOS, 2), FaseJuego.ROBO);
    });

    it("caballero en ACCIONES sin victimas vuelve a ACCIONES", () => {
        assert.equal(faseTrasLadron(FaseJuego.ACCIONES, 0), FaseJuego.ACCIONES);
    });

    it("caballero en ACCIONES con una victima vuelve a ACCIONES", () => {
        assert.equal(faseTrasLadron(FaseJuego.ACCIONES, 1), FaseJuego.ACCIONES);
    });

    it("caballero en ACCIONES con tres victimas pasa a ROBO", () => {
        assert.equal(faseTrasLadron(FaseJuego.ACCIONES, 3), FaseJuego.ROBO);
    });
});
