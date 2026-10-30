import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import type { ResultadoJugador } from "../common/partida";

interface Props {
    abierto: boolean;
    nombreGanador: string;
    soyElGanador: boolean;
    // Puntos de cada jugador, con las cartas de victoria ya reveladas.
    resultados: ResultadoJugador[];
    ganadorId: string;
    miSessionId: string;
    onSalir: () => void;
    onVerTablero: () => void;
}

//* Modal obligatorio cuando el backend termina la partida (fase FINALIZADA)

function FinPartida({
    abierto, nombreGanador, soyElGanador, resultados, ganadorId, miSessionId, onSalir, onVerTablero,
}: Props) {
    return (
        <Dialog
            open={abierto}
            // Obligatorio: Escape y el clic afuera llaman a onClose, que no hace
            // nada; solo se cierra con sus botones.
            onClose={() => {}}
            fullWidth
            maxWidth="sm"
            aria-labelledby="fin-partida-titulo"
        >
            <DialogTitle id="fin-partida-titulo" className="text-center">
                🏆 Partida finalizada
            </DialogTitle>
            <DialogContent className="text-center">
                <Typography variant="h5" component="p" className="fw-bold">
                    {soyElGanador ? '¡Ganaste la partida!' : `¡${nombreGanador} ganó la partida!`}
                </Typography>

                {/* Si el servidor no mando resultados no se dibuja la tabla. */}
                {resultados.length > 0 && (
                    <TableContainer sx={{ mt: 2 }}>
                        <Table size="small" aria-label="Puntos finales de cada jugador">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Jugador</TableCell>
                                    <TableCell align="right">Puntos públicos</TableCell>
                                    <TableCell align="right">Cartas de victoria</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {resultados.map((resultado) => {
                                    const esGanador = resultado.sessionId === ganadorId;
                                    const soyYo = resultado.sessionId === miSessionId;
                                    return (
                                        <TableRow key={resultado.sessionId} selected={esGanador}>
                                            <TableCell
                                                component="th"
                                                scope="row"
                                                sx={{ fontWeight: esGanador ? 'bold' : undefined }}
                                            >
                                                {esGanador && '🏆 '}
                                                {resultado.nombre}
                                                {soyYo && ' (tú)'}
                                            </TableCell>
                                            <TableCell align="right">{resultado.puntosPublicos}</TableCell>
                                            <TableCell align="right">{resultado.cartasVictoria}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                                {resultado.total}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                <Typography color="text.secondary" sx={{ mt: 2 }}>
                    Puedes salir de la sala o quedarte a ver cómo terminó el tablero.
                </Typography>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button variant="outlined" onClick={onVerTablero}>
                    Ver tablero
                </Button>
                <Button variant="contained" color="error" onClick={onSalir}>
                    Salir de la sala
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default FinPartida;
