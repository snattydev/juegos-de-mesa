"use strict";

/**
 * Después de las doce — mazo de cartas.
 * Carga los datos en window.DESPUES_DATA para que el juego abra desde disco,
 * sin fetch ni módulos.
 *
 * Estructura por carta: [intensity, type, audience, text]
 *   intensity: previa | caliente | sin-filtro
 *   type:      verdad | reto | deseo
 *   audience:  solo (pareja) | grupo | ambos
 *
 * Convención de idioma: "la otra persona" en solo (sin asumir género),
 * "alguien del grupo" en grupo (sin nombres fijos), y en ambos frases que
 * funcionen en las dos situaciones.
 */

(function () {
  var INTENSITIES = {
    previa: { label: "Previa", tagline: "Tensión y química" },
    caliente: { label: "Caliente", tagline: "Contacto y confesiones" },
    "sin-filtro": { label: "Sin filtro", tagline: "Para animarse" }
  };

  var TYPES = {
    verdad: { label: "Verdad", color: "#E0604F" },
    reto: { label: "Reto", color: "#C9A15A" },
    deseo: { label: "Deseo", color: "#C4728F" }
  };

  var AUDIENCES = {
    solo: { label: "Pareja" },
    grupo: { label: "Grupo" },
    ambos: { label: "Ambos" }
  };

  // [intensity, type, audience, text]
  var rows = [
    // ─────────────────────────────── PREVIA ───────────────────────────────
    // Verdad · solo
    ["previa", "verdad", "solo", "¿Qué fue lo primero que pensaste cuando nos vimos por primera vez?"],
    ["previa", "verdad", "solo", "¿Cuál es tu recuerdo favorito de los dos juntos?"],
    ["previa", "verdad", "solo", "¿Qué gesto mío te derrite sin que me dé cuenta?"],
    ["previa", "verdad", "solo", "¿En qué momento te diste cuenta de que te gustaba?"],
    ["previa", "verdad", "solo", "¿Qué canción te hace pensar en nosotros?"],
    ["previa", "verdad", "solo", "¿Cuál fue la primera mentira piadosa que me dijiste?"],
    ["previa", "verdad", "solo", "¿Qué manía mía te da ternura aunque no lo admitas?"],
    ["previa", "verdad", "solo", "¿Qué me contarías recién ahora, con todo lo que ya sabemos?"],

    // Verdad · grupo
    ["previa", "verdad", "grupo", "¿Qué es lo primero en lo que te fijás cuando te gusta alguien?"],
    ["previa", "verdad", "grupo", "¿Cuál fue tu mejor estrategia para chamuyar?"],
    ["previa", "verdad", "grupo", "¿Te declaraste alguna vez y salió mal? Contá."],
    ["previa", "verdad", "grupo", "¿Qué tipo de persona te acelera el pulso con solo mirarla?"],
    ["previa", "verdad", "grupo", "¿Cuál es el piropo más raro que te dijeron?"],
    ["previa", "verdad", "grupo", "¿Alguna vez te enamoraste de una amiga o un amigo?"],
    ["previa", "verdad", "grupo", "¿Qué look en otra persona te hace dar vuelta la cabeza?"],
    ["previa", "verdad", "grupo", "¿Cuál es tu mejor secreto para caer bien en una juntada?"],

    // Verdad · ambos
    ["previa", "verdad", "ambos", "¿Qué te parece más atractivo: la mirada, la voz o las manos?"],
    ["previa", "verdad", "ambos", "¿Qué es lo que más te gusta que te digan al oído?"],
    ["previa", "verdad", "ambos", "¿Cuándo fue la última vez que sentiste mariposas?"],
    ["previa", "verdad", "ambos", "¿Cómo sería tu primera cita ideal?"],
    ["previa", "verdad", "ambos", "¿Te gusta más provocar o que te provoquen?"],
    ["previa", "verdad", "ambos", "¿Qué prenda de ropa te parece la más sensual?"],
    ["previa", "verdad", "ambos", "¿Qué aroma te trae un recuerdo intenso?"],
    ["previa", "verdad", "ambos", "¿Qué es para vos la química perfecta?"],

    // Reto · solo
    ["previa", "reto", "solo", "Mirate a los ojos con la otra persona treinta segundos sin reírte."],
    ["previa", "reto", "solo", "Decile a la otra persona lo primero que te llamó la atención de ella."],
    ["previa", "reto", "solo", "Dale un abrazo que dure un poco más de lo normal."],
    ["previa", "reto", "solo", "Acariciale la cara y decile qué es lo que más te gusta de su sonrisa."],
    ["previa", "reto", "solo", "Hacé reír a la otra persona sin usar las manos."],
    ["previa", "reto", "solo", "Susurrale algo lindo al oído, lo primero que se te ocurra."],
    ["previa", "reto", "solo", "Tomale la mano y no la sueltes hasta la próxima carta."],
    ["previa", "reto", "solo", "Dale un beso en la frente y contale un buen recuerdo juntos."],

    // Reto · grupo
    ["previa", "reto", "grupo", "Elegí a alguien del grupo y decile qué es lo que más te gusta de su personalidad."],
    ["previa", "reto", "grupo", "Imitá a la persona que tenés a tu derecha sin que se ofenda."],
    ["previa", "reto", "grupo", "Contá en voz alta el piropo más ridículo que te gustaría recibir."],
    ["previa", "reto", "grupo", "Hacé reír a todo el grupo en menos de veinte segundos."],
    ["previa", "reto", "grupo", "Elegí a alguien y cumplile un deseo chiquito acá mismo."],
    ["previa", "reto", "grupo", "Mirá fijo a una persona del grupo hasta que baje la mirada."],
    ["previa", "reto", "grupo", "Decile a alguien del grupo un secreto que nunca le contaste."],
    ["previa", "reto", "grupo", "Inventá una coreografía y hacé bailar a todo el grupo."],

    // Reto · ambos
    ["previa", "reto", "ambos", "Contá cuál fue tu último sueño con alguien que te guste."],
    ["previa", "reto", "ambos", "Hacé un brindis improvisado por la noche y los presentes."],
    ["previa", "reto", "ambos", "Elegí a alguien y decile lo primero que pensaste cuando lo conociste."],
    ["previa", "reto", "ambos", "Decile un cumplido a cada persona presente, una por una."],
    ["previa", "reto", "ambos", "Contá una anécdota de chamuyo en la que hayas quedado en evidencia."],
    ["previa", "reto", "ambos", "Elegí a alguien y hacé que se sonroje con una sola frase."],
    ["previa", "reto", "ambos", "Mostrá con mímica cómo te ponés cuando alguien te gusta."],
    ["previa", "reto", "ambos", "Decí en voz alta tu mayor cualidad para seducir."],

    // Deseo · solo
    ["previa", "deseo", "solo", "¿Qué te gustaría que haga la otra persona para conquistarte de nuevo?"],
    ["previa", "deseo", "solo", "Pedile a la otra persona que te cuente un momento en el que se moría de ganas de besarte."],
    ["previa", "deseo", "solo", "¿Qué plan soñado harías con la otra persona esta noche?"],
    ["previa", "deseo", "solo", "Pedile que te describa cómo sería un beso perfecto con vos."],
    ["previa", "deseo", "solo", "¿Qué canción te gustaría bailar con la otra persona, bien pegados?"],
    ["previa", "deseo", "solo", "Pedile a la otra persona que te diga qué es lo que más le atrae de tu cuerpo."],
    ["previa", "deseo", "solo", "¿Qué cita pendiente te gustaría tener con la otra persona?"],
    ["previa", "deseo", "solo", "Pedile que te mire y te diga la primera palabra que le venga."],

    // Deseo · grupo
    ["previa", "deseo", "grupo", "Elegí a alguien del grupo y preguntale qué canción te dedicaría."],
    ["previa", "deseo", "grupo", "Pedile a alguien que te cuente un cumplido que nunca se animó a decirte."],
    ["previa", "deseo", "grupo", "Preguntale a una persona del grupo qué es lo primero que piensa cuando te ve."],
    ["previa", "deseo", "grupo", "Elegí a alguien y pedile que te cuente un sueño que haya tenido con otra persona."],
    ["previa", "deseo", "grupo", "Preguntale a una persona del grupo cuál fue su peor papelón romántico."],
    ["previa", "deseo", "grupo", "Pedile a alguien que te describa cómo se imagina una cita ideal."],
    ["previa", "deseo", "grupo", "Preguntale a una persona del grupo qué le acelera el pulso de otra persona."],
    ["previa", "deseo", "grupo", "Elegí a alguien y pedile que te cuente una fantasía tranqui."],

    // Deseo · ambos
    ["previa", "deseo", "ambos", "¿Qué pregunta íntima te gustaría que alguien te haga acá?"],
    ["previa", "deseo", "ambos", "Pedile a la persona que elijas que te cuente qué es lo que más le atrae de alguien."],
    ["previa", "deseo", "ambos", "¿Qué te gustaría que te susurren al oído en este momento?"],
    ["previa", "deseo", "ambos", "Preguntale a alguien qué es lo más lindo que le dijeron alguna vez."],
    ["previa", "deseo", "ambos", "¿Qué deseo simple te gustaría cumplir antes de que termine la noche?"],
    ["previa", "deseo", "ambos", "Pedile a la persona que elijas que te regale un piropo inventado."],
    ["previa", "deseo", "ambos", "¿Qué gesto te hace sentir deseado o deseada?"],
    ["previa", "deseo", "ambos", "Preguntale a alguien qué canción le gustaría bailar con vos."],

    // ─────────────────────────────── CALIENTE ───────────────────────────────
    // Verdad · solo
    ["caliente", "verdad", "solo", "¿Dónde te gustaría que te bese ahora mismo?"],
    ["caliente", "verdad", "solo", "¿Qué es lo que más te calienta de la otra persona?"],
    ["caliente", "verdad", "solo", "¿En qué lugar de la casa te gustaría sorprenderme?"],
    ["caliente", "verdad", "solo", "¿Cuál fue el momento en que más ganas tuviste de llevarme a la cama?"],
    ["caliente", "verdad", "solo", "¿Qué te imaginás que pasa después de esta partida?"],
    ["caliente", "verdad", "solo", "¿Qué parte de tu cuerpo querés que la otra persona explore más?"],
    ["caliente", "verdad", "solo", "¿Cuándo fue la última vez que pensaste en mí en la ducha?"],
    ["caliente", "verdad", "solo", "¿Qué me harías si no hubiera nadie alrededor?"],

    // Verdad · grupo
    ["caliente", "verdad", "grupo", "¿Cuál es la cosa más atrevida que hiciste con alguien en público?"],
    ["caliente", "verdad", "grupo", "¿Dónde te encantaría que te agarren por sorpresa?"],
    ["caliente", "verdad", "grupo", "¿Cuál es el secreto de la cama que nadie de acá conoce?"],
    ["caliente", "verdad", "grupo", "¿Qué es lo más caliente que te pasó en una juntada como esta?"],
    ["caliente", "verdad", "grupo", "¿Alguna vez te enamoraste de alguien estando en pareja?"],
    ["caliente", "verdad", "grupo", "¿Qué es lo que más te prende de una persona que recién conocés?"],
    ["caliente", "verdad", "grupo", "¿Cuál fue el mensaje más subido de tono que mandaste?"],
    ["caliente", "verdad", "grupo", "¿Qué fantasía te daría vergüenza contar acá?"],

    // Verdad · ambos
    ["caliente", "verdad", "ambos", "¿Qué te parece más caliente: el beso o el momento previo?"],
    ["caliente", "verdad", "ambos", "¿Qué palabra te prende si te la dicen al oído?"],
    ["caliente", "verdad", "ambos", "¿Qué es lo primero que te gustaría hacer si se apagan las luces?"],
    ["caliente", "verdad", "ambos", "¿Cuándo estuviste tan cerca de alguien que se te cortó la respiración?"],
    ["caliente", "verdad", "ambos", "¿Te gusta más provocar despacio o ir al grano?"],
    ["caliente", "verdad", "ambos", "¿Qué zona de tu cuerpo es la más sensible?"],
    ["caliente", "verdad", "ambos", "¿Qué te resulta irresistible en la persona que más te atrae?"],
    ["caliente", "verdad", "ambos", "¿Qué secreto te gustaría confesarle a la persona que más te atrae acá?"],

    // Reto · solo
    ["caliente", "reto", "solo", "Dale un beso en el cuello a la otra persona, despacio, hasta que se le erice la piel."],
    ["caliente", "reto", "solo", "Sentate sobre las piernas de la otra persona y quedate ahí una carta entera."],
    ["caliente", "reto", "solo", "Dale un beso de cinco segundos a la otra persona, contando en voz alta."],
    ["caliente", "reto", "solo", "Recorré con un dedo la espalda de la otra persona, de arriba hacia abajo."],
    ["caliente", "reto", "solo", "Mordé suavemente el labio inferior de la otra persona."],
    ["caliente", "reto", "solo", "Abrazá a la otra persona por detrás y susurrale lo que más te prende."],
    ["caliente", "reto", "solo", "Dale un beso en el hombro y después soplá suave en el mismo lugar."],
    ["caliente", "reto", "solo", "Sacale el buzo o el saco a la otra persona y doblalo vos."],

    // Reto · grupo
    ["caliente", "reto", "grupo", "Contale al grupo tu fantasía más inocente."],
    ["caliente", "reto", "grupo", "Dejá que alguien del grupo te elija una pregunta de cualquier carta."],
    ["caliente", "reto", "grupo", "Mostrale al grupo cómo es tu mirada cuando alguien te gusta."],
    ["caliente", "reto", "grupo", "Contá el beso más intenso que diste, sin dar nombres."],
    ["caliente", "reto", "grupo", "Elegí a alguien y dale un masaje de hombros de treinta segundos."],
    ["caliente", "reto", "grupo", "Contá qué es lo que te calienta al instante y nadie sabe."],
    ["caliente", "reto", "grupo", "Dejá que el grupo te haga una pregunta de Verdad, sin pasarla."],
    ["caliente", "reto", "grupo", "Elegí a alguien y decile al oído algo que lo haga sonreír."],

    // Reto · ambos
    ["caliente", "reto", "ambos", "Dale un beso en el cuello a la persona que elijas, con su permiso."],
    ["caliente", "reto", "ambos", "Sentate al lado de alguien y apoyá tu pierna contra la suya."],
    ["caliente", "reto", "ambos", "Susurrale a la persona de al lado lo que harías si estuvieran solos."],
    ["caliente", "reto", "ambos", "Hacé que la persona que elijas se ría solo con la mirada."],
    ["caliente", "reto", "ambos", "Dale la mano a alguien y acariciale la palma lentamente."],
    ["caliente", "reto", "ambos", "Elegí a alguien y decile cuál es su mayor tentación."],
    ["caliente", "reto", "ambos", "Contá tu fantasía más repetida, sin detalles gráficos."],
    ["caliente", "reto", "ambos", "Dejá que la persona de al lado te haga una caricia en el brazo."],

    // Deseo · solo
    ["caliente", "deseo", "solo", "Pedile a la otra persona que te bese donde más le gusta que la besen."],
    ["caliente", "deseo", "solo", "Decile qué te gustaría que te haga ahora, sin filtro."],
    ["caliente", "deseo", "solo", "Pedile que te mire y te diga qué es lo que más le prende de vos."],
    ["caliente", "deseo", "solo", "Preguntale cuál es la fantasía que todavía no se animó a pedirte."],
    ["caliente", "deseo", "solo", "Pedile que te agarre de la cintura y te acerque."],
    ["caliente", "deseo", "solo", "Decile qué prenda te gustaría que se saque."],
    ["caliente", "deseo", "solo", "Pedile que te describa, al oído, cómo sería la noche perfecta."],
    ["caliente", "deseo", "solo", "Preguntale en qué lugar de la casa se imagina el próximo beso largo."],

    // Deseo · grupo
    ["caliente", "deseo", "grupo", "Elegí a alguien y pedile que te cuente su fantasía más atrevida."],
    ["caliente", "deseo", "grupo", "Preguntale a una persona del grupo qué es lo que más le prende de otra persona presente."],
    ["caliente", "deseo", "grupo", "Pedile a alguien que te describa un beso que nunca olvidó."],
    ["caliente", "deseo", "grupo", "Elegí a alguien y preguntale qué haría si se quedan solos."],
    ["caliente", "deseo", "grupo", "Pedile a alguien que te cuente el momento más caliente de su vida."],
    ["caliente", "deseo", "grupo", "Preguntale a una persona qué parte del cuerpo le gustaría que le besen."],
    ["caliente", "deseo", "grupo", "Elegí a alguien y pedile que te cuente un sueño picante que haya tenido."],
    ["caliente", "deseo", "grupo", "Preguntale a una persona del grupo cuál fue su mejor chamuyo en una cita."],

    // Deseo · ambos
    ["caliente", "deseo", "ambos", "¿Qué te gustaría que te hagan en este momento, con tu permiso?"],
    ["caliente", "deseo", "ambos", "Pedile a la persona que elijas que te bese la mano."],
    ["caliente", "deseo", "ambos", "¿Qué pregunta caliente te gustaría que te hagan?"],
    ["caliente", "deseo", "ambos", "Pedile a alguien que te cuente qué es lo que más le atrae de vos."],
    ["caliente", "deseo", "ambos", "¿Qué caricia te gustaría recibir ahora mismo?"],
    ["caliente", "deseo", "ambos", "Pedile a la persona de al lado que te diga algo que le prende al oído."],
    ["caliente", "deseo", "ambos", "¿Qué te gustaría que pase antes de que termine la noche?"],
    ["caliente", "deseo", "ambos", "Pedile a alguien que te mire fijo diez segundos sin hablar."],

    // ─────────────────────────────── SIN FILTRO ───────────────────────────────
    // Verdad · solo
    ["sin-filtro", "verdad", "solo", "¿Cuál es tu fantasía más recurrente con la otra persona?"],
    ["sin-filtro", "verdad", "solo", "¿Qué te gustaría probar con la otra persona que todavía no se animaron?"],
    ["sin-filtro", "verdad", "solo", "¿Dónde te gustaría que te sorprenda la otra persona?"],
    ["sin-filtro", "verdad", "solo", "¿Qué te gustaría que te diga mientras están a solas?"],
    ["sin-filtro", "verdad", "solo", "¿Cuál fue el momento en que más te prendiste pensando en la otra persona?"],
    ["sin-filtro", "verdad", "solo", "¿Qué te gustaría hacerle que nunca te animaste a decir?"],
    ["sin-filtro", "verdad", "solo", "¿Qué parte de la otra persona te enloquece?"],
    ["sin-filtro", "verdad", "solo", "¿Cómo te imaginás la próxima vez que estén solos?"],

    // Verdad · grupo
    ["sin-filtro", "verdad", "grupo", "¿Cuál es tu mayor fantasía que jamás le contaste a nadie?"],
    ["sin-filtro", "verdad", "grupo", "¿Qué es lo más atrevido que hiciste en una cita?"],
    ["sin-filtro", "verdad", "grupo", "¿Estuviste alguna vez con alguien en un lugar prohibido? ¿Dónde?"],
    ["sin-filtro", "verdad", "grupo", "¿Qué es lo más caliente que te pasó y todavía te sonroja?"],
    ["sin-filtro", "verdad", "grupo", "¿Cuál es tu mayor tentación en este momento, en esta mesa?"],
    ["sin-filtro", "verdad", "grupo", "¿Qué fue lo más atrevido que te pidieron hacer?"],
    ["sin-filtro", "verdad", "grupo", "¿Mandaste alguna vez una foto subida de tono? ¿A quién?"],
    ["sin-filtro", "verdad", "grupo", "¿Cuál es el límite que creés que nunca cruzarías?"],

    // Verdad · ambos
    ["sin-filtro", "verdad", "ambos", "¿Qué es lo más atrevido que harías con la persona que más te atrae acá?"],
    ["sin-filtro", "verdad", "ambos", "¿Qué te gustaría que te digan al oído en este preciso momento?"],
    ["sin-filtro", "verdad", "ambos", "¿Cuál es tu mayor fantasía compartida con alguien presente?"],
    ["sin-filtro", "verdad", "ambos", "¿Qué te gustaría animarte a probar esta noche?"],
    ["sin-filtro", "verdad", "ambos", "¿Dónde te gustaría que te besen para perder el control?"],
    ["sin-filtro", "verdad", "ambos", "¿Qué te gustaría hacerle a alguien de acá si se diera la ocasión?"],
    ["sin-filtro", "verdad", "ambos", "¿Cuál fue el pensamiento más caliente que tuviste hoy?"],
    ["sin-filtro", "verdad", "ambos", "¿Qué secreto te gustaría confesarle a la persona de al lado?"],

    // Reto · solo
    ["sin-filtro", "reto", "solo", "Beso profundo de diez segundos, sin sacar las manos del otro."],
    ["sin-filtro", "reto", "solo", "Quitale una prenda a la otra persona, con su permiso, y quedátela."],
    ["sin-filtro", "reto", "solo", "Sentate en las piernas de la otra persona y decile al oído lo que más te calienta."],
    ["sin-filtro", "reto", "solo", "Recorré con besos el cuello de la otra persona, de un lado al otro."],
    ["sin-filtro", "reto", "solo", "Poné la mano de la otra persona donde más te gustaría que esté."],
    ["sin-filtro", "reto", "solo", "Beso en la clavícula y una mordida suave, con cuidado."],
    ["sin-filtro", "reto", "solo", "Decile a la otra persona cómo te gustaría que te despierte mañana."],
    ["sin-filtro", "reto", "solo", "Sacate una prenda con gesto lento, mirándola fijo."],

    // Reto · grupo
    ["sin-filtro", "reto", "grupo", "Contale al grupo la fantasía que te da pudor decir en voz alta."],
    ["sin-filtro", "reto", "grupo", "Elegí a alguien y dale un beso en el hombro, con su permiso."],
    ["sin-filtro", "reto", "grupo", "Contá la vez que estuviste más cerca de cruzar un límite."],
    ["sin-filtro", "reto", "grupo", "Dejá que el grupo te haga la pregunta que más temés contestar."],
    ["sin-filtro", "reto", "grupo", "Elegí a alguien y decile al oído lo que te gustaría hacerle."],
    ["sin-filtro", "reto", "grupo", "Contá tu mayor pecado de deseo, sin arrepentirte."],
    ["sin-filtro", "reto", "grupo", "Mostrá con las manos, sin hablar, cómo te gustaría que te toquen."],
    ["sin-filtro", "reto", "grupo", "Elegí a alguien y quedate mirándolo fijo sin reírte."],

    // Reto · ambos
    ["sin-filtro", "reto", "ambos", "Dale un beso debajo de la oreja a la persona que elijas, con su permiso."],
    ["sin-filtro", "reto", "ambos", "Sentate en las piernas de alguien por una carta entera."],
    ["sin-filtro", "reto", "ambos", "Susurrale a la persona de al lado tu fantasía más atrevida."],
    ["sin-filtro", "reto", "ambos", "Acariciá la espalda de la persona que elijas por diez segundos."],
    ["sin-filtro", "reto", "ambos", "Elegí a alguien y mordé suavemente su hombro, si se deja."],
    ["sin-filtro", "reto", "ambos", "Decile a la persona de al lado qué es lo que más te gustaría que te haga."],
    ["sin-filtro", "reto", "ambos", "Hacé un brindis por el deseo, mirando a quien más te atrae."],
    ["sin-filtro", "reto", "ambos", "Dejá que la persona que elijas te bese donde quiera, con tu permiso."],

    // Deseo · solo
    ["sin-filtro", "deseo", "solo", "Pedile a la otra persona que te cuente su fantasía más íntima."],
    ["sin-filtro", "deseo", "solo", "Decile exactamente qué te gustaría que te haga esta noche."],
    ["sin-filtro", "deseo", "solo", "Pedile que te describa, paso a paso, cómo te seduciría."],
    ["sin-filtro", "deseo", "solo", "Preguntale qué es lo más atrevido que haría con vos."],
    ["sin-filtro", "deseo", "solo", "Pedile que te diga qué te quiere hacer y que no se frene."],
    ["sin-filtro", "deseo", "solo", "Decile cuál es tu mayor deseo pendiente con la otra persona."],
    ["sin-filtro", "deseo", "solo", "Pedile que te cuente cómo sería la noche perfecta, sin omitir nada."],
    ["sin-filtro", "deseo", "solo", "Preguntale dónde te tocaría primero si estuvieran solos."],

    // Deseo · grupo
    ["sin-filtro", "deseo", "grupo", "Elegí a alguien y preguntale cuál es su fantasía más oscura."],
    ["sin-filtro", "deseo", "grupo", "Pedile a una persona que te cuente el deseo que todavía le da vergüenza contar."],
    ["sin-filtro", "deseo", "grupo", "Preguntale a alguien qué haría si esta noche se dan las condiciones."],
    ["sin-filtro", "deseo", "grupo", "Elegí a alguien y pedile que te confiese su mayor tentación presente."],
    ["sin-filtro", "deseo", "grupo", "Preguntale a una persona qué es lo más atrevido que haría en esta mesa."],
    ["sin-filtro", "deseo", "grupo", "Pedile a alguien que te describa su beso ideal, con lujo de detalles."],
    ["sin-filtro", "deseo", "grupo", "Elegí a alguien y preguntale cuál es su límite y si lo cruzaría."],
    ["sin-filtro", "deseo", "grupo", "Preguntale a una persona qué te haría si nadie se enterara."],

    // Deseo · ambos
    ["sin-filtro", "deseo", "ambos", "¿Qué deseo te gustaría cumplir antes de que amanezca?"],
    ["sin-filtro", "deseo", "ambos", "Pedile a la persona que elijas que te bese donde más ganas tenga."],
    ["sin-filtro", "deseo", "ambos", "¿Qué te gustaría que te susurren para perder la cabeza?"],
    ["sin-filtro", "deseo", "ambos", "Pedile a alguien que te cuente lo más atrevido que haría con vos."],
    ["sin-filtro", "deseo", "ambos", "¿Qué te gustaría probar esta noche que nunca probaste?"],
    ["sin-filtro", "deseo", "ambos", "Pedile a la persona de al lado que te diga su fantasía con alguien presente."],
    ["sin-filtro", "deseo", "ambos", "¿Qué te gustaría que te hagan sin que tengas que pedirlo?"],
    ["sin-filtro", "deseo", "ambos", "Pedile a alguien que te mire y te desee en voz alta."]
  ];

  var counters = {};
  var cards = rows.map(function (row) {
    var key = row[0] + ":" + row[1] + ":" + row[2];
    counters[key] = (counters[key] || 0) + 1;
    return {
      id: key.replace(/:/g, "-") + "-" + counters[key],
      intensity: row[0],
      type: row[1],
      audience: row[2],
      text: row[3]
    };
  });

  // La carta final cierra la partida, así que tiene que hablarle al modo que
  // se está jugando: en pareja no se puede "elegir a alguien del grupo".
  var finalCards = {
    previa: {
      intensity: "previa",
      solo: "Acérquense y dense el beso que da comienzo a todo.",
      grupo: "Que la persona a la que más desees se acerque y te dé el beso que daría comienzo a todo."
    },
    caliente: {
      intensity: "caliente",
      solo: "Beso largo, sin apuro, como si nadie más estuviera mirando.",
      grupo: "Elegí a alguien y compartan un beso largo, sin apuro, como si nadie más estuviera mirando."
    },
    "sin-filtro": {
      intensity: "sin-filtro",
      solo: "Sin apuro y sin testigos, cumplan la fantasía que más se repitieron esta noche.",
      grupo: "Sin apuro y sin testigos, cumplan la fantasía que más se repitieron esta noche."
    }
  };

  window.DESPUES_DATA = {
    intensities: INTENSITIES,
    types: TYPES,
    audiences: AUDIENCES,
    cards: cards,
    finalCards: finalCards
  };
})();
