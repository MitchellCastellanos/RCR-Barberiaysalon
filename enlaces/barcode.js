// ============================================================
// Barcode helper (Code128) — printed on labels for in-person
// checkout scanning in Caja, separate from the customer-facing QR.
// Loads "jsbarcode" from a CDN, same no-build approach as qr.js.
// ============================================================

const BARCODE_LIB_URL = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/+esm";

let _libPromise = null;
function getBarcodeLib() {
  if (!_libPromise) _libPromise = import(BARCODE_LIB_URL);
  return _libPromise;
}

/** The value encoded in a product's barcode — its own internal id unless overridden. */
export function buildBarcodeValue(product) {
  return product?.barcode || product?.id || "";
}

/** Renders a Code128 barcode for `value` onto an existing <canvas> element. */
export async function renderBarcodeToCanvas(canvas, value, { height = 40, width = 2, displayValue = true } = {}) {
  const mod = await getBarcodeLib();
  const JsBarcode = mod.default || mod;
  JsBarcode(canvas, value, {
    format: "CODE128",
    height,
    width,
    displayValue,
    margin: 6,
    fontSize: 12,
    background: "#FFFFFF",
    lineColor: "#0A0A0A",
  });
}
