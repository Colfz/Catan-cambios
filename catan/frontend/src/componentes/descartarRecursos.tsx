import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { RECURSOS, type Recurso, type Recursos } from '../common/jugador';

// Se reutilizan los iconos de recursos existentes; el tablero SVG no cambia.
const ICONOS: Record<Recurso, string> = {
  madera: '/svg/madera.svg',
  trigo: '/svg/trigo.svg',
  lana: '/svg/lana.svg',
  ladrillo: '/svg/ladrillo.svg',
  mineral: '/svg/piedra.svg',
};

const SELECCION_VACIA: Record<Recurso, number> = {
  madera: 0, trigo: 0, lana: 0, ladrillo: 0, mineral: 0,
};

interface Props {
  pendientes: number;
  recursos?: Recursos;
  esSuTurnoDeDescartar: boolean;
  enviando: boolean;
  onDescartarLote: (recursos: Partial<Record<Recurso, number>>) => void;
}

/* El jugador arma todo el lote con +/- y lo manda en un solo mensaje. Partida
   le pone key={pendientes}, asi la seleccion se reinicia cada vez que el
   dialogo se vuelve a abrir. */
function DescartarRecursos({
  pendientes, recursos, esSuTurnoDeDescartar, enviando, onDescartarLote,
}: Props) {
  const [seleccion, setSeleccion] = useState<Record<Recurso, number>>(SELECCION_VACIA);

  const elegidas = RECURSOS.reduce((suma, recurso) => suma + seleccion[recurso], 0);
  const faltan = pendientes - elegidas;
  const bloqueado = !esSuTurnoDeDescartar || enviando;

  function cambiar(recurso: Recurso, delta: number) {
    setSeleccion((anterior) => ({ ...anterior, [recurso]: anterior[recurso] + delta }));
  }

  function confirmar() {
    if (bloqueado || faltan !== 0) return;
    // Solo se mandan los recursos elegidos; el backend valida suma y limites.
    const lote: Partial<Record<Recurso, number>> = {};
    RECURSOS.forEach((recurso) => {
      if (seleccion[recurso] > 0) lote[recurso] = seleccion[recurso];
    });
    onDescartarLote(lote);
  }

  return (
    <Dialog open={pendientes > 0} fullWidth maxWidth="xs" aria-labelledby="descartar-titulo">
      <DialogTitle id="descartar-titulo">Descartar recursos</DialogTitle>
      <DialogContent>
        <Typography role="status">
          Elegidas {elegidas} de {pendientes}. Faltan {faltan}.
        </Typography>
        {!esSuTurnoDeDescartar && (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Espera a que el jugador anterior termine de descartar.
          </Typography>
        )}
        <Stack spacing={1} sx={{ mt: 2 }}>
          {RECURSOS.map((recurso) => {
            const disponibles = recursos?.[recurso] ?? 0;
            const cantidad = seleccion[recurso];
            return (
              <Stack
                key={recurso}
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'space-between', textTransform: 'capitalize' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={ICONOS[recurso]} alt="" width={28} height={28} />
                  {recurso}
                  <Typography component="span" color="text.secondary" variant="body2">
                    (tienes {disponibles})
                  </Typography>
                </span>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Button
                    type="button"
                    variant="outlined"
                    color="inherit"
                    size="small"
                    sx={{ minWidth: 36 }}
                    disabled={bloqueado || cantidad <= 0}
                    onClick={() => cambiar(recurso, -1)}
                    aria-label={`Reducir ${recurso}`}
                  >
                    -
                  </Button>
                  <span style={{ minWidth: 20, textAlign: 'center' }} aria-label={`${recurso} elegidas`}>
                    {cantidad}
                  </span>
                  <Button
                    type="button"
                    variant="outlined"
                    color="inherit"
                    size="small"
                    sx={{ minWidth: 36 }}
                    disabled={bloqueado || cantidad >= disponibles || elegidas >= pendientes}
                    onClick={() => cambiar(recurso, 1)}
                    aria-label={`Aumentar ${recurso}`}
                  >
                    +
                  </Button>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          type="button"
          variant="contained"
          disabled={bloqueado || faltan !== 0}
          onClick={confirmar}
        >
          Confirmar descarte
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DescartarRecursos;
