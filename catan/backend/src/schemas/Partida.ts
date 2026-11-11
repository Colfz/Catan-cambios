import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { FaseJuego, FasePartida, FasePreconstruccion, Ritmo } from "../common/enums.js";
import { Jugador } from "./Jugador.js";
import { OfertaIntercambio } from "./OfertaIntercambio.js";
import { ResultadoJugador } from "./ResultadoJugador.js";

export class Partida extends Schema {
  @type("string") creador: string;
  @type("uint8") fase: FasePartida;
  @type("uint8") fasePreconstruccion: FasePreconstruccion;
  @type("int8") direccionPreconstruccion: number;
  @type("uint8") faseJuego: FaseJuego;
  @type("string") turnoActual: string;
  @type(["string"]) ordenJugadores = new ArraySchema<string>();
  @type(["string"]) jugadoresParaRobar = new ArraySchema<string>();
  @type({ map: "uint8" }) jugadoresParaDescartar = new MapSchema<number>();
  @type("boolean") cartaJugable: boolean;
  @type("string") ganador: string;
  @type("string") ejercitoMasGrande: string;
  //* Quien tiene el camino mas largo (vacio si nadie) y de cuantos caminos es
  @type("string") caminoMasLargo: string;
  @type("uint8") largoCaminoMasLargo: number;
  @type("uint8") carreterasGratis: number;
  @type(OfertaIntercambio) ofertaIntercambio = new OfertaIntercambio();
  //* Se llena al ganar; ordenado de mayor a menor total
  @type([ResultadoJugador]) resultadoFinal = new ArraySchema<ResultadoJugador>();
  //* Segundos que quedan en la etapa actual (0 si no hay limite)
  @type("uint16") tiempoRestante: number;
  //* Ritmo elegido al crear la sala
  @type("uint8") ritmo: Ritmo;

  constructor() {
    super();
    this.creador = "";
    this.ganador = "";
    this.fase = FasePartida.LOBBY;
    this.turnoActual = "";
    this.cartaJugable = false;
    this.fasePreconstruccion = FasePreconstruccion.ASENTAMIENTO;
    this.direccionPreconstruccion = 1;
    this.faseJuego = FaseJuego.DADOS;
    this.ganador = "";
    this.ejercitoMasGrande = "";
    this.caminoMasLargo = "";
    this.largoCaminoMasLargo = 0;
    this.carreterasGratis = 0;
    this.tiempoRestante = 0;
    this.ritmo = Ritmo.NORMAL;
  }
}