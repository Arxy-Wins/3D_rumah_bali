"""Kuantisasi bobot model TF.js (layers-model) ke float16 atau uint8 tanpa tensorflowjs_converter."""
import json, sys, os, numpy as np
src, dst, mode = sys.argv[1], sys.argv[2], sys.argv[3]  # mode: float16 | uint8
m = json.load(open(os.path.join(src, "model.json")))
out_entries, chunks = [], []
for group in m["weightsManifest"]:
    buf = b"".join(open(os.path.join(src, p), "rb").read() for p in group["paths"])
    off = 0
    for w in group["weights"]:
        n = int(np.prod(w["shape"])) if w["shape"] else 1
        assert w["dtype"] == "float32" and "quantization" not in w
        arr = np.frombuffer(buf, dtype="<f4", count=n, offset=off); off += 4 * n
        e = {"name": w["name"], "shape": w["shape"], "dtype": "float32"}
        if mode == "float16":
            chunks.append(arr.astype("<f2").tobytes())
            e["quantization"] = {"dtype": "float16", "original_dtype": "float32"}
        else:
            lo, hi = float(arr.min()), float(arr.max())
            scale = (hi - lo) / 255 if hi > lo else 1.0
            q = np.round((arr - lo) / scale).clip(0, 255).astype(np.uint8)
            chunks.append(q.tobytes())
            e["quantization"] = {"dtype": "uint8", "min": lo, "scale": scale, "original_dtype": "float32"}
        out_entries.append(e)
data = b"".join(chunks)
os.makedirs(dst, exist_ok=True)
SH = 4 * 1024 * 1024
paths = []
for i in range(0, len(data), SH):
    name = f"group1-shard{i // SH + 1}of{(len(data) + SH - 1) // SH}.bin"
    open(os.path.join(dst, name), "wb").write(data[i:i + SH]); paths.append(name)
m["weightsManifest"] = [{"paths": paths, "weights": out_entries}]
json.dump(m, open(os.path.join(dst, "model.json"), "w"))
print(mode, "→", round(len(data) / 1e6, 1), "MB,", len(paths), "shard")
