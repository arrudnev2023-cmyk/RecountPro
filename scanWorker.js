// scanWorker.js
self.onmessage = async (e) => {
  try {
    if (e.data.type === 'frame') {
      const bitmap = e.data.bitmap;
      const maxSide = Math.max(bitmap.width, bitmap.height);

      const off = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = off.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();

      try {
        const imgData = ctx.getImageData(0, 0, off.width, off.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const g = (data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11) | 0;
          data[i] = data[i+1] = data[i+2] = g;
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (err) {
        // Некоторые окружения не позволяют getImageData в воркере — продолжаем без него
      }

      if (self.BarcodeDetector) {
        try {
          const detector = new BarcodeDetector();
          const results = await detector.detect(off);
          if (results && results.length) {
            self.postMessage({ type: 'detected', results });
            return;
          }
        } catch (bdErr) {
          // продолжим к fallback
        }
      }

      const searchScale = Math.max(1, Math.floor(maxSide / 600));
      const sw = Math.round(off.width / searchScale);
      const sh = Math.round(off.height / searchScale);
      const small = new OffscreenCanvas(sw, sh);
      const sctx = small.getContext('2d');
      sctx.drawImage(off, 0, 0, sw, sh);

      const blob = await small.convertToBlob({ type: 'image/png', quality: 0.8 });
      self.postMessage({ type: 'blob', blob }, [blob]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
