// scanWorker.js
// Принимает { type: 'frame', bitmap } (ImageBitmap)
// Возвращает сообщения:
// { type: 'detected', results }  -- если BarcodeDetector нашёл коды
// { type: 'bbox', bbox }         -- если найден потенциальный bbox {x,y,w,h} в координатах исходного bitmap
// { type: 'blob', blob }         -- уменьшенный blob (fallback)
// { type: 'error', message }

self.onmessage = async (e) => {
  try {
    if (e.data.type !== 'frame') return;
    const bitmap = e.data.bitmap;
    const w = bitmap.width, h = bitmap.height;

    // OffscreenCanvas для обработки
    const off = new OffscreenCanvas(w, h);
    const ctx = off.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    // Быстрая попытка нативного BarcodeDetector (если доступен в воркере)
    if (self.BarcodeDetector) {
      try {
        const detector = new BarcodeDetector();
        const results = await detector.detect(off);
        if (results && results.length) {
          self.postMessage({ type: 'detected', results });
          return;
        }
      } catch (bdErr) {
        // продолжаем к поиску bbox
      }
    }

    // Быстрая grayscale + простая адаптивная бинаризация (локальный порог по блокам)
    let img;
    try {
      img = ctx.getImageData(0, 0, w, h);
    } catch (err) {
      // если getImageData запрещён в воркере, отправим уменьшенный blob на главный поток
      const small = new OffscreenCanvas(Math.max(1, Math.round(w/3)), Math.max(1, Math.round(h/3)));
      const sctx = small.getContext('2d');
      sctx.drawImage(off, 0, 0, small.width, small.height);
      const blob = await small.convertToBlob({ type: 'image/png', quality: 0.8 });
      self.postMessage({ type: 'blob', blob }, [blob]);
      return;
    }

    const data = img.data;
    // grayscale
    for (let i = 0; i < data.length; i += 4) {
      const g = (data[i]*0.3 + data[i+1]*0.59 + data[i+2]*0.11) | 0;
      data[i] = data[i+1] = data[i+2] = g;
    }

    // простая локальная пороговая карта: делим на блоки и порогуем
    const block = 32;
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
        bin[by * cols + bx] = avg < 140 ? 1 : 0; // 140 — эмпирический порог
      }
    }

    // Найдём область с высокой плотностью "тёмных" блоков
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
      // расширим bbox немного
      const pad = 1;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(cols - 1, maxX + pad);
      maxY = Math.min(rows - 1, maxY + pad);

      const bx = Math.round(minX * block);
      const by = Math.round(minY * block);
      const bw = Math.min(w - bx, Math.round((maxX - minX + 1) * block));
      const bh = Math.min(h - by, Math.round((maxY - minY + 1) * block));

      // Небольшая проверка: bbox должен быть достаточно широким (штрихкоды обычно широкие)
      if (bw > 20 && bh > 8) {
        self.postMessage({ type: 'bbox', bbox: { x: bx, y: by, w: bw, h: bh } });
        return;
      }
    }

    // Если ничего не найдено — отправим уменьшенный blob как fallback
    const small = new OffscreenCanvas(Math.max(1, Math.round(w/3)), Math.max(1, Math.round(h/3)));
    const sctx = small.getContext('2d');
    sctx.drawImage(off, 0, 0, small.width, small.height);
    const blob = await small.convertToBlob({ type: 'image/png', quality: 0.8 });
    self.postMessage({ type: 'blob', blob }, [blob]);

  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
