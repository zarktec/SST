/** Cola de inspecciones sin conexión en IndexedDB (solo navegador). Cada elemento lleva `offlineId`: el servidor deduplica. */
export type QueuedInspection = {
  offlineId: string;
  /** Ruta base de la empresa (`/acme` o ""): las empresas comparten origen, así que cada elemento se envía solo a la suya. */
  base?: string;
  payload: Record<string, unknown>;
  queuedAt: string;
  /** Mensaje de rechazo del servidor (validación): no se reintenta hasta que la persona lo descarte. */
  error?: string;
};

const DB = "sst-offline";
const STORE = "inspections";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "offlineId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const enqueue = (item: QueuedInspection) => run("readwrite", (s) => s.put(item));
/** Pendientes de la empresa indicada (por su ruta base). */
export const listQueue = async (base = "") =>
  (await run<QueuedInspection[]>("readonly", (s) => s.getAll())).filter(
    (i) => (i.base ?? "") === base,
  );
export const removeFromQueue = (id: string) => run("readwrite", (s) => s.delete(id));

export type SendResult = "sent" | "retry" | "rejected";
/** Envía una inspección al servidor. `retry`: sin red o sin sesión; `rejected`: el servidor la rechazó por validación. */
export async function send(
  payload: Record<string, unknown>,
  base = "",
): Promise<{ result: SendResult; message?: string }> {
  try {
    const res = await fetch(`${base}/api/inspecciones/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.redirected || !(res.headers.get("content-type") ?? "").includes("json"))
      return { result: "retry", message: "Inicia sesión para sincronizar." };
    const j = (await res.json()) as { ok: boolean; message?: string };
    if (res.ok && j.ok) return { result: "sent" };
    if (res.status === 422 || res.status === 400) return { result: "rejected", message: j.message };
    return { result: "retry" };
  } catch {
    return { result: "retry" };
  }
}

const SYNCED_KEY = "sst-synced-at";
/** Deja constancia de que se sincronizó algo: otra pantalla (p. ej. una recién abierta) sabrá que su lista pudo quedar vieja. */
function markSynced() {
  try {
    localStorage.setItem(SYNCED_KEY, String(Date.now()));
  } catch {
    /* sin almacenamiento: solo se pierde la actualización automática de la lista */
  }
}
/**
 * ¿Se sincronizó algo justo antes o durante la carga de esta pantalla? Si es así, su lista pudo renderizarse en el servidor antes de
 * que la inspección se guardara y conviene refrescarla (un solo uso).
 */
export function consumeRecentSync(loadedAt: number): boolean {
  try {
    const at = Number(localStorage.getItem(SYNCED_KEY));
    if (!at || at < loadedAt - 5000) return false;
    localStorage.removeItem(SYNCED_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Intenta enviar todo lo pendiente. Devuelve cuántas se enviaron y cuántas quedan. */
export async function flushQueue(base = ""): Promise<{ sent: number; pending: number }> {
  let sent = 0;
  for (const item of await listQueue(base)) {
    if (item.error) continue;
    const r = await send(item.payload, base);
    if (r.result === "sent") {
      await removeFromQueue(item.offlineId);
      markSynced();
      sent++;
    } else if (r.result === "rejected") await enqueue({ ...item, error: r.message ?? "Rechazada" });
    else break; // sin red o sin sesión: no tiene caso seguir
  }
  const pending = (await listQueue(base)).filter((i) => !i.error).length;
  return { sent, pending };
}
