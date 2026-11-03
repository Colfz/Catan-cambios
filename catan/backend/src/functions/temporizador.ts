//* Cuenta regresiva de una etapa. No depende de Colyseus: la sala la mueve
//* llamando tick() cada segundo, y las pruebas la mueven a mano.
export class Temporizador {
    private segundosRestantes = 0;
    private corriendo = false;
    private readonly alCambiar: (restante: number) => void;
    private readonly alVencer: () => void;

    //* alCambiar avisa del tiempo restante cada vez que cambia
    //* alVencer se llama una sola vez cuando la cuenta llega a 0
    constructor(alCambiar: (restante: number) => void, alVencer: () => void) {
        this.alCambiar = alCambiar;
        this.alVencer = alVencer;
    }

    get restante(): number {
        return this.segundosRestantes;
    }

    get activo(): boolean {
        return this.corriendo;
    }

    //* Empieza (o reinicia) la cuenta. Con 0 segundos no cuenta nada
    iniciar(segundos: number): void {
        this.segundosRestantes = Math.max(0, Math.floor(segundos));
        this.corriendo = this.segundosRestantes > 0;
        this.alCambiar(this.segundosRestantes);
    }

    detener(): void {
        this.corriendo = false;
        this.segundosRestantes = 0;
        this.alCambiar(0);
    }

    //* Pasa un segundo
    tick(): void {
        if (!this.corriendo) return;

        this.segundosRestantes -= 1;
        this.alCambiar(this.segundosRestantes);

        if (this.segundosRestantes <= 0) {
            this.corriendo = false;
            this.alVencer();
        }
    }
}
