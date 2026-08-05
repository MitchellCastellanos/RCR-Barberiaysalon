// ============================================================
// QR code helper. Loads the "qrcode" package from a CDN (same
// no-build, ESM-import-from-CDN approach used for Firebase) so
// there is no bundler and no npm install step for this static site.
// ============================================================

const QR_LIB_URL = "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
const PRODUCT_BASE_URL = "https://www.rcr-barbershop.com/producto.html";

let _qrLibPromise = null;
function getQrLib() {
  if (!_qrLibPromise) _qrLibPromise = import(QR_LIB_URL);
  return _qrLibPromise;
}

/** The URL encoded in a product's QR label — also the QR-landing page. */
export function buildProductUrl(productId) {
  return `${PRODUCT_BASE_URL}?id=${encodeURIComponent(productId)}`;
}

/** Renders a QR code for `text` onto an existing <canvas> element. */
export async function renderQrToCanvas(canvas, text, { size = 256 } = {}) {
  const mod = await getQrLib();
  const QRCode = mod.default || mod;
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 1,
    color: { dark: "#0A0A0A", light: "#FFFFFF" },
  });
}
