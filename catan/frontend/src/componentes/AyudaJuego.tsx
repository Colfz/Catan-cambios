import { useState } from "react";
import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack,
    Table, TableBody, TableCell, TableRow, Typography,
} from "@mui/material";
import { NOMBRE_RITMO, RITMO, type Ritmo } from "../common/fases";

interface Props {
    // Ritmo de la sala: decide los tiempos que se muestran. Sin el, se muestran los del ritmo Normal.
    ritmo?: number;
}

//* Costos (iguales a backend/src/common/costos.ts) con el icono de cada recurso
const COSTOS: { nombre: string; icono: string; recursos: { icono: string; nombre: string; cantidad: number }[] }[] = [
    {
        nombre: "Camino", icono: "/svg/carretera.svg",
        recursos: [{ icono: "/svg/madera.svg", nombre: "madera", cantidad: 1 }, { icono: "/svg/ladrillo.svg", nombre: "ladrillo", cantidad: 1 }],
    },
    {
        nombre: "Poblado", icono: "/svg/poblado.svg",
        recursos: [
            { icono: "/svg/madera.svg", nombre: "madera", cantidad: 1 }, { icono: "/svg/ladrillo.svg", nombre: "ladrillo", cantidad: 1 },
            { icono: "/svg/trigo.svg", nombre: "trigo", cantidad: 1 }, { icono: "/svg/lana.svg", nombre: "lana", cantidad: 1 },
        ],
    },
    {
        nombre: "Ciudad", icono: "/svg/ciudad.svg",
        recursos: [{ icono: "/svg/trigo.svg", nombre: "trigo", cantidad: 2 }, { icono: "/svg/piedra.svg", nombre: "mineral", cantidad: 3 }],
    },
    {
        nombre: "Carta de desarrollo", icono: "/svg/desarrollo.svg",
        recursos: [
            { icono: "/svg/trigo.svg", nombre: "trigo", cantidad: 1 }, { icono: "/svg/lana.svg", nombre: "lana", cantidad: 1 },
            { icono: "/svg/piedra.svg", nombre: "mineral", cantidad: 1 },
        ],
    },
];

const CARTAS: { nombre: string; icono: string; efecto: string }[] = [
    { nombre: "Caballero", icono: "/svg/caballero.svg", efecto: "Mueve al ladrón y roba un recurso. Es la única carta que puedes jugar antes de lanzar los dados. Con 3 caballeros jugados puedes tener el ejército más grande." },
    { nombre: "Carreteras", icono: "/svg/carreteras.svg", efecto: "Construyes 2 caminos gratis." },
    { nombre: "Abundancia", icono: "/svg/abundancia.svg", efecto: "Tomas 2 recursos de la banca." },
    { nombre: "Monopolio", icono: "/svg/monopolio.svg", efecto: "Eliges un recurso y los demás te dan todos los que tengan." },
    { nombre: "Punto de victoria", icono: "/svg/puntosVictoria.svg", efecto: "Vale 1 punto. Nadie la ve hasta que ganas." },
];

//* Segundos de cada etapa con el ritmo Normal (iguales a backend/src/functions/ritmos.ts)
const TIEMPOS_NORMAL: { etapa: string; segundos: number }[] = [
    { etapa: "Colocación inicial (por pieza)", segundos: 90 },
    { etapa: "Lanzar los dados", segundos: 45 },
    { etapa: "Acciones del turno", segundos: 180 },
    { etapa: "Mover al ladrón", segundos: 45 },
    { etapa: "Elegir a quién robar", segundos: 30 },
    { etapa: "Descartar", segundos: 60 },
    { etapa: "Carreteras gratis", segundos: 60 },
];

function formatoTiempo(segundos: number): string {
    const minutos = Math.floor(segundos / 60);
    const resto = segundos % 60;
    if (minutos === 0) return `${resto} s`;
    return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <section>
            <Typography variant="h6" component="h3" gutterBottom>{titulo}</Typography>
            {children}
        </section>
    );
}

//* Boton que abre las reglas resumidas. No toca la partida: solo se abre y se cierra.
function AyudaJuego({ ritmo: ritmoSala = RITMO.NORMAL }: Props) {
    const ritmo = (NOMBRE_RITMO[ritmoSala as Ritmo] ? ritmoSala : RITMO.NORMAL) as Ritmo;
    const [abierta, setAbierta] = useState(false);
    const sinLimite = ritmo === RITMO.SIN_LIMITE;
    const tiempo = (segundos: number) => formatoTiempo(ritmo === RITMO.RAPIDO ? Math.round(segundos / 2) : segundos);

    return (
        <>
            <button
                type="button"
                className="btn btn-secondary flex-fill"
                onClick={() => setAbierta(true)}
                aria-haspopup="dialog"
            >
                Ayuda
            </button>

            <Dialog
                open={abierta}
                onClose={() => setAbierta(false)}
                fullWidth
                maxWidth="md"
                scroll="paper"
                aria-labelledby="ayuda-titulo"
            >
                <DialogTitle id="ayuda-titulo">¿Cómo se juega?</DialogTitle>

                <DialogContent dividers>
                    <Stack spacing={3}>
                        <Seccion titulo="Cómo se gana">
                            <Typography>
                                Gana quien llegue primero a <strong>10 puntos</strong>. Suman: poblado 1, ciudad 2,
                                ejército más grande 2, camino más largo 2 y cada carta de punto de victoria 1.
                            </Typography>
                            <Typography sx={{ mt: 1 }}>
                                El camino más largo es para quien tenga una ruta continua de <strong>5 caminos o más</strong>;
                                si alguien la supera, o un poblado rival la corta, los 2 puntos cambian de dueño.
                            </Typography>
                        </Seccion>

                        <Divider />

                        <Seccion titulo="Tu turno">
                            <Typography component="ol" sx={{ pl: 3, m: 0 }}>
                                <li>Si tienes un caballero, puedes jugarlo antes de lanzar para mover al ladrón.</li>
                                <li>Lanza los dados. Los hexágonos con ese número dan recursos a los pobladores
                                    (1 por poblado, 2 por ciudad).</li>
                                <li>Construye, compra cartas de desarrollo, juega una carta e intercambia con la banca
                                    o con otros jugadores.</li>
                                <li>Pasa el turno. Solo puedes jugar una carta de desarrollo por turno, y no la que
                                    compraste ese mismo turno.</li>
                            </Typography>
                            <Typography sx={{ mt: 1 }}>
                                Con la banca se cambian 4 recursos iguales por 1, o menos si tienes un puerto.
                            </Typography>
                        </Seccion>

                        <Divider />

                        <Seccion titulo="Los puertos">
                            <Typography>
                                Los puertos están en la costa: cada uno tiene una etiqueta y dos muelles que llegan a
                                dos vértices. Si tienes un poblado o una ciudad en uno de esos vértices, puedes usar
                                el puerto al intercambiar con la banca.
                            </Typography>
                            <Typography component="ul" sx={{ pl: 3, mt: 1, mb: 0 }}>
                                <li><strong>3:1</strong>: cambias 3 recursos iguales, de cualquier tipo, por 1.</li>
                                <li><strong>2 Madera:1</strong> (o el recurso que diga): cambias 2 de ese recurso por 1.</li>
                            </Typography>
                            <Typography sx={{ mt: 1 }}>
                                Sin puerto, la banca cambia 4 por 1. Si tienes varios puertos, se usa siempre el mejor
                                para el recurso que entregas.
                            </Typography>
                        </Seccion>

                        <Divider />

                        <Seccion titulo="Cuánto cuesta cada cosa">
                            <Table size="small" aria-label="Costos">
                                <TableBody>
                                    {COSTOS.map(({ nombre, icono, recursos }) => (
                                        <TableRow key={nombre}>
                                            <TableCell sx={{ width: "50%" }}>
                                                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                    <img src={icono} alt="" aria-hidden="true" width={28} height={28} />
                                                    <span>{nombre}</span>
                                                </Stack>
                                            </TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                                                    {recursos.map(({ icono: img, nombre: recurso, cantidad }) => (
                                                        <Stack key={recurso} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                                                            <span>{cantidad}</span>
                                                            <img src={img} alt={recurso} width={24} height={24} />
                                                        </Stack>
                                                    ))}
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Seccion>

                        <Divider />

                        <Seccion titulo="Cartas de desarrollo">
                            <Table size="small" aria-label="Cartas de desarrollo">
                                <TableBody>
                                    {CARTAS.map(({ nombre, icono, efecto }) => (
                                        <TableRow key={nombre}>
                                            <TableCell sx={{ width: "35%" }}>
                                                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                    <img src={icono} alt="" aria-hidden="true" width={28} height={28} />
                                                    <strong>{nombre}</strong>
                                                </Stack>
                                            </TableCell>
                                            <TableCell>{efecto}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Seccion>

                        <Divider />

                        <Seccion titulo="Cuando sale un 7">
                            <Typography component="ol" sx={{ pl: 3, m: 0 }}>
                                <li>Quien tenga más de 7 recursos descarta la mitad, a su elección.</li>
                                <li>Quien lanzó mueve al ladrón a otro hexágono: ese hexágono deja de producir.</li>
                                <li>Le roba 1 recurso al azar a un jugador que tenga un poblado o ciudad allí.</li>
                            </Typography>
                        </Seccion>

                        <Divider />

                        <Seccion titulo="El temporizador">
                            {sinLimite ? (
                                <Typography>
                                    Esta sala juega en ritmo <strong>{NOMBRE_RITMO[ritmo]}</strong>: no hay contador y la
                                    partida espera a cada jugador.
                                </Typography>
                            ) : (
                                <>
                                    <Typography gutterBottom>
                                        Cada etapa tiene un tiempo (ritmo <strong>{NOMBRE_RITMO[ritmo]}</strong>). Si se
                                        acaba, el servidor juega por ti: lanza los dados, mueve el ladrón, descarta al
                                        azar, coloca piezas válidas o pasa el turno.
                                    </Typography>
                                    <Table size="small" aria-label="Tiempos de cada etapa">
                                        <TableBody>
                                            {TIEMPOS_NORMAL.map(({ etapa, segundos }) => (
                                                <TableRow key={etapa}>
                                                    <TableCell>{etapa}</TableCell>
                                                    <TableCell align="right">{tiempo(segundos)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </>
                            )}
                        </Seccion>

                        <Divider />

                        <Seccion titulo="Tus cartas son secretas">
                            <Typography>
                                Los demás solo ven cuántas cartas tienes, no cuáles. Tus cartas de punto de victoria se
                                revelan cuando ganas.
                            </Typography>
                        </Seccion>
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setAbierta(false)} variant="contained" autoFocus>
                        Cerrar
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default AyudaJuego;
