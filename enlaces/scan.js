// ============================================================
// Camera scanner used by the Caja to add a product by scanning
// its customer-facing QR (producto.html?id=...) — the same QR
// printed on the product's label.
//
// Uses the native BarcodeDetector API where available (Chrome/
// Android, the typical POS device), falling back to a jsQR-based
// scanner elsewhere (e.g. iOS Safari).
// ============================================================

const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm";

let _jsQrPromise = null;
function getJsQr() {
  if (!_jsQrPromise) _jsQrPromise = import(JSQR_URL);
  return _jsQrPromise;
}

/** Pulls the product id back out of a scanned QR URL. */
export function extractProductId(text) {
  try {
    const url = new URL(text);
    return url.searchParams.get("id") || text;
  } catch {
    return text || null; // not a URL — treat the raw payload as the id
  }
}

/**
 * Opens the device camera into `videoEl` and scans for a QR code.
 * Calls onResult(text) once, then stops itself. Returns a
 * stop() function so the caller can cancel manually (e.g. on modal close).
 */
export async function scanCodeFromCamera(videoEl, onResult, onError) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (err) {
    onError?.(err);
    return () => {};
  }

  videoEl.srcObject = stream;
  videoEl.setAttribute("playsinline", "true");
  await videoEl.play();

  let stopped = false;
  let raf;
  function stop() {
    if (stopped) return;
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
  }

  if ("BarcodeDetector" in window) {
    let detector;
    try {
      detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    } catch {
      detector = new window.BarcodeDetector();
    }
    const tickNative = async () => {
      if (stopped) return;
      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        try {
          const codes = await detector.detect(videoEl);
          if (codes && codes.length > 0) {
            stop();
            onResult(codes[0].rawValue);
            return;
          }
        } catch { /* keep trying next frame */ }
      }
      raf = requestAnimationFrame(tickNative);
    };
    raf = requestAnimationFrame(tickNative);
    return stop;
  }

  // Fallback: no native barcode reader on this browser — use jsQR instead.
  let jsQR;
  try {
    const mod = await getJsQr();
    jsQR = mod.default || mod;
  } catch (err) {
    stop();
    onError?.(err);
    return stop;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const tickFallback = () => {
    if (stopped) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && videoEl.videoWidth > 0) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        stop();
        onResult(code.data);
        return;
      }
    }
    raf = requestAnimationFrame(tickFallback);
  };
  raf = requestAnimationFrame(tickFallback);
  return stop;
}
