"""Corre el analizador de prueba sobre los casos inválidos y las historias válidas.

Uso: python verificar_casos.py RAIZ_DEL_REPOSITORIO
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import prototipo_analizador as pa  # noqa: E402

RAIZ = pathlib.Path(sys.argv[1])
CASOS = RAIZ / "test/lenguaje/casos/invalidos"
VOCAB_SUITE = RAIZ / "vocabularios/acutis-suite.vocabulario.md"
esperados = json.loads((CASOS / "esperados.json").read_text(encoding="utf-8"))
AMBIENTE = pa.leer_ambiente(RAIZ / esperados["ambiente"])


def analizar(historia, extra=None):
    """Analiza con el vocabulario de la Suite y, si el caso lo pide, uno más de la carpeta de casos."""
    vocabularios, diags = pa.cargar_vocabularios([VOCAB_SUITE] + ([CASOS / extra] if extra else []))
    _, diag = pa.analizar_historia(historia, vocabularios, AMBIENTE)
    return diags + diag.lista


fallos = 0
print(f"Casos inválidos ({len(esperados['casos'])}):")
for caso in esperados["casos"]:
    diags = analizar(CASOS / caso["archivo"], caso.get("vocabulario"))
    errores = sorted({d["codigo"] for d in diags if d["codigo"].startswith("CUS-E")})
    ok = errores == [caso["codigo"]]
    fallos += not ok
    mensaje = next((d["mensaje"] for d in diags if d["codigo"] == caso["codigo"]), "")
    print(f"  {'OK ' if ok else 'MAL'} {caso['archivo']:<52} esperado {caso['codigo']}, obtuvo {errores}  {mensaje}")

print("\nHistorias válidas:")
for historia in sorted((RAIZ / "historias").glob("*.historia.md")):
    diags = analizar(historia)
    errores = [d for d in diags if d["codigo"].startswith("CUS-E")]
    advertencias = sorted({d["codigo"] for d in diags if d["codigo"].startswith("CUS-W")})
    fallos += bool(errores)
    print(f"  {'OK ' if not errores else 'MAL'} {historia.name} {[d['codigo'] + ' ' + d['mensaje'] for d in errores] or ''} {advertencias or ''}")

print(f"\n{fallos} fallos")
sys.exit(1 if fallos else 0)
