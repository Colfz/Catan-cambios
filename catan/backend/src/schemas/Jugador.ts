import { MapSchema, Schema, type, view } from "@colyseus/schema"
import { Terreno } from "../common/enums.js";
import { PrivadoJugador } from "./PrivadoJugador.js";
import { generarRecursos } from "../generators/generarRecursos.js";
import { generarCartas } from "../generators/generarCartas.js";
import { generarConstruccionesDisponibles } from "../generators/generarConstruccionesDisponibles.js";

export class Jugador extends Schema {
    @type("string") nombre: string;
    @type("uint16") puntuacion: number;
    //* Lo que ven todos de la mano de un rival: cuantas cartas tiene, no cuales
    @type("uint8") cantidadRecursos: number;
    @type("uint8") cantidadCartas: number;
    //* Solo lo recibe su dueno (ver asignarVista en CatanRoom)
    @view() @type(PrivadoJugador) privado = new PrivadoJugador();
    @view() @type({ map: "uint8" }) recursos = new MapSchema<number>();
    @view() @type({ map: "uint8" }) cartas_usables = new MapSchema<number>();
    @view() @type({ map: "uint8" }) cartas_inusables = new MapSchema<number>();
    @type({ map: "uint8" }) construccionesDisponibles = new MapSchema<number>();
    @type("string") ultimoAsentamiento: string;
    @type("uint8") caballerosJugados: number;


    constructor(nombre: string = "") {
        super();
        this.nombre = nombre;
        this.puntuacion = 0;
        this.cantidadRecursos = 0;
        this.cantidadCartas = 0;
        this.ultimoAsentamiento = "";
        this.caballerosJugados = 0;
        generarRecursos(this.recursos);
        generarCartas(this.cartas_usables);
        generarCartas(this.cartas_inusables);
        generarConstruccionesDisponibles(this.construccionesDisponibles);
    }
}