import { useState, type FormEvent } from "react";
import "./CrearSala.css";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import type { Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { NOMBRE_RITMO, RITMO, type Ritmo } from "../../common/fases";
import {
  LARGO_MAXIMO_ALIAS,
  LARGO_MAXIMO_CODIGO,
  aliasSugerido,
  validarAlias,
  validarCodigoAcceso,
} from "../validacionSala";

// Lo que CatanRoom.onCreate sabe leer (además del nombre del jugador).
export interface DatosNuevaSala {
  alias: string;
  privada: boolean;
  codigoAcceso?: string;
  // Decide cuanto tiempo tiene cada etapa del turno. Ver RITMO en common/fases.ts.
  ritmo: Ritmo;
}

// Lo que significa cada ritmo, para que quien crea la sala sepa que elige.
const DESCRIPCION_RITMO: Record<Ritmo, string> = {
  [RITMO.NORMAL]: "Tiempo cómodo en cada etapa. Si alguien se queda quieto, el servidor juega por él.",
  [RITMO.RAPIDO]: "La mitad del tiempo en cada etapa. Si alguien se queda quieto, el servidor juega por él.",
  [RITMO.SIN_LIMITE]: "Sin contador ni acciones automáticas. La partida espera a cada jugador.",
};

interface CrearSalaProps {
  nombreJugador: string;
  // Devuelve null si la sala se creó, o el mensaje de error a mostrar.
  onCrear: (datos: DatosNuevaSala) => Promise<string | null>;
  onVolver: () => void;
}

function CrearSala({ nombreJugador, onCrear, onVolver }: CrearSalaProps) {
  const [alias, setAlias] = useState(() => aliasSugerido(nombreJugador));
  // Apagado por defecto: las salas son públicas salvo que se pida lo contrario.
  const [privada, setPrivada] = useState(false);
  const [codigo, setCodigo] = useState("");
  // Normal viene marcado: es el ritmo con el que se juega si nadie lo cambia.
  const [ritmo, setRitmo] = useState<Ritmo>(RITMO.NORMAL);
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  const errorAlias = validarAlias(alias);
  // El código solo importa si la sala es privada.
  const errorCodigo = privada ? validarCodigoAcceso(codigo) : null;
  const mostrarErrorAlias = intentoEnviar && errorAlias;
  const mostrarErrorCodigo = intentoEnviar && errorCodigo;

  async function crear(e: FormEvent) {
    e.preventDefault();
    setIntentoEnviar(true);
    if (errorAlias || errorCodigo || creando) return;

    setCreando(true);
    setErrorServidor(null);
    const error = await onCrear({
      alias: alias.trim(),
      privada,
      codigoAcceso: privada ? codigo : undefined,
      ritmo,
    });
    // Si todo salió bien, Navegacion ya cambió de pantalla y este
    // componente se desmontó: no hay que tocar su estado.
    if (error) {
      setErrorServidor(error);
      setCreando(false);
    }
  }

  return (
    <div className="bg-info-subtle min-vh-100 px-3 py-4">
      <div className="mx-auto d-flex flex-column align-items-start gap-3 crear-sala__contenido">
        <Button variant="text" onClick={onVolver}>
          ← Volver
        </Button>

        <Card variant="outlined" className="w-100">
          <CardContent component="form" onSubmit={crear} noValidate className="p-4 d-flex flex-column gap-3">
            <header>
              <div className="d-flex align-items-center gap-3 mb-3">
                <img src="/svg/ciudad.svg" alt="" aria-hidden="true" width={40} height={40} />
                <div>
                  <Typography variant="h5" component="h1">
                    Funda tu sala
                  </Typography>
                  <p className="mb-0 text-body-secondary">Ponle nombre y decide quién puede entrar.</p>
                </div>
              </div>
              <Divider />
            </header>

            <TextField
              id="alias-sala"
              label="Nombre de la sala"
              placeholder="Ej. Isla de los Amigos"
              fullWidth
              autoFocus
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              error={Boolean(mostrarErrorAlias)}
              helperText={
                <span className="d-flex justify-content-between gap-2">
                  <span>{mostrarErrorAlias ? errorAlias : "De 4 a 20 letras, números o espacios."}</span>
                  <span>
                    {alias.trim().length}/{LARGO_MAXIMO_ALIAS}
                  </span>
                </span>
              }
              slotProps={{ htmlInput: { maxLength: LARGO_MAXIMO_ALIAS } }}
            />

            <div
              className={
                "d-flex align-items-center justify-content-between gap-3 p-3 border rounded " +
                (privada ? "bg-danger-subtle border-danger-subtle" : "bg-success-subtle border-success-subtle")
              }
            >
              <div className="d-flex flex-column">
                <span className="fw-semibold" id="privacidad-titulo">
                  {privada ? "🔒 Sala privada" : "🌍 Sala pública"}
                </span>
                <small className="text-body-secondary">
                  {privada
                    ? "Aparece en el listado, pero solo entra quien tenga el código."
                    : "Cualquiera puede verla en el listado y entrar."}
                </small>
              </div>
              <Switch
                checked={privada}
                onChange={(e) => setPrivada(e.target.checked)}
                color="error"
                slotProps={{ input: { "aria-labelledby": "privacidad-titulo" } }}
              />
            </div>

            {privada && (
              <TextField
                id="codigo-sala"
                label="Código de acceso"
                placeholder="Ej. OVEJA7"
                fullWidth
                autoComplete="off"
                value={codigo}
                // Los espacios no se admiten: se quitan mientras se escribe.
                onChange={(e) => setCodigo(e.target.value.replace(/\s/g, ""))}
                error={Boolean(mostrarErrorCodigo)}
                helperText={
                  <span className="d-flex justify-content-between gap-2">
                    <span>{mostrarErrorCodigo ? errorCodigo : "De 4 a 8 letras o números. Distingue mayúsculas."}</span>
                    <span>
                      {codigo.length}/{LARGO_MAXIMO_CODIGO}
                    </span>
                  </span>
                }
                slotProps={{ htmlInput: { maxLength: LARGO_MAXIMO_CODIGO, spellCheck: false } }}
                // Letra monoespaciada para leer bien el código. Sin text-transform:
                // el backend compara el código tal cual se escribió.
                sx={{
                  "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: "1.2rem", letterSpacing: "0.25em" },
                  "& .MuiInputBase-input::placeholder": {
                    fontFamily: (theme: Theme) => theme.typography.fontFamily,
                    fontSize: "1rem",
                    letterSpacing: "normal",
                  },
                }}
              />
            )}

            <FormControl>
              <FormLabel id="ritmo-titulo">Ritmo de la partida</FormLabel>
              <RadioGroup
                aria-labelledby="ritmo-titulo"
                name="ritmo"
                value={String(ritmo)}
                onChange={(e) => setRitmo(Number(e.target.value) as Ritmo)}
              >
                {([RITMO.NORMAL, RITMO.RAPIDO, RITMO.SIN_LIMITE] as Ritmo[]).map((opcion) => (
                  <FormControlLabel
                    key={opcion}
                    value={String(opcion)}
                    control={<Radio />}
                    label={
                      <span className="d-flex flex-column">
                        <span className="fw-semibold">{NOMBRE_RITMO[opcion]}</span>
                        <small className="text-body-secondary">{DESCRIPCION_RITMO[opcion]}</small>
                      </span>
                    }
                    className="mb-1"
                  />
                ))}
              </RadioGroup>
            </FormControl>

            {errorServidor && (
              <Alert severity="error">{errorServidor}</Alert>
            )}

            <Button type="submit" variant="contained" color="error" fullWidth size="large" disabled={creando}>
              {creando ? "Creando sala…" : "🏗️ Crear sala"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CrearSala;
