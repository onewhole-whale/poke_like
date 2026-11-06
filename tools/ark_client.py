#!/usr/bin/env python3
"""火山方舟调用。密钥在 config/ai/aiClientConfig.json，该文件不进 git。

文本：chat()
立绘：generate_image()，模型默认配置里的 imageModelId。参考图放 image 字段，
可以是公网地址，也可以是本地文件（会转成 Base64）。
"""

from __future__ import annotations

import base64
import json
import mimetypes
import sys
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "ai" / "aiClientConfig.json"


def load_config() -> dict:
    if not CONFIG_PATH.is_file():
        raise RuntimeError(
            "缺少 config/ai/aiClientConfig.json。可按 aiClientConfig.example.json 填写。"
        )
    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if not str(data.get("apiKey") or "").strip() and not data.get("apiKeys"):
        raise RuntimeError("aiClientConfig.json 里没有 apiKey。")
    return data


def _keys(cfg: dict) -> list[str]:
    raw = cfg.get("apiKeys")
    keys = [str(k).strip() for k in raw if str(k).strip()] if isinstance(raw, list) else []
    primary = str(cfg.get("apiKey") or "").strip()
    if primary and primary not in keys:
        keys.insert(0, primary)
    return keys


def _client(cfg: dict, api_key: str) -> OpenAI:
    return OpenAI(
        base_url=str(cfg.get("baseUrl") or "https://ark.cn-beijing.volces.com/api/v3"),
        api_key=api_key,
    )


def chat(user: str, system: str = "", model: str | None = None) -> str:
    """发一轮对话。model 为空时用配置里的 kpModelId。"""
    cfg = load_config()
    model_id = model or cfg.get("kpModelId") or cfg.get("modelId")
    messages = []
    if system.strip():
        messages.append({"role": "system", "content": system.strip()})
    messages.append({"role": "user", "content": user})
    last_error = None
    for key in _keys(cfg):
        try:
            completion = _client(cfg, key).chat.completions.create(
                model=model_id,
                messages=messages,
            )
            return (completion.choices[0].message.content or "").strip()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise RuntimeError(f"文本接口调用失败：{last_error}")


def _image_input(ref: str) -> str:
    path = Path(ref)
    if path.is_file():
        mime = mimetypes.guess_type(path.name)[0] or "image/png"
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:{mime};base64,{encoded}"
    return ref


def generate_image(
    prompt: str,
    images: list[str] | None = None,
    size: str = "1366x2048",
    model: str | None = None,
) -> dict:
    """调用 Seedream。images 为参考图地址或本地路径。返回 url 与实际使用的提示词。"""
    cfg = load_config()
    model_id = model or cfg.get("imageModelId")
    extra: dict = {"watermark": False, "sequential_image_generation": "disabled"}
    refs = [item for item in (images or []) if str(item).strip()]
    if refs:
        payload = [_image_input(item) for item in refs]
        extra["image"] = payload if len(payload) > 1 else payload[0]
    last_error = None
    for key in _keys(cfg):
        try:
            result = _client(cfg, key).images.generate(
                model=model_id,
                prompt=prompt,
                size=size,
                response_format="url",
                extra_body=extra,
            )
            data = getattr(result, "data", None) or []
            first = data[0] if data else None
            return {
                "image_url": getattr(first, "url", None) if first else None,
                "image_base64": getattr(first, "b64_json", None) if first else None,
                "prompt_used": prompt,
                "model": model_id,
            }
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise RuntimeError(f"图像接口调用失败：{last_error}")


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        print("用法: python tools/ark_client.py ping")
        print("      python tools/ark_client.py image \"提示词\"")
        return
    if sys.argv[1] == "ping":
        text = chat("只回复两个字：已通")
        print(text)
        return
    if sys.argv[1] == "image":
        prompt = sys.argv[2] if len(sys.argv) > 2 else "一只红色的狼，竖版立绘，纯色背景"
        result = generate_image(prompt)
        print(result.get("model"))
        print(result.get("image_url") or "没有返回图片地址")
        return
    raise SystemExit(f"未知命令：{sys.argv[1]}")


if __name__ == "__main__":
    main()
