import type { Jugadores } from '../common/jugador';
import { colorDeJugador } from '../common/jugador';
import './infoTurno.css';

// Los ultimos segundos de la etapa se ven distinto para llamar la atencion.
const SEGUNDOS_AVISO = 10;

interface Props {
  sessionIdTurno: string;
  jugadores: Jugadores;
  ordenJugadores: string[];
  // Segundos que quedan en la etapa, publicados por el servidor.
  tiempoRestante: number;
  mostrarTiempo: boolean;
}

// mm:ss, por ejemplo 02:05.
function formatearTiempo(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

function InfoTurno({ sessionIdTurno, jugadores, ordenJugadores, tiempoRestante, mostrarTiempo }: Props) {
  const lista = ordenJugadores.length > 0 ? ordenJugadores : Object.keys(jugadores);
  const nombre = jugadores[sessionIdTurno]?.nombre;
  const color = colorDeJugador(lista, sessionIdTurno);
  const enAviso = tiempoRestante <= SEGUNDOS_AVISO;

  return (
    <div
      className="flex-fill w-100 rounded overflow-hidden text-white
                 d-flex flex-column justify-content-center align-items-center"
      style={{ backgroundColor: color }}
    >
      {/* Solo se anuncia el cambio de turno; el contador va aparte para que
          los lectores de pantalla no lo lean cada segundo. */}
      <div
        className="d-flex flex-column align-items-center mw-100"
        role="status"
        aria-live="polite"
      >
        <span className="small">Turno de</span>
        <span className="fw-bold text-truncate mw-100 px-2">{nombre ?? '—'}</span>
      </div>
      {mostrarTiempo && (
        <span
          className={`infoTurnoTiempo${enAviso ? ' infoTurnoTiempo--aviso' : ''}`}
          role="timer"
          aria-label={`Tiempo restante: ${tiempoRestante} segundos`}
        >
          {formatearTiempo(tiempoRestante)}
        </span>
      )}
    </div>
  );
}

export default InfoTurno;
