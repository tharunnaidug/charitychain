const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";
export const getToken = () => window.localStorage.getItem("cc-token");
export const setToken = token => token ? localStorage.setItem("cc-token", token) : localStorage.removeItem("cc-token");
export async function api(path, { body, headers, ...rest } = {}) {
  const isForm = body instanceof FormData;
  const token = getToken();
  let response;
  try {
    response = await fetch(BASE + path, {
      ...rest,
      headers: { ...(isForm || body == null ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: isForm || body == null ? body : JSON.stringify(body)
    });
  } catch { throw new Error("Cannot reach the API. Is the backend running on port 5000?"); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
export async function openEvidence(billId, expectedHash) {
  const response = await fetch(`${BASE}/bills/${billId}/file`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Bill evidence not available");
  }
  const blob = await response.blob();
  if (expectedHash) {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const actual = "0x" + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
    if (actual.toLowerCase() !== expectedHash.toLowerCase())
      throw new Error("Evidence integrity check failed: file no longer matches its stored blockchain hash.");
  }
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    const a = document.createElement("a"); a.href = url; a.download = `verified-bill-${billId}`; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
