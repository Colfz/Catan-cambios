import { Room, Client, CloseCode, Delayed } from "colyseus";
import { StateView } from "@colyseus/schema";
import { CatanState } from "../states/CatanState.js";
import { Jugador } from "../schemas/Jugador.js";
import { Desarrollo, FaseJuego, FasePartida, FasePreconstruccion } from "../common/enums.js";
import { buscarHexagonos } from "../functions/buscarHexagonos.js";
import { darRecursosJugador } from "../functions/darRecursosJugador.js";
import { verticesDelHexagono } from "../functions/verticesDelHexagono.js";
import { lanzarDados } from "../functions/lanzarDados.js";
import { mezclar } from "../common/mezclar.js";
import { siguienteTurno } from "../functions/siguienteTurno.js";
import { construirAsentamiento } from "../functions/construirAsentamiento.js";
import { darMaterialInicial } from "../functions/darMaterialInicial.js";
import { verificarVictoria } from "../functions/verificarVictoria.js";
import { recalcularCaminoMasLargo } from "../functions/puntosCaminoMasLargo.js";
import { sincronizarCantidadesDeMano } from "../functions/cantidadesDeMano.js";
import { construirCiudad } from "../functions/construirCiudad.js";
import { comerciarBanca } from "../functions/comerciarBanca.js";
import { descartarRecurso } from "../functions/descartarRecurso.js";
import { descartarRecursosLote } from "../functions/descartarRecursosLote.js";
import { moverLadron } from "../functions/moverLadron.js";
import { robarJugador } from "../functions/robarJugador.js";
import { jugarCaballero } from "../functions/jugarCaballero.js";
import { activarCartasCompradas } from "../functions/activarCartasCompradas.js";
import { intercambiarRecursos } from "../functions/intercambiarRecursos.js";
import { construirCamino } from "../functions/construirCaminos.js";
import { jugarAbundancia } from "../functions/jugarAbundancia.js";
import { jugarMonopolio } from "../functions/jugarMonopolio.js";
import { siguienteTurnoPreconstruccion } from "../functions/siguienteTurnoPreconstruccion.js";
import { comprarCarta } from "../functions/comprarCarta.js";
import { sacarJugador } from "../functions/sacarJugador.js";
import type { Resultado, SalaAutomatica } from "../functions/automaticos/tipos.js";
import { ejecutarAutomatico } from "../functions/automaticos/despachador.js";
import { Temporizador } from "../functions/temporizador.js";
import { Etapa, ritmoValido, tiempoDeEtapa } from "../functions/ritmos.js";
import { faseTrasLadron } from "../functions/faseTrasLadron.js";


export class CatanRoom extends Room implements SalaAutomatica {
  maxClients = 4;
  state = new CatanState();
  partida = this.state.partida;
  tablero = this.state.tablero;
  banca = this.state.banca;
  jugadores = this.state.jugadores;
  ofertas = new Map<string, unknown>();
  codigoAcceso = "";
  //* Fase a la que se vuelve tras el robo (no se sincroniza con el cliente)
  faseRetornoLadron: FaseJuego = FaseJuego.ACCIONES;

  //* Tiempo limite de cada etapa del turno (se publica en partida.tiempoRestante)
  private temporizador = new Temporizador(
    (restante) => { this.partida.tiempoRestante = restante; },
    () => this.alVencerTiempo()
  );
  //* Identifica la etapa en curso; si cambia, el temporizador vuelve a empezar
  private llaveEtapa = "";


  messages = {

    msgChat: (
      client: Client, 
      mensaje: { mensaje: string}
    ) => {
      //* Verificar que la partida siga en curso
      if (this.partida.fase === FasePartida.FINALIZADA) {
        client.send("error", {
          mensajeError: "La partida ha finalizado"
        })
        return;
      }

      //* Verificar que el mensaje no este vacio
      if (mensaje.mensaje.trim() === "") {
        return;
      }

      //* Enviar el mensaje a todos los jugadores
      this.broadcast("chat", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: mensaje.mensaje
      })
      
    },

    msgIntercambiarBanca: (
      client: Client,
      mensaje: { recursoEntregado: string, recursoRecibido: string }
    ) => {
      //* Turno del jugador (esta accion no comprueba si la partida termino)
      if (this.rechazarTurno(client, false)) return;

      //* Verificar que estemos en la fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termian de lanzar los dados primero"
        })
        return;
      }

      //* Intentar realizar el intercambio con la banca
      const resultado = comerciarBanca(
        this.jugadores.get(client.sessionId), this.banca, client.sessionId,
        this.tablero.vertices, this.tablero.puertos,
        mensaje.recursoEntregado, mensaje.recursoRecibido
      );

      //* Si el intercambio fallo, notificar error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log del intecambio con la banca
      if(!resultado.error){
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

    },

    msgLanzarDados: (client: Client) => {
      this.responder(client, this.ejecutarLanzarDados(client.sessionId));
    },

    msgColocarCiudad: (
      client: Client,
      mensaje: { h: number, d: number, p: number }
    ) => {
      //* Partida en curso y turno del jugador
      if (this.rechazarTurno(client)) return;

      //* Verificar que estemos en la fase de juego
      if (this.partida.fase !== FasePartida.JUEGO) {
        client.send("error", {
          mensajeError: "No es la fase de juego"
        });
        return;
      }

      //* Verificar que estemos en la fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Debes lanzar los dados primero"
        })
        return;
      }

      //* Obtener el jugador del state y que exista
      const jugador = this.jugadores.get(client.sessionId);
      if (!jugador) return;
      const { h, d, p } = mensaje;

      //* Intentar construir la ciudad
      const resultado = construirCiudad(
        this.tablero.vertices,
        h, d, p,
        jugador, this.banca, client.sessionId
      )

      //* Si no se pudo construir, se notifica el error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log de la construccion de la ciudad
      if(!resultado.error){
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

      //* Verificar si el jugador ha ganado
      verificarVictoria(this.partida, jugador, client.sessionId, this);
    },

    msgIniciarPartida: (client: Client) => {
      //* Verificar que sea el creador de la sala
      if (this.partida.creador !== client.sessionId) {
        client.send("error", {
          mensajeError: "Solo el creador puede iniciar la partida"
        });
        return;
      }

      //* Solo se puede iniciar si estamos en la fase de lobby
      if (this.partida.fase !== FasePartida.LOBBY) {
        client.send("error", {
          mensajeError: "La partida ya ha comenzado"
        });
        return;
      }

      //* Verificar que al menos hayan 2 jugadores
      if (this.jugadores.size < 2) {
        client.send("error", {
          mensajeError: "Se necesitan al menos 2 jugadores para iniciar la partida"
        });
        return;
      }

      //* Mezclamos el orden de los jugadores en la partida
      mezclar(this.partida.ordenJugadores);

      //* Le damos el turno al primer jugador en la lista
      this.partida.turnoActual = this.partida.ordenJugadores[0];

      //* Enviar un mensaje a todos que la partida comenzó
      this.broadcast("inicio", {
        mensaje: "La partida ha comenzado",
      });

      //* Cambiamos el estado de la partida a preconstruccion
      this.partida.fase = FasePartida.PRECONSTRUCCION;

      //* Actualización de metadata para mostrar en la Lobby
      //* (setMetadata reemplaza todo, por eso conservamos el resto de campos)
      this.setMetadata({
        ...this.metadata,
        estado: "EN JUEGO"
      });

      //* Cerar la sala para que nadie pueda entrar
      this.lock();

      //* Empieza el tiempo de la primera etapa
      this.sincronizarTemporizador();
    },

    msgPasarTurno: (client: Client) => {
      this.responder(client, this.ejecutarPasarTurno(client.sessionId));
    },

    msgColocarAsentamiento: (
      client: Client,
      mensaje: { h: number, d: number, p: number }
    ) => {
      this.responder(client, this.ejecutarColocarAsentamiento(client.sessionId, mensaje.h, mensaje.d, mensaje.p));
    },

    msgColocarCamino: (
      client: Client,
      mensaje: { h: number, d: number, p: number }
    ) => {
      this.responder(client, this.ejecutarColocarCamino(client.sessionId, mensaje.h, mensaje.d, mensaje.p));
    },

    msgDescartarRecursos: (
      client: Client,
      mensaje: { recurso?: string, recursos?: Record<string, number> }
    ) => {
      this.responder(client, this.ejecutarDescarte(client.sessionId, mensaje.recursos, mensaje.recurso));
    },

    msgMoverLadron: (
      client: Client,
      mensaje: { h: number, d: number }
    ) => {
      this.responder(client, this.ejecutarMoverLadron(client.sessionId, mensaje.h, mensaje.d));
    },

    msgCartaCaballero: (
      client: Client,
      mensaje: { h: number, d: number }
    ) => {
      //* Partida en curso y turno del jugador
      if (this.rechazarTurno(client)) return;

      //* El caballero se puede jugar antes o despues de lanzar los dados
      if (
        this.partida.faseJuego !== FaseJuego.DADOS &&
        this.partida.faseJuego !== FaseJuego.ACCIONES
      ) {
        client.send("error", {
          mensajeError: "No puedes jugar el caballero en este momento"
        })
        return;
      }


      //* Verificar que se permita usar carta
      if (!this.partida.cartaJugable) {
        client.send("error", {
          mensajeError: "Solo una carta por turno"
        })
        return;
      }


      //* Verificar que el jugador tenga la carta de caballero
      const jugador = this.jugadores.get(client.sessionId);
      if (jugador.cartas_usables.get(`${Desarrollo.CABALLERO}`) < 1) {
        client.send("error", {
          mensajeError: "No tienes la carta de caballero"
        })
        return;
      }

      //* Recordar desde que fase se jugo el caballero
      const faseOrigen = this.partida.faseJuego;

      //* Mover al ladron y obtener los jugadores involucrados
      const { h, d } = mensaje;
      const resultado = moverLadron(
        this.tablero,
        this.jugadores,
        client.sessionId,
        h, d);


      //* Si no se puede mover el ladron, notificar error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log del uso de la carta de caballero
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha jugado una carta de caballero"
      })

      //* Eliminar la carta de caballero del jugador
      jugarCaballero(this.jugadores, client.sessionId, this.partida, this); 

      //* Verificar si el jugador ha ganado
      verificarVictoria(this.partida, jugador, client.sessionId, this);
      
      //* Deshabilitar el uso de otra carta este turno
      this.partida.cartaJugable = false;     

      //* Extraemos los jugadores involucrados en el robo
      const jugadoresInvolucrados = resultado.jugadoresInvolucrados;
      const siguienteFase = faseTrasLadron(faseOrigen, jugadoresInvolucrados.length);

      //* Si no hay jugadores, volvemos a la fase de origen
      if (jugadoresInvolucrados.length == 0) {
        this.partida.faseJuego = siguienteFase;
        return;
      }

      //* Si solo hubo un jugador, se le roba automaticamente
      if (jugadoresInvolucrados.length === 1) {
        robarJugador(
          this.jugadores.get(client.sessionId),
          this.jugadores.get(jugadoresInvolucrados[0])
        )

        //* Log del robo automatico
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: ` ha robado un recurso a ${this.jugadores.get(jugadoresInvolucrados[0])?.nombre}`
        })

        this.partida.faseJuego = siguienteFase;
        return;
      }

      //* Al terminar el robo se vuelve a la fase de origen
      this.faseRetornoLadron = faseOrigen;

      //* Si hay 2 o mas jugadores involucrados, se pasa la lista de jugadores
      this.partida.jugadoresParaRobar.clear();
      this.partida.jugadoresParaRobar.push(...jugadoresInvolucrados);


      //? Entramos a fase especial para decidir a quien robar

      this.partida.faseJuego = siguienteFase;
    },

    msgIntercambiarJugador: (
      client: Client,
      mensaje: {
        recursoEntregado: string,
        cantidadEntregada: number,
        recursoRecibido: string,
        cantidadRecibida: number,
      }
    ) => {
      //* Turno del jugador (esta accion no comprueba si la partida termino)
      if (this.rechazarTurno(client, false)) return;

      // * Verificar que estemos en la fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        })
        return;
      }

      // * Verificar que no exista una oferta activa
      if (this.partida.ofertaIntercambio.jugador !== "") {
        client.send("error", {
          mensajeError: "Ya existe una oferta activa"
        })
        return; 
      }

      const jugador = this.jugadores.get(client.sessionId);

      // * Verificar que los recursos sean validos
      if (
        !jugador.recursos.has(mensaje.recursoEntregado) ||
        !jugador.recursos.has(mensaje.recursoRecibido)
      ) {
        client.send("error", {
          mensajeError: "Los Recursos seleccionados no son validos"
        })
        return;
      }

      // * Verificar que las cantidades tengan sentido
      if (mensaje.cantidadEntregada <= 0 || mensaje.cantidadRecibida <= 0) {
        client.send("error", {
          mensajeError: "No tienes suficientes recuros, mi loco"
        })
        return;
      }

      // * No se permite pedir y dar lo mismo
      if (mensaje.recursoEntregado === mensaje.recursoRecibido) {
        client.send("error", {
          mensajeError: "No puedes pedir y dar el mismo recurso"
        })
        return;
      }

      // * Llenado de la oferta
      this.partida.ofertaIntercambio.setOferta(
        client.sessionId, this.jugadores,
        mensaje.recursoEntregado, mensaje.cantidadEntregada,
        mensaje.recursoRecibido, mensaje.cantidadRecibida
      );

      //* Log de la oferta de intercambio
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha hecho una oferta de intercambio"
      })

    },

    msgResponderIntercambio: (
      client: Client,
      mensaje: { respuesta: number }
    ) => {
      // * Verificar que exista una oferta activa
      if (this.partida.ofertaIntercambio.jugador === "") {
        client.send("error", {
          mensajeError: "No hay una oferta activa"
        })
        return;
      }

      // * Verificar que no sea el jugador que la propuso
      if (!this.partida.ofertaIntercambio.respuestas.has(client.sessionId)) {
        client.send("error", {
          mensajeError: "No puedes responde a esta oferta"
        })
        return;
      }

      // * Verificar que el jugador aún deba reponder
      if (this.partida.ofertaIntercambio.respuestas.get(client.sessionId) !== 0) {
        client.send("error", {
          mensajeError: "Ya respondiste a esta oferta"
        })
        return;
      }

      // * Verificar que sea una respueta valida
      if (mensaje.respuesta !== 1 && mensaje.respuesta !== -1) {
        client.send("error", {
          mensajeError: "Respuesta invalida"
        })
        return;
      }

      // ! Rechazo
      if (mensaje.respuesta === -1) {
        this.partida.ofertaIntercambio.registrarRespuesta(client.sessionId, -1);
        //* Log de rechazo de la oferta
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: " ha rechazado la oferta de intercambio"
        })

         // * Verificar si todos rechazaron
        if (this.partida.ofertaIntercambio.todosRechazaron()) {
          this.partida.ofertaIntercambio.limpiarOferta();
          this.broadcast("log", {
            jugador: "Sistema: ",
            mensaje: "Todos los jugadores han rechazado la oferta de intercambio"
          });
        }

        return;
      }

      const jugador = this.jugadores.get(client.sessionId);
      const jugadorOferta = this.jugadores.get(this.partida.ofertaIntercambio.jugador);

      // ? Acepto
      if (mensaje.respuesta === 1) {
        // * Destruir la ofera si el jugador que propuso ya gastó
        if (jugadorOferta.recursos.get(
          this.partida.ofertaIntercambio.recursoOfrecido
        ) < this.partida.ofertaIntercambio.cantidadOfrecida) {
          this.partida.ofertaIntercambio.limpiarOferta();

          client.send("error", {
            mensajeError: "Oferta cancelada, el negociante no tiene ya recursos"
          })

          return;
        }

        // * Verificar que el jugadr que acepta tenga suficientes recursos
        if (jugador.recursos.get(
          this.partida.ofertaIntercambio.recursoSolicitado
        ) < this.partida.ofertaIntercambio.cantidadSolicitada) {
          // * Automaticamente pasarlo a rechazo
          this.partida.ofertaIntercambio.registrarRespuesta(client.sessionId, -1);
          // * Verificar si todos rechazaron
          if (this.partida.ofertaIntercambio.todosRechazaron()) {
            this.partida.ofertaIntercambio.limpiarOferta();
          }
          return;
        }

        // * Intercambiar los recursos
        intercambiarRecursos(
          this.partida.ofertaIntercambio.jugador,
          client.sessionId,
          this.jugadores,
          this.partida.ofertaIntercambio
        );

        //* Log del intercambio de recursos
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: " ha aceptado la oferta de intercambio"
        })

        // * Destruir la oferta
        this.partida.ofertaIntercambio.limpiarOferta();
      }
    },

    msgComprarCarta: (client: Client) => {
        //* Partida en curso y turno del jugador
        if (this.rechazarTurno(client)) return;

        //* Verificar que estamos en fase de acciones
        if(this.partida.faseJuego !== FaseJuego.ACCIONES){
            client.send("error", {
                mensajeError: "Termina de lanzar los dados primero"
            })
            return;
        }

        //* Intentar comprar la carta
        const resultado = comprarCarta(
            this.jugadores.get(client.sessionId), this.banca
        )

        //* Si no se pudo comprar, notificar error
        if(resultado.error){
            client.send("error", {
                mensajeError: resultado.mensaje
            })
            return;    
        }

        //* Log de la compra de la carta
        if(!resultado.error){
            this.broadcast("log", {
                jugador: this.jugadores.get(client.sessionId)?.nombre,
                mensaje: resultado.mensaje
            })
        }

        //* Verificar si el jugador ha ganado
        verificarVictoria(this.partida, this.jugadores.get(client.sessionId), client.sessionId, this);
    },

    msgCartaCarreteras: (client: Client) => {
      // * Verificar que la partida siga en curso
      //* Partida en curso y turno del jugador
      if (this.rechazarTurno(client)) return;

      //* Verificar que se permita usar carta
      if(!this.partida.cartaJugable){
        client.send("error", {
          mensajeError: "Solo una carta por turno"
        })
        return;
      }

      // * Verificar que estemos en fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        })
        return;
      }

      // * Verificar que tenemos la carta usable
      const jugador = this.jugadores.get(client.sessionId);
      if (jugador.cartas_usables.get(`${Desarrollo.CARRETERA}`) < 1) {
        client.send("error", {
          mensajeError: "No tienes la carta de carreteras"
        })
        return;
      }

      // * Eliminar la carta de carreteras del jugador
      jugador.cartas_usables.set(
        `${Desarrollo.CARRETERA}`,
        jugador.cartas_usables.get(`${Desarrollo.CARRETERA}`) - 1
      )

      // * Activar el efeco de la carta de carreteras
      this.partida.carreterasGratis = 2;
      this.partida.faseJuego = FaseJuego.CARRETERAS;

      // * Desactivar el uso de otra carta este turno
      this.partida.cartaJugable = false;

      //* Log de la carta de carreteras
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha jugado una carta de carreteras"
      })
    },

    msgCaminoGratis: (
      client: Client,
      mensaje: { h: number, d: number, p: number }
    ) => {
      //* Partida en curso y turno del jugador
      if (this.rechazarTurno(client)) return;

      // * Verificar que estemos en la fase de carretera
      if (this.partida.faseJuego !== FaseJuego.CARRETERAS) {
        client.send("error", {
          mensajeError: "No es la fase de carreteras"
        })
        return;
      }

      // * Obtener al jugador del state y que exista
      const jugador = this.jugadores.get(client.sessionId);
      if (!jugador) return;
      const { h, d, p } = mensaje;

      // * Intentar construir el camino gratis
      const resultado = construirCamino(
        this.tablero.vertices,
        this.tablero.aristas,
        this.partida,
        h, d, p,
        jugador, this.banca, client.sessionId
      )

      // * Si no se pudo construir, se notifica el error
      if (resultado.error && resultado.mensaje !== "No tienes caminos disponibles") {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      // * El camino nuevo puede darle el camino mas largo
      if (!resultado.error) {
        this.actualizarCaminoMasLargo();
        verificarVictoria(this.partida, jugador, client.sessionId, this);
      }

      // * Reducir la cantidad de caminos gratis restantes
      this.partida.carreterasGratis -= 1;

      // * Si ya no quedan caminos gratis, volver a fase de acciones
      if (this.partida.carreterasGratis === 0) {
        this.partida.faseJuego = FaseJuego.ACCIONES
      }
    },

    msgCartaAbundancia: (
      client: Client,
      mensaje: { recurso1: string, recurso2: string }
    ) => {
      //* Partida en curso y turno del jugador
      if (this.rechazarTurno(client)) return;

      //* Verificar que estamos en fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        })
        return;
      }


      //* Verificar si se permite usar carta
      if (!this.partida.cartaJugable) {
        client.send("error", {
          mensajeError: "solo una carta por turno"
        })
        return;
      }

      //* Verificar que tenga la carta de abundancia
      const jugador = this.jugadores.get(client.sessionId);
      if (jugador.cartas_usables.get(`${Desarrollo.ABUNDANCIA}`) < 1) {
        client.send("error", {
          mensajeError: "No tienes la carta de abundancia"
        })
        return;
      }


      //* Intentar jugar la carta de abundancia
      const resultado = jugarAbundancia(
        jugador, this.banca, mensaje.recurso1, mensaje.recurso2
      );

      //* Si no puede jugar, notificar error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        })
        return;
      }

      //* Log de la carta de abundancia
      if(!resultado.error){
        this.broadcast("log", {
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

      //* Marcar que ya se utilizo una carta en este turno
      this.partida.cartaJugable = false;

    },

    msgCartaMonopolio: (
      client: Client,
      mensaje: { recurso: string }
    ) => {
      //* Partida en curso y turno del jugador
      if (this.rechazarTurno(client)) return;

      //* Verificar que estamos en fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        client.send("error", {
          mensajeError: "Termina de lanzar los dados primero"
        });
        return;
      }

      //* Verificar que se permite usar carta
      if (!this.partida.cartaJugable) {
        client.send("error", {
          mensajeError: "Solo una carta por turno"
        });
        return;
      }

      //* Verificar que tenga la carta de monopolio
      const jugador = this.jugadores.get(client.sessionId);

      if (jugador.cartas_usables.get(`${Desarrollo.MONOPOLIO}`) < 1) {
        client.send("error", {
          mensajeError: "No tienes la carta de monopolio"
        });
        return;
      }

      //* Intentar jugar la carta de monopolio
      const resultado = jugarMonopolio(
        this.jugadores,
        client.sessionId,
        mensaje.recurso
      );

      //* Si no se pudo jugar, notificar error
      if (resultado.error) {
        client.send("error", {
          mensajeError: resultado.mensaje
        });
        return;
      }

      //* Log de la carta de monopolio
      if(!resultado.error){
        this.broadcast("log", { 
          jugador: this.jugadores.get(client.sessionId)?.nombre,
          mensaje: resultado.mensaje
        })
      }

      //* Marcar que ya se utilizo una carta en este turno
      this.partida.cartaJugable = false;
    },

    msgRobarJugador: (
      client: Client,
      mensaje: { jugadorRobado: string }
    ) => {
      this.responder(client, this.ejecutarRobar(client.sessionId, mensaje.jugadorRobado));
    }
    
  };

  //* ---------------------------------------------------------------------
  //* Acciones del juego. Los handlers de messages solo las llaman con el
  //* sessionId del cliente; el servidor las usa igual para actuar por un
  //* jugador (temporizador). Devuelven { error, mensaje } en vez de enviar
  //* nada al cliente.
  //* ---------------------------------------------------------------------

  private exito(): Resultado {
    return { error: false, mensaje: "" };
  }

  private fallo(mensaje: string): Resultado {
    return { error: true, mensaje };
  }

  //* La validacion que comparten casi todas las acciones: la partida sigue en curso
  //* y es el turno del jugador. Con partidaEnCurso en false solo se comprueba el turno.
  //* Devuelve el error, o null si se puede seguir
  private validarTurno(sessionId: string, partidaEnCurso = true): Resultado | null {
    if (partidaEnCurso && this.partida.fase === FasePartida.FINALIZADA) {
      return this.fallo("La partida ha finalizado");
    }
    if (this.partida.turnoActual !== sessionId) {
      return this.fallo("No es tu turno");
    }
    return null;
  }

  //* validarTurno para los mensajes: si falla, avisa al cliente y devuelve true
  private rechazarTurno(client: Client, partidaEnCurso = true): boolean {
    const rechazo = this.validarTurno(client.sessionId, partidaEnCurso);
    if (rechazo) this.responder(client, rechazo);
    return rechazo !== null;
  }

  //* Recalcula quien tiene el camino mas largo (y sus 2 puntos) tras cambiar caminos o construcciones
  private actualizarCaminoMasLargo() {
    recalcularCaminoMasLargo(this);
  }

  //* Si la accion falla, avisa de ese error solo al cliente que la pidio
  private responder(client: Client, resultado: Resultado) {
    if (resultado.error) {
      client.send("error", {
        mensajeError: resultado.mensaje
      })
    }

    //* La accion pudo cambiar la etapa o el turno, y las manos
    this.sincronizarTemporizador();
    sincronizarCantidadesDeMano(this.jugadores);
  }

  ejecutarLanzarDados(sessionId: string): Resultado {
    //* Partida en curso y turno del jugador
    const rechazo = this.validarTurno(sessionId);
    if (rechazo) return rechazo;

    //* Verificar que estemos en la fase de juego
    if (this.partida.fase !== FasePartida.JUEGO) {
      return this.fallo("No es la fase de juego");
    }

    //* Verificar que estemos en la fase de lanzar dados
    if (this.partida.faseJuego !== FaseJuego.DADOS) {
      return this.fallo("Ya lanzaste los dados");
    }

    //* Lanzamiento de dados
    const { dado1, dado2, suma } = lanzarDados();

    //? Notificar a todos los jugadores el resultado de los dados
    this.broadcast("dados", {
      dado1,
      dado2,
      suma
    })

    //! Si sale 7 toda la logica cambia, entramos a fase de robo y/o ladron
    if (suma === 7) {

      //* Limpiar a los jugadors que deben descartar
      this.partida.jugadoresParaDescartar.clear();

      //* Ver el total de cartas de cada jugador
      this.jugadores.forEach((jugador, id) => {
        let totalRecursos = 0;

        //* contando la cantidad de recursos
        jugador.recursos.forEach(cantidad => {
          totalRecursos += cantidad;
        });

        //* Si tiene mas de 7, debe descartar la mitad
        if (totalRecursos > 7) {
          this.partida.jugadoresParaDescartar.set(id, Math.floor(totalRecursos / 2));
        }

      });

      //* Log de que salio 7
      this.broadcast("log", {
        jugador: this.jugadores.get(sessionId)?.nombre,
        mensaje: " ha sacado 7, se mueve el ladron"
      })

      //*Verificar si alguien tiene descarte, para enviarlo a fase de descarte
      if (this.partida.jugadoresParaDescartar.size > 0) {
        this.partida.faseJuego = FaseJuego.DESCARTE

        //* Log de cada jugador que debe descartar
        this.partida.jugadoresParaDescartar.forEach((cantidad, id) => {
          this.broadcast("log", {
            jugador: this.jugadores.get(id)?.nombre,
            mensaje: ` debe descartar ${cantidad} cartas`
          })
        })
      } else {
        this.partida.faseJuego = FaseJuego.LADRON
      }

      return this.exito();

    }

    //* Buscar los hexagonos con dicho numero resultado de la suma de los dados
    const hexagonosEncontrados = buscarHexagonos(this.tablero.hexagonos, suma);

    //* Traer los vertices adyacentes para cada hexagono encontrado
    hexagonosEncontrados.forEach((hexagono) => {
      const vertices = verticesDelHexagono(this.tablero.vertices, hexagono);

      //* Dar los recursos correspondientes en cada vertice encontrado
      vertices.forEach((vertice) => {
        darRecursosJugador(
          hexagono,
          vertice,
          this.jugadores,
          this.banca,
          this.tablero.ladron);
      })
    })
    this.partida.faseJuego = FaseJuego.ACCIONES;
    return this.exito();
  }

  ejecutarPasarTurno(sessionId: string): Resultado {
    //* Partida en curso y turno del jugador
    const rechazo = this.validarTurno(sessionId);
    if (rechazo) return rechazo;

    //* Solo se puede pasar turno en fase de acciones
    if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
      return this.fallo("Termina de lanzar los dados primero");
    }

    //* Log de paso de turno
    this.broadcast("log", {
      jugador: this.jugadores.get(sessionId)?.nombre,
      mensaje: " ha pasado su turno"
    })

    this.ofertas.clear();

    /** Activar las cartas compradas del jugador */
    activarCartasCompradas(this.jugadores.get(sessionId));

    /** Permitir usar una carta en el siguiente turno */
    this.partida.cartaJugable = true;

    //* Cancelar ofertas de intercambio activas
    this.partida.ofertaIntercambio.limpiarOferta()

    siguienteTurno(this.partida);
    return this.exito();
  }

  ejecutarColocarAsentamiento(sessionId: string, h: number, d: number, p: number): Resultado {
    //* Partida en curso y turno del jugador
    const rechazo = this.validarTurno(sessionId);
    if (rechazo) return rechazo;

    const jugador = this.jugadores.get(sessionId);
    if (!jugador) return this.exito();

    //! FLUJO DE LA FASE PRECONSTRUCCION
    if (this.partida.fase === FasePartida.PRECONSTRUCCION) {
      //* Comprobar que estamos en la fase de colocar asentamiento
      if (this.partida.fasePreconstruccion !== FasePreconstruccion.ASENTAMIENTO) {
        return this.fallo("Debes colocar un camino");
      }

      //* Intentar construir el asentamiento
      const resultado = construirAsentamiento(
        this.tablero.vertices,
        this.tablero.aristas,
        this.partida,
        h, d, p,
        jugador,
        this.banca,
        sessionId)

      if (resultado.error) {
        return this.fallo(resultado.mensaje);
      }

      //* Log de la construccion del asentamiento
      this.broadcast("log", {
        jugador: this.jugadores.get(sessionId)?.nombre,
        mensaje: resultado.mensaje
      })

      //* Si estamos en vuelta de regreso de la preconstruccion
      if (this.partida.direccionPreconstruccion === -1) {
        darMaterialInicial(this.tablero.hexagonos, jugador, h, d, p, this.banca);
      }

      this.partida.fasePreconstruccion = FasePreconstruccion.CAMINO;
      return this.exito();

    }

    //!FLUJO EN JUEGO
    if (this.partida.fase == FasePartida.JUEGO) {
      //* Comprobar que estamos en la fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        return this.fallo("Debes lanzar los dados primero");
      }

      //* Intentar construir asentamiento
      const resultado = construirAsentamiento(
        this.tablero.vertices,
        this.tablero.aristas,
        this.partida,
        h, d, p,
        jugador,
        this.banca,
        sessionId
      )

      //* Si algo fallo en la construccion, indicar el error
      if (resultado.error) {
        return this.fallo(resultado.mensaje);
      }

      //* Log de la construccion del asentamiento
      this.broadcast("log", {
        jugador: this.jugadores.get(sessionId)?.nombre,
        mensaje: resultado.mensaje
      })

      //* El asentamiento puede cortar el camino de un rival y cambiar el camino mas largo
      this.actualizarCaminoMasLargo();

      //* Verificar si el jugador ha ganado
      verificarVictoria(this.partida, jugador, sessionId, this);
    }

    return this.exito();
  }

  ejecutarColocarCamino(sessionId: string, h: number, d: number, p: number): Resultado {
    //* Partida en curso y turno del jugador
    const rechazo = this.validarTurno(sessionId);
    if (rechazo) return rechazo;

    //* Obtener el jugador del state y que exista
    const jugador = this.jugadores.get(sessionId);
    if (!jugador) return this.exito();

    //! FLUJO EN PRECONSTRUCCION
    if (this.partida.fase === FasePartida.PRECONSTRUCCION) {

      //* Comprobar que estemos en la fase de colocar camino
      if (this.partida.fasePreconstruccion !== FasePreconstruccion.CAMINO) {
        return this.fallo("Coloca primero un asentamiento");
      }

      //* Intentar construir el camino
      const resultado = construirCamino(
        this.tablero.vertices, this.tablero.aristas, this.partida,
        h, d, p, jugador, this.banca, sessionId
      )

      //* Si no se pudo construir, se notifica el error
      if (resultado.error) {
        return this.fallo(resultado.mensaje);
      }

      //* Log de la construccion del camino
      this.broadcast("log", {
        jugador: this.jugadores.get(sessionId)?.nombre,
        mensaje: resultado.mensaje
      })

      //? Ahora le toca al siguiente jugador poner un asentamiento
      this.partida.fasePreconstruccion = FasePreconstruccion.ASENTAMIENTO;
      siguienteTurnoPreconstruccion(this.partida);
      return this.exito();
    }

    //! FLUJO EN JUEGO
    if (this.partida.fase === FasePartida.JUEGO) {

      //* Comprobar que estemos en la fase de acciones
      if (this.partida.faseJuego !== FaseJuego.ACCIONES) {
        return this.fallo("Debes lanzar los dados primero");
      }

      //* Intentar construir el camino
      const resultado = construirCamino(
        this.tablero.vertices, this.tablero.aristas, this.partida,
        h, d, p, jugador, this.banca, sessionId
      )

      //* Si no se pudo construir, se notifica el error
      if (resultado.error) {
        return this.fallo(resultado.mensaje);
      }

      //* Log de la construccion del camino
      this.broadcast("log", {
        jugador: this.jugadores.get(sessionId)?.nombre,
        mensaje: resultado.mensaje
      })

      //* El camino nuevo puede darle el camino mas largo
      this.actualizarCaminoMasLargo();

      //* Verificar si el jugador ha ganado
      verificarVictoria(this.partida, jugador, sessionId, this);
    }

    return this.exito();
  }

  //* Descarta por lote si llegan "recursos", o una sola carta si llega "recurso"
  ejecutarDescarte(sessionId: string, recursos?: Record<string, number>, recurso?: string): Resultado {
    //* Verificar si estamos en fase de descarte
    if (this.partida.faseJuego !== FaseJuego.DESCARTE) {
      return this.fallo("No es la fase de descarte");
    }

    //* Verificar si el jugador esta en la lista de descarte
    if (!this.partida.jugadoresParaDescartar.has(sessionId)) {
      return this.fallo("No tienes que descartar");
    }

    //* Encontrar al jugador que debe descartar
    const jugadorPorDescartar = sessionId;

    //* Cartas que le faltan por descartar
    const cartasDebidas = this.partida.jugadoresParaDescartar.get(jugadorPorDescartar);

    //* Intentar descartar, por lote si llega "recursos" o una sola carta si llega "recurso"
    const resultado = recursos
      ? descartarRecursosLote(
        this.jugadores.get(jugadorPorDescartar),
        this.banca,
        recursos,
        cartasDebidas
      )
      : descartarRecurso(
        this.jugadores.get(jugadorPorDescartar),
        this.banca,
        recurso
      );

    //*Error en descarte
    if (resultado.error) {
      return this.fallo(resultado.mensaje);
    }

    //*Actualizar la cantidad de recursos que le faltan por descartar
    this.partida.jugadoresParaDescartar.set(
      jugadorPorDescartar,
      recursos ? 0 : cartasDebidas - 1
    );

    //* Eliminarlo de la lista si ya no tiene que descartar
    if (this.partida.jugadoresParaDescartar.get(jugadorPorDescartar) === 0) {
      this.partida.jugadoresParaDescartar.delete(jugadorPorDescartar);
      //* Log de terminacion de descarte
      this.broadcast("log", {
        jugador: this.jugadores.get(sessionId)?.nombre,
        mensaje: " ha terminado de descartar"
      })
    }

    //* Verificar si ya no hay jugadores que deben descartar, para pasar a fase de ladron
    if (this.partida.jugadoresParaDescartar.size == 0) {
      this.partida.faseJuego = FaseJuego.LADRON;
      //* Log de todos descartaron
      this.broadcast("log", {
        jugador: "Sistema: ",
        mensaje: "Todos los jugadores han terminado de descartar"
      })
    }

    return this.exito();
  }

  ejecutarMoverLadron(sessionId: string, h: number, d: number): Resultado {
    //* Turno del jugador (esta accion no comprueba si la partida termino)
    const rechazo = this.validarTurno(sessionId, false);
    if (rechazo) return rechazo;

    //*Verificar que estemos en la fase de juego
    if (this.partida.fase !== FasePartida.JUEGO) {
      return this.fallo("No es la fase de juego");
    }

    //* Verificar que estemos en la fase de mover al ladron
    if (this.partida.faseJuego !== FaseJuego.LADRON) {
      return this.fallo("No es la fase de mover al ladron");
    }

    //* Mover al ladron y obtener los jugadores involucrados
    const resultado = moverLadron(
      this.tablero,
      this.jugadores,
      sessionId,
      h, d
    );

    if (resultado.error) {
      return this.fallo(resultado.mensaje);
    }

    //* Log de movimiento del ladron
    this.broadcast("log", {
      jugador: this.jugadores.get(sessionId)?.nombre,
      mensaje: resultado.mensaje
    })

    //*Extraemos los jugadores involucrados en el robo
    const jugadoresinvolucrados = resultado.jugadoresInvolucrados;

    //* Si no hay jugadores pasamos a las acciones
    if (jugadoresinvolucrados.length === 0) {
      this.partida.faseJuego = FaseJuego.ACCIONES;
      return this.exito();
    }

    //*Si solo hubo un jugador, se le roba automaticamente
    if (jugadoresinvolucrados.length === 1) {
      robarJugador(
        this.jugadores.get(sessionId),
        this.jugadores.get(jugadoresinvolucrados[0])
      )
      this.partida.faseJuego = FaseJuego.ACCIONES;

      //* Log del robo automatico
      this.broadcast("log", {
        jugador: this.jugadores.get(sessionId)?.nombre,
        mensaje: ` ha robado un recurso a ${this.jugadores.get(jugadoresinvolucrados[0])?.nombre}`
      })
      return this.exito();
    }

    //* El ladron por un 7 siempre vuelve a ACCIONES
    this.faseRetornoLadron = FaseJuego.ACCIONES;

    //* Si hay 2 o mas jugadores involucrados, se pasa la lista de jugadores
    this.partida.jugadoresParaRobar.clear();
    this.partida.jugadoresParaRobar.push(...jugadoresinvolucrados);

    this.partida.faseJuego = FaseJuego.ROBO
    return this.exito();
  }

  ejecutarRobar(sessionId: string, victima: string): Resultado {
    //* Partida en curso y turno del jugador
    const rechazo = this.validarTurno(sessionId);
    if (rechazo) return rechazo;

    //* Verificar que estemos en la fase de robar
    if (this.partida.faseJuego !== FaseJuego.ROBO) {
      return this.fallo("No es la fase de robar");
    }

    //* Verificar que el jugador elegido este en la lista de robo
    if (!this.partida.jugadoresParaRobar.includes(victima)) {
      return this.fallo("El jugador elegido no esta en la lista de robo");
    }

    //* Robar un recurso al azar al jugador elegido
    robarJugador(this.jugadores.get(sessionId), this.jugadores.get(victima));

    //* Log del robo
    this.broadcast("log", {
      jugador: this.jugadores.get(sessionId)?.nombre,
      mensaje: ` ha robado un recurso a ${this.jugadores.get(victima)?.nombre}`
    })

    //* Limpiar Lista y volver a la fase de origen (DADOS si fue un caballero antes de tirar)
    this.partida.jugadoresParaRobar.clear();
    this.partida.faseJuego = this.faseRetornoLadron;
    this.faseRetornoLadron = FaseJuego.ACCIONES;
    return this.exito();
  }

  //* Se pierden las carreteras gratis que falten y se vuelve a las acciones
  ejecutarCancelarCarreteras(sessionId: string): Resultado {
    //* Partida en curso y turno del jugador
    const rechazo = this.validarTurno(sessionId);
    if (rechazo) return rechazo;

    //* Verificar que estemos en la fase de carreteras
    if (this.partida.faseJuego !== FaseJuego.CARRETERAS) {
      return this.fallo("No es la fase de carreteras");
    }

    this.partida.carreterasGratis = 0;
    this.partida.faseJuego = FaseJuego.ACCIONES;
    return this.exito();
  }


  //* ---------------------------------------------------------------------
  //* Temporizador de etapas
  //* ---------------------------------------------------------------------

  //* Etapa con tiempo limite en este momento. null si no hay (lobby o partida terminada)
  private etapaActual(): Etapa | null {
    if (this.partida.fase === FasePartida.PRECONSTRUCCION) return Etapa.COLOCACION;
    if (this.partida.fase !== FasePartida.JUEGO) return null;

    switch (this.partida.faseJuego) {
      case FaseJuego.DADOS: return Etapa.DADOS;
      case FaseJuego.ACCIONES: return Etapa.ACCIONES;
      case FaseJuego.LADRON: return Etapa.LADRON;
      case FaseJuego.ROBO: return Etapa.ROBO;
      case FaseJuego.DESCARTE: return Etapa.DESCARTE;
      case FaseJuego.CARRETERAS: return Etapa.CARRETERAS;
      default: return null;
    }
  }

  //* Reinicia el conteo cuando cambia la etapa o el turno, y lo detiene si ya no hay etapa.
  //* Con forzar se reinicia aunque la etapa sea la misma.
  sincronizarTemporizador(forzar = false) {
    const etapa = this.etapaActual();

    if (etapa === null) {
      this.llaveEtapa = "";
      this.temporizador.detener();
      return;
    }

    const llave = [
      this.partida.turnoActual,
      this.partida.fase,
      this.partida.faseJuego,
      this.partida.fasePreconstruccion,
      this.partida.direccionPreconstruccion
    ].join("|");

    if (!forzar && llave === this.llaveEtapa) return;

    this.llaveEtapa = llave;
    //* Con el ritmo "Sin limite" el tiempo es 0 y no se cuenta nada
    this.temporizador.iniciar(tiempoDeEtapa(this.partida.ritmo, etapa));
  }

  //* Cada segundo
  tick() {
    this.sincronizarTemporizador();
    sincronizarCantidadesDeMano(this.jugadores);
    this.temporizador.tick();
  }

  //* Se acabo el tiempo: el servidor actua por el jugador
  private alVencerTiempo() {
    const etapa = this.etapaActual();

    if (etapa !== null) {
      try {
        ejecutarAutomatico(this, etapa);
      } catch (error) {
        console.error("Fallo la accion automatica", error);
      }
    }

    //* Siempre se vuelve a contar, cambie o no la etapa, para que la partida no quede parada
    this.sincronizarTemporizador(true);
  }

  onCreate(options: any) {
    console.log("room created!", this.roomId);
    //* si se ingresa codigo de acceso, se setea al atributo de codigo de acceso a la sala
    this.codigoAcceso = options.codigoAcceso || ""

    //* El ritmo lo elige quien crea la sala y decide el tiempo de cada etapa
    this.partida.ritmo = ritmoValido(options.ritmo);

    //* Cada segundo avanza el temporizador de la etapa
    this.clock.setInterval(() => this.tick(), 1000);

    //* seteamos la data de la sala
    this.setMetadata({
      alias: options.alias || "Catan Room",
      estado: "EN LOBBY",
      privada: options.privada || false,
      anfitrion: options.nombre || ""
    })
  }

  onJoin(client: Client, options: any) {

    if(this.partida.fase !== FasePartida.LOBBY){
      throw new Error("La partida ya ha comenzado, no puedes unirte");
    }
    if (this.codigoAcceso !== "") {
      if (options.codigoAcceso !== this.codigoAcceso) {
        throw new Error("Codigo de acceso incorrecto");
      }
    }
    console.log(`${client.sessionId} joined the room`);

    this.partida.ordenJugadores.push(client.sessionId);

    this.jugadores.set(client.sessionId, new Jugador(options.nombre));
    this.asignarVista(client);

    if (this.partida.creador == "") {
      this.partida.creador = client.sessionId;
    }
  }

  onLeave(client: Client, code: CloseCode) {

    console.log(`${client.sessionId} left the room`);

    //* Primero revisamos si estamos en la fase de lobby
    if (this.partida.fase === FasePartida.LOBBY) {
      //* Sacamos al jugador que salio
      this.jugadores.delete(client.sessionId);

      //* Borrar al jugador del orden de jugadores
      const indice = this.partida.ordenJugadores.indexOf(client.sessionId);
      if (indice !== -1) {
        this.partida.ordenJugadores.splice(indice, 1);
      }

      //* Si se fue el creador, el siguiente en entrar pasa a ser el anfitrión
      if (this.partida.creador === client.sessionId) {
        this.partida.creador = this.partida.ordenJugadores[0] ?? "";
        this.setMetadata({
          ...this.metadata,
          anfitrion: this.jugadores.get(this.partida.creador)?.nombre ?? ""
        });
      }
      return;
    }

    //* Si ya se estaba jugando se debe eliminar completamente
    if (this.partida.fase === FasePartida.JUEGO || this.partida.fase === FasePartida.PRECONSTRUCCION) {
      //* Ver si era el creador de la sala
      const eraCreador = this.partida.creador === client.sessionId;
      
      //* Avisar del abandono
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " ha abandonado la partida"
      })

      sacarJugador(this.partida, this.tablero, this.banca, this.jugadores, client.sessionId);

      //* Sus caminos y construcciones ya no estan: el camino mas largo puede cambiar
      this.actualizarCaminoMasLargo();

      //* Al salir puede cambiar el turno o la etapa, o terminar la partida
      this.sincronizarTemporizador();

      //* Si la fase de robo se desbloqueo, no dejar una fase de retorno vieja
      if (this.partida.faseJuego !== FaseJuego.ROBO) {
        this.faseRetornoLadron = FaseJuego.ACCIONES;
      }

      //* Actualizar el creador si era el que abandono
      if(eraCreador){
        this.setMetadata({
          ...this.metadata,
          anfitrion: this.jugadores.get(this.partida.creador)?.nombre ?? ""
        })
      }

      //* Si al sacarlo se gana avisar
      //* sacarJugador puede haber terminado la partida (el tipo ya no lo sabe)
      if ((this.partida.fase as FasePartida) === FasePartida.FINALIZADA){
        this.broadcast("log", {
          jugador: "Sistema: ",
          mensaje: `${this.jugadores.get(this.partida.ganador)?.nombre} gana por abandono...`
        })
      }
    }
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
    this.temporizador.detener();
  }

  //* Si un cliente se desconecta tiene 30 segundos para reconectarse
  onDrop(client: Client, code: CloseCode) {
    
    console.log(`${client.sessionId} droppef with code ${code}`);
    //* Avisar en el log que alguient tuvo una caida de conexion
    if(this.partida.fase !== FasePartida.LOBBY){
      this.broadcast("log", {
        jugador: this.jugadores.get(client.sessionId)?.nombre,
        mensaje: " perdio la conexion, tiene 1 minuto para reconectarse"
      })
    }

    //*Activar la espera de reconexion por 60 segundos
    this.allowReconnection(client, 30);
  }

  //* Cada cliente solo recibe lo privado de su propio jugador: sus puntos de victoria ocultos,
  //* sus recursos y sus cartas de desarrollo. De los rivales solo llegan las cantidades
  asignarVista(client: Client) {
    const jugador = this.jugadores.get(client.sessionId);
    if (!jugador) return;
    client.view = new StateView();
    client.view.add(jugador.privado);
    client.view.add(jugador.recursos);
    client.view.add(jugador.cartas_usables);
    client.view.add(jugador.cartas_inusables);
  }

  onReconnect(client: Client) {
    console.log(`${client.sessionId} reconnected`);
    this.asignarVista(client);
    //* Avisar que logro reconectarse
    this.broadcast("log", {
      jugador: "Sistema: ",
      mensaje: `${this.jugadores.get(client.sessionId)?.nombre} se ha reconectado`
    })
  }
}