"""Gera imagens via OpenRouter (modelos Google Gemini / Nano Banana).

Uso:
  python tools/gerar_imagem.py saida.webp "prompt..." [--modelo google/gemini-3-pro-image] [--proporcao 16:9]

A chave vem da variável `openrouter` no arquivo .env (nunca é impressa).
"""
import argparse, base64, io, json, pathlib, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent


def chave():
    for linha in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if linha.strip().startswith("openrouter="):
            return linha.split("=", 1)[1].strip().strip('"')
    sys.exit("variável 'openrouter' não encontrada no .env")


def gerar(prompt, modelo, proporcao):
    corpo = {
        "model": modelo,
        "modalities": ["image", "text"],
        "messages": [{"role": "user", "content": prompt}],
        "image_config": {"aspect_ratio": proporcao},
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(corpo).encode(),
        headers={"Authorization": f"Bearer {chave()}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        resp = json.load(r)
    msg = resp["choices"][0]["message"]
    imgs = msg.get("images") or []
    if not imgs:
        sys.exit(f"sem imagem na resposta: {str(msg.get('content'))[:300]}")
    url = imgs[0]["image_url"]["url"]
    return base64.b64decode(url.split(",", 1)[1])


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("saida")
    p.add_argument("prompt")
    p.add_argument("--modelo", default="google/gemini-3-pro-image")
    p.add_argument("--proporcao", default="16:9")
    p.add_argument("--largura", type=int, default=1920)
    a = p.parse_args()

    dados = gerar(a.prompt, a.modelo, a.proporcao)
    saida = ROOT / a.saida
    saida.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(dados)).convert("RGB")
        if im.width > a.largura:
            im = im.resize((a.largura, round(im.height * a.largura / im.width)), Image.LANCZOS)
        im.save(saida, quality=84)
        print(f"ok {saida} {im.size}")
    except ImportError:
        saida.write_bytes(dados)
        print(f"ok {saida} (sem conversão)")
