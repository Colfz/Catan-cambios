import type { SalaAutomatica } from "./tipos.js";

//* Acciones automaticas cuando se acaba el tiempo del ladron y del robo (issue #15).

interface Coordenada {
    h: number;
    d: number;
}

//* Elige un hexagono al azar que no sea donde esta el ladron ahora. null si no hay otro
export function elegirHexagonoDistinto(
    hexagonos: Iterable<Coordenada>,
    actual: Coordenada,
    azar: () => number = Math.random
): Coordenada | null {
    const candidatos: Coordenada[] = [];
    for (const hexagono of hexagonos) {
        if (hexagono.h === actual.h && hexagono.d === actual.d) continue;
        candidatos.push({ h: hexagono.h, d: hexagono.d });
    }

    if (candidatos.length === 0) return null;
    return candidatos[Math.floor(azar() * candidatos.length)];
}

//* Elige a quien robar al azar. null si la lista esta vacia
export function elegirVictima(
    victimas: readonly string[],
    azar: () => number = Math.random
): string | null {
    if (victimas.length === 0) return null;
    return victimas[Math.floor(azar() * victimas.length)];
}

//* Se acabo el tiempo de mover el ladron: el servidor lo mueve a otro hexagono al azar
export function autoMoverLadron(sala: SalaAutomatica): void {
    const turno = sala.partida.turnoActual;
    const nombre = sala.jugadores.get(turno)?.nombre;

    const destino = elegirHexagonoDistinto(sala.tablero.hexagonos.values(), sala.tablero.ladron);
    if (!destino) return;

    sala.broadcast("log", {
        jugador: "Sistema: ",
        mensaje: `Se acabo el tiempo de ${nombre}: el ladron se movio a un hexagono al azar`
    });

    const resultado = sala.ejecutarMoverLadron(turno, destino.h, destino.d);
    if (resultado.error) {
        console.error("No se pudo mover el ladron automaticamente:", resultado.mensaje);
    }
}

//* Se acabo el tiempo de elegir a quien robar: el servidor elige una victima al azar.
//* ejecutarRobar vuelve a la fase de origen (acciones tras un 7, dados si fue un caballero antes de tirar)
export function autoRobar(sala: SalaAutomatica): void {
    const turno = sala.partida.turnoActual;
    const nombre = sala.jugadores.get(turno)?.nombre;

    const victima = elegirVictima(Array.from(sala.partida.jugadoresParaRobar));
    if (victima === null) return;

    sala.broadcast("log", {
        jugador: "Sistema: ",
        mensaje: `Se acabo el tiempo de ${nombre}: se eligio a quien robar al azar`
    });

    const resultado = sala.ejecutarRobar(turno, victima);
    if (resultado.error) {
        console.error("No se pudo robar automaticamente:", resultado.mensaje);
    }
}
