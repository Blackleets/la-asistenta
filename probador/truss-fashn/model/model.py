"""Servidor Truss de FASHN VTON v1.5 para LA ASISTENTA.

Entrada (JSON):
  person_image_b64   foto de la persona (base64, RGB)
  garment_image_b64  imagen de la prenda (base64, RGB)
  category           "tops" | "bottoms" | "one-pieces"
  garment_photo_type "model" | "flat-lay"  (defecto "model")
  num_timesteps      pasos de difusión (defecto 30)
  seed               semilla (defecto 42)

Salida (JSON):
  image_b64, width, height, inference_s, model
"""

import base64
import io
import os
import time

from PIL import Image

WEIGHTS_DIR = "/tmp/fashn-weights"


class Model:
    def load(self):
        os.makedirs(os.path.join(WEIGHTS_DIR, "dwpose"), exist_ok=True)
        model_path = os.path.join(WEIGHTS_DIR, "model.safetensors")
        if not os.path.exists(model_path):
            from huggingface_hub import hf_hub_download

            hf_hub_download(
                repo_id="fashn-ai/fashn-vton-1.5",
                filename="model.safetensors",
                local_dir=WEIGHTS_DIR,
            )
            for fname in ("yolox_l.onnx", "dw-ll_ucoco_384.onnx"):
                hf_hub_download(
                    repo_id="fashn-ai/DWPose",
                    filename=fname,
                    local_dir=os.path.join(WEIGHTS_DIR, "dwpose"),
                )
        from fashn_vton import TryOnPipeline

        # La instanciación también descarga los pesos del human parser
        # a la caché de HuggingFace en el primer arranque.
        self.pipeline = TryOnPipeline(weights_dir=WEIGHTS_DIR)

    def predict(self, request: dict):
        person = Image.open(
            io.BytesIO(base64.b64decode(request["person_image_b64"]))
        ).convert("RGB")
        garment = Image.open(
            io.BytesIO(base64.b64decode(request["garment_image_b64"]))
        ).convert("RGB")
        t0 = time.time()
        result = self.pipeline(
            person_image=person,
            garment_image=garment,
            category=request.get("category", "tops"),
            garment_photo_type=request.get("garment_photo_type", "model"),
            num_timesteps=int(request.get("num_timesteps", 30)),
            seed=int(request.get("seed", 42)),
        )
        image = result.images[0]
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return {
            "image_b64": base64.b64encode(buf.getvalue()).decode("ascii"),
            "width": image.width,
            "height": image.height,
            "inference_s": round(time.time() - t0, 2),
            "model": "fashn-vton-1.5",
        }
