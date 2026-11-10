//* Costo de cada construccion y de la carta de desarrollo, segun las reglas de Catan.
//* Es el unico lugar del backend donde se definen.
export type Costo = Readonly<Record<string, number>>;

export const COSTOS = {
    CAMINO: { madera: 1, ladrillo: 1 },
    ASENTAMIENTO: { madera: 1, ladrillo: 1, trigo: 1, lana: 1 },
    CIUDAD: { trigo: 2, mineral: 3 },
    CARTA: { trigo: 1, lana: 1, mineral: 1 },
} as const satisfies Record<string, Costo>;
