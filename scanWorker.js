// scanWorker.js
// Принимает { type: 'frame', bitmap } или { type: 'frameBlob', blob }
// Возвращает { type: 'detected', results } | { type: 'bbox', bbox } | { type: 'blob', blob } | { type: 'error', message }

self.onmessage = async (e) => {
  try {
    if (e.data.type === 'frameBlob') {
      const blob = e.data.blob;
      try {
        const img = await createImageBitmap(blob);
        e.data.bitmap = img;
      } catch (err) {
        self.postMessage({ type: 'error', message: 'createImageBitmap failed: ' + (err?.message || err) });
        return;
      }
    }

    if (e.data.type !== 'frame' || !e.data.bitmap) return;
    const bitmap = e.data.bitmap;
    const w = bitmap.width, h = bitmap.height;

    const off = new OffscreenCanvas(w, h);
    const ctx = off.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    // Быстрая попытка нативного BarcodeDetector
    if (self.BarcodeDetector) {
      try {
        const detector = new BarcodeDetector();
        const results = await detector.detect(off);
        if (results && results.length) {
          self.postMessage({ type: 'detected', results });
          return;
        }
      } catch (bdErr) {
        // продолжаем к анализу
      }
    }

    // Попытка получить ImageData (может быть запрещено в некоторых окружениях)
    let imgData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch (err) {
      // fallback: отправим уменьшённый blob на главный поток
      const small = new OffscreenCanvas(Math.max(1, Math.round(w/3)), Math.max(1, Math.round(h/3)));
      const sctx = small.getContext('2d');
      sctx.drawImage(off, 0, 0, small.width, small.height);
      const blob = await small.convertToBlob({ type: 'image/png', quality: 0.8 });
      self.postMessage({ type: 'blob', blob }, [blob]);
      return;
    }

    const data = imgData.data;
    // grayscale inplace
    for (let i = 0; i < data.length; i += 4) {
      const g = (data[i]*0.3 + data[i+1]*0.59 + data[i+2]*0.11) | 0;
      data[i] = data[i+1] = data[i+2] = g;
    }

    // блоковая карта для поиска потенциальных областей штрихкода
    const block = 28;
    const cols = Math.ceil(w / block);
    const rows = Math.ceil(h / block);
    const bin = new Uint8Array(cols * rows);

    for (let by = 0; by < rows; by++) {
      for (let bx = 0; bx < cols; bx++) {
        let sum = 0, cnt = 0;
        const sx = bx * block, sy = by * block;
        for (let y = sy; y < Math.min(h, sy + block); y++) {
          for (let x = sx; x < Math.min(w, sx + block); x++) {
            const idx = (y * w + x) * 4;
            sum += data[idx];
            cnt++;
          }
        }
        const avg = cnt ? (sum / cnt) : 0;
        bin[by * cols + bx] = avg < 150 ? 1 : 0;
      }
    }

    let minX = cols, minY = rows, maxX = 0, maxY = 0, found = false;
    for (let by = 0; by < rows; by++) {
      for (let bx = 0; bx < cols; bx++) {
        if (bin[by * cols + bx]) {
          found = true;
          if (bx < minX) minX = bx;
          if (by < minY) minY = by;
          if (bx > maxX) maxX = bx;
          if (by > maxY) maxY = by;
        }
      }
    }

    if (found) {
      const pad = 1;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(cols - 1, maxX + pad);
      maxY = Math.min(rows - 1, maxY + pad);

      const bx = Math.round(minX * block);
      const by = Math.round(minY * block);
      const bw = Math.min(w - bx, Math.round((maxX - minX + 1) * block));
      const bh = Math.min(h - by, Math.round((maxY - minY + 1) * block));

      if (bw > 20 && bh > 8) {
        self.postMessage({ type: 'bbox', bbox: { x: bx, y: by, w: bw, h: bh } });
        return;
      }
    }

    // fallback: уменьшённый blob
    const small = new OffscreenCanvas(Math.max(1, Math.round(w/3)), Math.max(1, Math.round(h/3)));
    const sctx = small.getContext('2d');
    sctx.drawImage(off, 0, 0, small.width, small.height);
    const blob = await small.convertToBlob({ type: 'image/png', quality: 0.8 });
    self.postMessage({ type: 'blob', blob }, [blob]);

  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};


