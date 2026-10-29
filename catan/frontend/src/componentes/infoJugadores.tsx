import type { Jugadores } from '../common/jugador';
import { totalCartas, totalRecursos, enRiesgoDeDescarte, colorDeJugador, puntosOcultos } from '../common/jugador';

interface Props {
  jugadores: Jugadores;
  ordenJugadores: string[];
  miSessionId: string;
  // Cartas que aun debe descartar cada jugador durante la fase DESCARTE
  pendientesDescarte?: Record<string, number>;
}

function InfoJugadores({ jugadores, ordenJugadores, miSessionId, pendientesDescarte }: Props) {
  const lista = ordenJugadores.length ? ordenJugadores : Object.keys(jugadores);

  return (
    <div className="d-flex gap-1 w-100 h-100">
      {lista.map((id) => {
        const j = jugadores[id];
        if (!j) return null;

        const yo = id === miSessionId;
        const porDescartar = pendientesDescarte?.[id] ?? 0;
        // Solo el dueno recibe sus puntos ocultos; los rivales ven la puntuacion publica.
        const ocultos = yo ? puntosOcultos(j) : 0;

        return (
          <div
            key={id}
            style={{ backgroundColor: colorDeJugador(lista, id) }}
            className="flex-fill min-w-0 overflow-hidden p-1 px-2 rounded-3 d-flex flex-column justify-content-center text-white border-0"
          >
            <div className="d-flex align-items-center gap-1 min-w-0">
              <span className="flex-grow-1 text-truncate text-white fw-semibold">
                {yo && '(Yo) '}{j.nombre}
              </span>
              <span
                className="fw-bold flex-shrink-0 text-white"
                title={ocultos > 0 ? 'Cartas de punto de victoria: solo tú las ves hasta ganar' : undefined}
              >
                {j.puntuacion}/10{ocultos > 0 && ` (+${ocultos} ocultos)`}
              </span>
            </div>
            <div className="d-flex justify-content-between text-white">
              <span title="Cartas de desarrollo en la mano, usables mas inusables">
                {totalCartas(j)} cartas
              </span>
              <span title="Caballeros jugados. Decide el ejercito mas grande">
                {j.caballerosJugados} caballeros
              </span>
              <span
                title="Cartas de recurso en la mano"
                className={enRiesgoDeDescarte(j) ? 'text-warning fw-bold' : 'text-white'}
              >
                {totalRecursos(j)} recursos
                {porDescartar > 0 && ` (descarta ${porDescartar})`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default InfoJugadores;