"""Analizador de prueba del DSL v0.1 (no es el de la S3).

Lee `.historia.md`, `.vocabulario.md` y `.ambiente.md`, produce el AST normalizado de
docs/dsl/ast.schema.json e informa diagnósticos. Sirve para comprobar que la especificación
permite escribir las historias.

Uso:
  python prototipo_analizador.py --ambiente A.md --vocabulario V.md [--vocabulario W.md] HISTORIAS...
                                 [--ast-salida CARPETA] [--json]
"""

import argparse
import json
import pathlib
import re
import sys

VERSION_AST = "0.1.0"
FASES = {"DADO": "dado", "CUANDO": "cuando", "ENTONCES": "entonces", "Y": "y"}
LOCALIZADOR_POR_PALABRA = {
    "texto": "texto", "mensaje": "texto", "botón": "boton", "campo": "campo", "enlace": "enlace",
    "título": "titulo", "casilla": "casilla", "opción": "opcion",
}
# Objetivos que acepta cada acción (especificación, §7). None: cualquier localizador.
OBJETIVOS = {
    "completar": {"campo", "rol"}, "seleccionar": {"campo", "rol"},
    "marcar": {"casilla", "opcion", "rol"}, "desmarcar": {"casilla", "opcion", "rol"},
    "presionar": None, "esperar": None, "ver": None, "noVer": None,
}
VARIABLE = re.compile(r"\$\{([^}]+)\}")
# Una cadena admite \" y \\ (especificación, §6.4).
CADENA = r'"((?:[^"\\]|\\.)*)"'
ELEMENTO = (r'((?:exactamente )?(?:el elemento con rol "(?:[^"\\]|\\.)*" y nombre "(?:[^"\\]|\\.)*"'
            r'|el elemento con id de prueba "(?:[^"\\]|\\.)*"|el elemento con selector `[^`]+`'
            r'|(?:el|la) [a-zóíéá]+ "(?:[^"\\]|\\.)*"))')


class Diagnosticos:
    def __init__(self, archivo):
        self.archivo, self.lista = archivo, []

    def agregar(self, codigo, linea, columna, mensaje):
        self.lista.append({"codigo": codigo, "archivo": self.archivo, "linea": linea, "columna": columna, "mensaje": mensaje})


def desescapar(obj):
    """Quita los escapes \\" y \\\\ de todos los textos de un paso."""
    if isinstance(obj, str):
        return re.sub(r'\\(["\\])', r"\1", obj)
    if isinstance(obj, dict):
        return {k: desescapar(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [desescapar(v) for v in obj]
    return obj


# ── Frases base (especificación §6) ───────────────────────────────────────────

def separar_ambitos(resto):
    """Consume sufijos de ámbito al final del texto. Devuelve (texto sin sufijos, ámbito anidado)."""
    ambitos = []
    patrones = [
        (re.compile(r'\s+en la fila de ' + CADENA + r'$'), lambda m: {"por": "fila", "texto": m.group(1)}),
        (re.compile(r'\s+en el aviso de confirmación$'), lambda m: {"por": "dialogo", "texto": None}),
        (re.compile(r'\s+en el aviso ' + CADENA + r'$'), lambda m: {"por": "dialogo", "texto": m.group(1)}),
        (re.compile(r'\s+en ' + CADENA + r'$'), lambda m: {"por": "seccion", "texto": m.group(1)}),
    ]
    cambio = True
    while cambio:
        cambio = False
        for patron, crear in patrones:
            m = patron.search(resto)
            if m:
                ambitos.insert(0, crear(m))
                resto = resto[: m.start()]
                cambio = True
                break
    # El primer sufijo es el ámbito inmediato; los siguientes lo contienen.
    ambito = None
    for a in reversed(ambitos):
        a["ambito"] = ambito
        ambito = a
    return resto, ambito


def objetivo_de(elemento):
    """Convierte «exactamente el campo "x"» en un localizador. Devuelve None si la palabra no existe."""
    exacto = elemento.startswith("exactamente ")
    elemento = elemento.removeprefix("exactamente ")
    m = re.fullmatch(r'el elemento con rol ' + CADENA + r' y nombre ' + CADENA, elemento)
    if m:
        objetivo = {"por": "rol", "rol": m.group(1), "texto": m.group(2)}
    elif m := re.fullmatch(r'el elemento con id de prueba ' + CADENA, elemento):
        return {"por": "idDePrueba", "id": m.group(1)}
    elif m := re.fullmatch(r'el elemento con selector `([^`]+)`', elemento):
        return {"por": "css", "selector": m.group(1)}
    elif m := re.fullmatch(r'(?:el|la) ([a-zóíéá]+) ' + CADENA, elemento):
        if m.group(1) not in LOCALIZADOR_POR_PALABRA:
            return None
        objetivo = {"por": LOCALIZADOR_POR_PALABRA[m.group(1)], "texto": m.group(2)}
    else:
        return None
    if exacto:
        objetivo["exacto"] = True
    return objetivo


def valor_de(texto_valor):
    m = re.fullmatch(r"la fecha de hoy(?: en formato " + CADENA + r")?", texto_valor)
    if m:
        return {"tipo": "fecha", "fecha": "hoy", "formato": m.group(1)}
    if texto_valor == "un número único":
        return {"tipo": "unico", "unico": "numero"}
    m = re.fullmatch(r"el código generado con el secreto " + CADENA, texto_valor)
    if m:
        return {"tipo": "totp", "secreto": m.group(1)}
    m = re.fullmatch(CADENA, texto_valor)
    if m:
        return {"tipo": "texto", "texto": m.group(1)}
    return None


def frase_base(texto):
    """Devuelve (accion, objetivo, ambito, valor) o None si no es una frase base."""
    texto, ambito = separar_ambitos(texto)
    m = re.fullmatch(r"navego a `([^`]+)`", texto)
    if m:
        return "navegar", {"por": "url", "url": m.group(1)}, ambito, None
    m = re.fullmatch(r"navego a " + CADENA, texto)
    if m:
        return "navegar", {"por": "menu", "ruta": [p.strip() for p in m.group(1).split(">")]}, ambito, None
    m = re.fullmatch(r"(no )?veo que la dirección contiene " + CADENA, texto)
    if m:
        return ("noVer" if m.group(1) else "ver"), {"por": "url", "url": m.group(2)}, ambito, None
    m = re.fullmatch(r"capturo el valor del campo " + CADENA + r" como " + CADENA, texto)
    if m:
        return "capturar", {"por": "campo", "texto": m.group(1)}, ambito, {"tipo": "captura", "como": m.group(2)}
    formas = [
        (r"completo " + ELEMENTO + r" con (.+)", lambda m: ("completar", m.group(1), valor_de(m.group(2)))),
        (r"completo " + ELEMENTO, lambda m: ("completar", m.group(1), None)),  # CUS-E008
        (r"selecciono " + CADENA + r" en " + ELEMENTO, lambda m: ("seleccionar", m.group(2), {"tipo": "texto", "texto": m.group(1)})),
        (r"(marco|desmarco) " + ELEMENTO, lambda m: ("marcar" if m.group(1) == "marco" else "desmarcar", m.group(2), None)),
        (r"presiono " + ELEMENTO, lambda m: ("presionar", m.group(1), None)),
        (r"espero " + ELEMENTO, lambda m: ("esperar", m.group(1), None)),
        (r"(no )?veo " + ELEMENTO, lambda m: ("noVer" if m.group(1) else "ver", m.group(2), None)),
    ]
    for patron, armar in formas:
        m = re.fullmatch(patron, texto)
        if not m:
            continue
        accion, elemento, valor = armar(m)
        objetivo = objetivo_de(elemento)
        if objetivo is None:
            return None
        permitidos = OBJETIVOS[accion]
        if permitidos is not None and objetivo["por"] not in permitidos:
            return "_objetivo_invalido", objetivo["por"], ambito, None  # CUS-E007
        return accion, objetivo, ambito, valor
    return None


VERBOS_BASE = ["navego", "completo", "selecciono", "marco", "desmarco", "presiono", "espero", "veo", "capturo"]


def palabras(texto):
    return re.sub(r'"(?:[^"\\]|\\.)*"|`[^`]*`', " ", texto).split()


def sugerencia(texto, frases):
    import difflib
    primera = texto.split()[0] if texto.split() else ""
    verbo = difflib.get_close_matches(primera, VERBOS_BASE, n=1, cutoff=0.7)
    if verbo:
        return f" ¿Quisiste decir «{verbo[0]} {' '.join(texto.split()[1:])}»?"
    patrones = [f["patron"] for f in frases]
    parecida = difflib.get_close_matches(texto, patrones, n=1, cutoff=0.6)
    return f" ¿Quisiste decir «{parecida[0]}»?" if parecida else ""


# ── Archivos con frontmatter ──────────────────────────────────────────────────

def leer_frontmatter(lineas, diag):
    if not lineas or lineas[0].strip() != "---":
        diag.agregar("CUS-E001", 1, 1, "Falta el frontmatter.")
        return {}, 0
    datos = {}
    for i in range(1, len(lineas)):
        if lineas[i].strip() == "---":
            return datos, i + 1
        m = re.match(r"^(\w+):\s*(.*)$", lineas[i])
        if not m:
            diag.agregar("CUS-E001", i + 1, 1, "Línea de frontmatter inválida.")
            continue
        clave, valor = m.groups()
        lista = re.fullmatch(r"\[(.*)\]", valor.strip())
        datos[clave] = [v.strip() for v in lista.group(1).split(",") if v.strip()] if lista else valor.strip()
    diag.agregar("CUS-E001", 1, 1, "El frontmatter no se cierra con ---.")
    return datos, len(lineas)


def leer_ambiente(ruta):
    """El archivo de ambiente (especificación §9.5): solo nombres de variables y secretos."""
    diag = Diagnosticos(str(ruta))
    lineas = ruta.read_text(encoding="utf-8").splitlines()
    meta, inicio = leer_frontmatter(lineas, diag)
    listas, actual = {"Variables": [], "Secretos": []}, None
    for linea in lineas[inicio:]:
        if linea.startswith("## "):
            actual = linea[3:].strip()
        elif actual in listas and linea.startswith("- "):
            listas[actual].append(linea[2:].strip())
    return {"ambiente": meta.get("ambiente"), "desechable": meta.get("desechable") == "sí",
            "variables": listas["Variables"], "secretos": listas["Secretos"]}


def declarado(nombre, lista):
    """`USUARIO_*` calza con cualquier final de letras, dígitos y `_`."""
    return any(re.fullmatch(re.escape(d[:-1]) + r"\w*", nombre) if d.endswith("*") else nombre == d for d in lista)


# ── Vocabulario ───────────────────────────────────────────────────────────────

def regex_de_patron(patron):
    partes = re.split(r'"\{(\w+)\}"', patron)
    regex, parametros = "", []
    for i, parte in enumerate(partes):
        if i % 2 == 0:
            regex += re.escape(parte)
        else:
            parametros.append(parte)
            regex += CADENA
    return re.compile("^" + regex + "$"), parametros


def leer_vocabulario(ruta):
    diag = Diagnosticos(str(ruta))
    lineas = ruta.read_text(encoding="utf-8").splitlines()
    meta, inicio = leer_frontmatter(lineas, diag)
    frases, actual = [], None
    for n in range(inicio, len(lineas)):
        linea = lineas[n]
        if linea.startswith("## "):
            actual = None
            m = re.match(r"^## Frase: (.+)$", linea)
            if m:
                regex, parametros = regex_de_patron(m.group(1).strip())
                actual = {"patron": m.group(1).strip(), "parametros": parametros, "produce": [],
                          "implementacion": "pasos", "motivo": None, "pasos": [], "_regex": regex,
                          "_vocabulario": meta.get("vocabulario"), "_lineas": [],
                          "origen": {"linea": n + 1, "columna": 1}}
                frases.append(actual)
            continue
        if actual is None:
            continue
        m = re.match(r"^> (produce|implementación): (.+)$", linea)
        if m:
            if m.group(1) == "produce":
                actual["produce"] = [p.strip() for p in m.group(2).split(",")]
            else:
                tipo, _, motivo = m.group(2).partition(" — ")
                actual["implementacion"], actual["motivo"] = tipo.strip(), motivo.strip() or None
            continue
        if linea.startswith("- "):
            actual["_lineas"].append((n + 1, linea[2:].strip()))
    for f in frases:
        if f["implementacion"] == "pasos" and not f["_lineas"]:
            diag.agregar("CUS-E002", f["origen"]["linea"], 1, f"La frase «{f['patron']}» no tiene pasos ni implementación declarada.")
    return {"vocabulario": meta.get("vocabulario"), "dsl": meta.get("dsl"), "producto": meta.get("producto"), "frases": frases}, diag


# ── Pasos ─────────────────────────────────────────────────────────────────────

def analizar_paso(texto, linea, columna, fase, frases, diag):
    base = frase_base(texto)
    if base and base[0] == "_objetivo_invalido":
        diag.agregar("CUS-E007", linea, columna, f"«{texto}»: la acción no acepta un {base[1]} como objetivo.")
        return None
    if base:
        accion, objetivo, ambito, valor = base
        if accion == "completar" and valor is None:
            diag.agregar("CUS-E008", linea, columna, f"«{texto}»: el valor no es válido.")
        return desescapar({"fase": fase, "accion": accion, "objetivo": objetivo, "ambito": ambito, "valor": valor,
                           "origen": {"linea": linea, "columna": columna}})
    calzan = [(f, m) for f in frases if (m := f["_regex"].match(texto))]
    if len({f["_vocabulario"] for f, _ in calzan}) > 1:
        nombres = ", ".join(sorted({f["_vocabulario"] for f, _ in calzan}))
        diag.agregar("CUS-E017", linea, columna, f"«{texto}» calza con frases de varios vocabularios: {nombres}.")
        return None
    if calzan:
        f, m = calzan[0]
        argumentos = desescapar(dict(zip(f["parametros"], m.groups())))
        # CUS-E014: un parámetro que arma un nombre de variable (${USUARIO_{rol}}) solo admite [A-Za-z0-9_].
        texto_pasos = " ".join(t for _, t in f["_lineas"])
        for parametro in set(re.findall(r"\$\{[^}]*?\{(\w+)\}", texto_pasos)):
            if parametro in argumentos and not re.fullmatch(r"[A-Za-z0-9_]+", argumentos[parametro]):
                diag.agregar("CUS-E014", linea, columna,
                             f"«{argumentos[parametro]}» no sirve para armar un nombre de variable con `{{{parametro}}}`.")
        return {"fase": fase, "accion": "frase",
                "objetivo": {"por": "frase", "vocabulario": f["_vocabulario"], "nombre": f["patron"], "argumentos": argumentos},
                "ambito": None, "valor": None, "origen": {"linea": linea, "columna": columna}, "_frase": f}
    # CUS-E010: empieza como una frase del vocabulario, pero le faltan o le sobran parámetros.
    p_texto = palabras(texto)
    for f in frases:
        p_patron = palabras(f["patron"])
        if len(p_texto) >= 3 and (p_patron[: len(p_texto)] == p_texto or p_texto[: len(p_patron)] == p_patron):
            diag.agregar("CUS-E010", linea, columna, f"«{texto}» no tiene los parámetros de «{f['patron']}».")
            return None
    diag.agregar("CUS-E006", linea, columna, f"Frase desconocida: «{texto}».{sugerencia(texto, frases)}")
    return None


def textos_de(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from textos_de(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from textos_de(v)


def sustituir(obj, argumentos):
    """Reemplaza los parámetros {x} de los pasos de una frase por sus argumentos (especificación §10.1)."""
    if isinstance(obj, str):
        return re.sub(r"\{(\w+)\}", lambda m: argumentos.get(m.group(1), m.group(0)), obj)
    if isinstance(obj, dict):
        return {k: sustituir(v, argumentos) for k, v in obj.items() if k != "_frase"} | (
            {"_frase": obj["_frase"]} if "_frase" in obj else {})
    if isinstance(obj, list):
        return [sustituir(v, argumentos) for v in obj]
    return obj


def revisar_variables(paso, capturas, ambiente, diag, origen=None, profundidad=0):
    """CUS-E011 (variable no declarada o captura antes de hacerse) y CUS-E013 (secreto en lugar no permitido).

    Se revisa después de sustituir los parámetros: los pasos de cada frase usada se revisan con sus argumentos.
    """
    origen = origen or paso["origen"]
    permitidos = []
    if paso["accion"] == "completar" and paso["valor"]:
        permitidos.append(paso["valor"])
    if paso["accion"] == "frase":
        permitidos.append(paso["objetivo"]["argumentos"])
    textos_permitidos = set(textos_de(permitidos))
    sin_frase = {k: v for k, v in paso.items() if not k.startswith("_") and k != "origen"}
    for t in textos_de(sin_frase):
        for nombre in VARIABLE.findall(t):
            # Un nombre con parámetros sin sustituir, o inválido después de sustituirlos, es de CUS-E014.
            if not re.fullmatch(r"\w+", nombre):
                continue
            if nombre[:1].islower():
                if profundidad == 0 and nombre not in capturas:
                    diag.agregar("CUS-E011", origen["linea"], origen["columna"], f"`${{{nombre}}}` se usa antes de capturarse.")
                continue
            if nombre == "PREFIJO":
                continue
            if not declarado(nombre, ambiente["variables"] + ambiente["secretos"]):
                diag.agregar("CUS-E011", origen["linea"], origen["columna"], f"`${{{nombre}}}` no está declarada en el ambiente «{ambiente['ambiente']}».")
            elif declarado(nombre, ambiente["secretos"]) and t not in textos_permitidos:
                diag.agregar("CUS-E013", origen["linea"], origen["columna"], f"El secreto `${{{nombre}}}` no puede usarse aquí.")
    if paso["accion"] == "frase" and profundidad < 10:
        for sub in paso["_frase"]["pasos"]:
            revisar_variables(sustituir(sub, paso["objetivo"]["argumentos"]), capturas, ambiente, diag, origen, profundidad + 1)


def sin_pasos(frase, visitadas=None):
    """La frase, o alguna que usa, no tiene pasos (especificación §10.3)."""
    visitadas = visitadas or set()
    if frase["patron"] in visitadas:
        return False
    visitadas.add(frase["patron"])
    if frase["implementacion"] != "pasos":
        return True
    return any(p.get("_frase") and sin_pasos(p["_frase"], visitadas) for p in frase["pasos"])


def resolver_vocabulario(vocab, diag):
    for f in vocab["frases"]:
        for linea, texto in f["_lineas"]:
            paso = analizar_paso(texto, linea, 3, None, vocab["frases"], diag)
            if paso:
                f["pasos"].append(paso)
        capturadas = {p["valor"]["como"] for p in f["pasos"] if p["accion"] == "capturar"}
        if f["implementacion"] == "pasos" and capturadas != set(f["produce"]):
            diag.agregar("CUS-E011", f["origen"]["linea"], 1, f"«{f['patron']}»: produce {sorted(f['produce'])} y captura {sorted(capturadas)}.")
    # CUS-E012: referencias circulares entre frases.
    usa = {f["patron"]: [p["_frase"]["patron"] for p in f["pasos"] if p.get("_frase")] for f in vocab["frases"]}
    for inicio in usa:
        pila, vistas = list(usa[inicio]), set()
        while pila:
            actual = pila.pop()
            if actual == inicio:
                f = next(x for x in vocab["frases"] if x["patron"] == inicio)
                diag.agregar("CUS-E012", f["origen"]["linea"], 1, f"«{inicio}» termina usándose a sí misma.")
                break
            if actual not in vistas:
                vistas.add(actual)
                pila.extend(usa.get(actual, []))


# ── Historias ─────────────────────────────────────────────────────────────────

def analizar_historia(ruta, vocabularios, ambiente):
    """`vocabularios`: los vocabularios disponibles, por nombre. La historia usa los que importa."""
    diag = Diagnosticos(str(ruta))
    lineas = ruta.read_text(encoding="utf-8").splitlines()
    meta, inicio = leer_frontmatter(lineas, diag)
    for campo in ("dsl", "id", "producto", "titulo", "actor", "criticidad"):
        if meta and campo not in meta:
            diag.agregar("CUS-E002", 1, 1, f"Falta `{campo}` en el frontmatter.")
    if meta.get("dsl") and not re.fullmatch(r"\d+\.\d+\.\d+", meta["dsl"]):
        diag.agregar("CUS-E015", 2, 1, f"Versión inválida: `{meta['dsl']}`.")
    if meta.get("id") and not re.fullmatch(r"HU-[A-Z]+-\d{3}", meta["id"]):
        diag.agregar("CUS-E003", 3, 1, f"Id inválido: `{meta['id']}`.")
    faltan = [v for v in meta.get("vocabularios", []) if v not in vocabularios]
    if faltan:
        diag.agregar("CUS-E009", 1, 1, f"Vocabulario no encontrado: {faltan}.")
    frases = [f for v in meta.get("vocabularios", []) if v in vocabularios for f in vocabularios[v]["frases"]]

    historia = {k: meta.get(k) for k in ("dsl", "id", "producto", "titulo", "actor", "criticidad")}
    historia["etiquetas"] = meta.get("etiquetas", [])
    historia["vocabularios"] = meta.get("vocabularios", [])
    historia.update({"narrativa": None, "antecedentes": [], "escenarios": [], "limpieza": [], "origen": {"linea": 1, "columna": 1}})

    seccion, escenario = None, None
    narrativa = {}
    for n in range(inicio, len(lineas)):
        linea, num = lineas[n], n + 1
        if linea.startswith("## "):
            titulo = linea[3:].strip()
            escenario = None
            if titulo == "Historia":
                seccion = "historia"
            elif titulo == "Antecedentes":
                seccion = "antecedentes"
            elif titulo == "Limpieza":
                seccion = "limpieza"
            elif titulo.startswith("Escenario:"):
                seccion = "escenario"
                escenario = {"nombre": titulo.split(":", 1)[1].strip(), "pasos": [], "origen": {"linea": num, "columna": 1}}
                if any(e["nombre"] == escenario["nombre"] for e in historia["escenarios"]):
                    diag.agregar("CUS-E016", num, 1, f"Escenario repetido: «{escenario['nombre']}».")
                historia["escenarios"].append(escenario)
            else:
                seccion = "libre"
            continue
        if seccion == "historia":
            # Las líneas en blanco entre **Como**, **Quiero** y **Para** se aceptan (§4).
            m = re.match(r"^\*\*(Como|Quiero|Para)\*\*\s+(.+)$", linea)
            if m:
                narrativa[m.group(1).lower()] = m.group(2).strip()
                narrativa.setdefault("origen", {"linea": num, "columna": 1})
            continue
        if not linea.startswith("- ") or seccion not in ("antecedentes", "limpieza", "escenario"):
            continue
        texto, columna = linea[2:].strip(), 3
        fase = None
        if seccion == "escenario":
            m = re.match(r"^(DADO|CUANDO|ENTONCES|Y)\s+(?:que\s+)?(.+)$", texto)
            if not m:
                diag.agregar("CUS-E005", num, columna, "El paso de un escenario tiene que empezar con DADO, CUANDO, ENTONCES o Y.")
                continue
            fase, texto = FASES[m.group(1)], m.group(2)
            # Se mira la primera línea del escenario, se haya entendido o no, para no encadenar errores.
            primera_linea = escenario.setdefault("_lineas_de_pasos", 0) == 0
            escenario["_lineas_de_pasos"] += 1
            if primera_linea and fase in ("y", "entonces"):
                diag.agregar("CUS-E005", num, columna, f"Un escenario no puede empezar con {m.group(1)}.")
        paso = analizar_paso(texto, num, columna, fase, frases, diag)
        if not paso:
            continue
        if seccion == "escenario":
            escenario["pasos"].append(paso)
        else:
            historia[seccion].append(paso)

    for escenario in historia["escenarios"]:
        if not escenario.get("_lineas_de_pasos"):
            diag.agregar("CUS-E005", escenario["origen"]["linea"], 1, f"El escenario «{escenario['nombre']}» no tiene pasos.")
    if {"como", "quiero", "para"} - narrativa.keys():
        diag.agregar("CUS-E004", 1, 1, "Falta la narrativa Como / Quiero / Para completa.")
    historia["narrativa"] = narrativa or None

    # Capturas, variables, secretos, anclas y verificaciones, por escenario (con antecedentes y limpieza).
    incompleta = False
    for escenario in historia["escenarios"]:
        capturas = set()
        cambio_sin_ancla = False
        verifica = False
        for paso in historia["antecedentes"] + escenario["pasos"]:
            revisar_variables(paso, capturas, ambiente, diag)
            if paso["accion"] == "capturar":
                capturas.add(paso["valor"]["como"])
            if paso["accion"] == "frase":
                f = paso["_frase"]
                for p in f["produce"]:
                    capturas.add(re.sub(r"\{(\w+)\}", lambda mm: paso["objetivo"]["argumentos"].get(mm.group(1), ""), p))
                if sin_pasos(f):
                    incompleta = True
            if paso["accion"] in ("navegar", "presionar", "frase"):
                cambio_sin_ancla = True
            if paso["accion"] in ("ver", "esperar"):
                cambio_sin_ancla = False
            if paso["accion"] in ("ver", "noVer") or (paso["accion"] == "frase" and paso["fase"] in ("entonces", "y")):
                verifica = True
            if paso["accion"] == "noVer" and cambio_sin_ancla:
                diag.agregar("CUS-W003", paso["origen"]["linea"], paso["origen"]["columna"], "`no veo` sin un `veo` o `espero` previo.")
        for paso in historia["limpieza"]:
            revisar_variables(paso, capturas, ambiente, diag)
        if not verifica:
            diag.agregar("CUS-W002", escenario["origen"]["linea"], 1, f"«{escenario['nombre']}» no verifica nada.")
    if incompleta:
        diag.agregar("CUS-W004", 1, 1, "Usa frases sin pasos: no se puede ejecutar todavía.")
    if any(p["accion"] == "frase" and sin_pasos(p["_frase"]) for p in historia["limpieza"]):
        donde = "se ejecuta y la limpieza queda `limpieza_pendiente`" if ambiente["desechable"] else "no se ejecuta"
        diag.agregar("CUS-W005", 1, 1, f"La limpieza usa frases sin pasos: en «{ambiente['ambiente']}» {donde}.")
    return historia, diag


def limpiar(obj):
    if isinstance(obj, dict):
        return {k: limpiar(v) for k, v in obj.items() if not k.startswith("_")}
    if isinstance(obj, list):
        return [limpiar(v) for v in obj]
    return obj


def cargar_vocabularios(rutas):
    """Lee y resuelve cada vocabulario. Devuelve ({nombre: vocabulario}, diagnósticos)."""
    vocabularios, diags = {}, []
    for ruta in rutas:
        vocab, diag = leer_vocabulario(pathlib.Path(ruta))
        resolver_vocabulario(vocab, diag)
        vocab["_ruta"] = pathlib.Path(ruta)
        vocabularios[vocab["vocabulario"]] = vocab
        diags.extend(diag.lista)
    return vocabularios, diags


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ambiente", required=True)
    ap.add_argument("--vocabulario", required=True, action="append")
    ap.add_argument("--ast-salida")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("historias", nargs="+")
    args = ap.parse_args()

    ambiente = leer_ambiente(pathlib.Path(args.ambiente))
    vocabularios, todos = cargar_vocabularios(args.vocabulario)
    if args.ast_salida:
        for vocab in vocabularios.values():
            nombre = vocab["_ruta"].name.replace(".vocabulario.md", ".vocabulario.ast.json")
            ast_vocab = {"ast": VERSION_AST, "archivo": vocab["_ruta"].as_posix(), **limpiar(vocab)}
            (pathlib.Path(args.ast_salida) / nombre).write_text(json.dumps(ast_vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    resumen = []
    for ruta in sorted(pathlib.Path(h) for h in args.historias):
        historia, diag = analizar_historia(ruta, vocabularios, ambiente)
        todos.extend(diag.lista)
        pasos = sum(len(e["pasos"]) for e in historia["escenarios"]) + len(historia["antecedentes"]) + len(historia["limpieza"])
        resumen.append((ruta.name, len(historia["escenarios"]), pasos, [d["codigo"] for d in diag.lista]))
        if args.ast_salida:
            salida = pathlib.Path(args.ast_salida) / ruta.name.replace(".historia.md", ".ast.json")
            ast = {"ast": VERSION_AST, "archivo": ruta.as_posix(), "historias": [limpiar(historia)]}
            salida.write_text(json.dumps(ast, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.json:
        print(json.dumps(todos, ensure_ascii=False, indent=2))
        return
    for vocab in vocabularios.values():
        impl = {}
        for f in vocab["frases"]:
            impl[f["implementacion"]] = impl.get(f["implementacion"], 0) + 1
        print(f"vocabulario {vocab['vocabulario']} {vocab['dsl']}: {len(vocab['frases'])} frases {impl}")
    print(f"ambiente {ambiente['ambiente']}: {len(ambiente['variables'])} variables, {len(ambiente['secretos'])} secretos, desechable: {ambiente['desechable']}")
    for nombre, esc, pasos, codigos in resumen:
        print(f"  {nombre}: {esc} escenarios, {pasos} pasos, diagnósticos: {codigos or 'ninguno'}")
    errores = [d for d in todos if d["codigo"].startswith("CUS-E")]
    for d in todos:
        print(f"  {d['codigo']} {d['archivo']}:{d['linea']}:{d['columna']} {d['mensaje']}")
    print(f"\n{len(errores)} errores, {len(todos) - len(errores)} advertencias")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
