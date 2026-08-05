// ============================================================
// Camera QR scanner, used by the Caja to add a product by
// pointing the device camera at its printed label. Loads "jsqr"
// from a CDN (same no-build approach as qr.js / Firebase).
// ============================================================

const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm";

let _jsQrPromise = null;
function getJsQr() {
  if (!_jsQrPromise) _jsQrPromise = import(JSQR_URL);
  return _jsQrPromise;
}

/** Pulls the product id back out of a scanned producto.html?id=... URL. */
export function extractProductId(qrText) {
  try {
    const url = new URL(qrText);
    return url.searchParams.get("id");
  } catch {
    return qrText || null; // not a URL — treat the raw payload as the id
  }
}

/**
 * Opens the device camera into `videoEl` and scans frames for a QR code.
 * Calls onResult(text) once a code is found, then stops itself.
 * Returns a stop() function so the caller can cancel manually (e.g. on
 * modal close).
 */
export async function scanQrFromCamera(videoEl, onResult, onError) {
  let jsQR;
  try {
    const mod = await getJsQr();
    jsQR = mod.default || mod;
  } catch (err) {
    onError?.(err);
    return () => {};
  }

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

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let stopped = false;
  let raf;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
  }

  function tick() {
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
    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);
  return stop;
}
