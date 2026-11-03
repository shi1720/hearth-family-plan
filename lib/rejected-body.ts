export async function discardRejectedBody(req: Request, maxBytes: number) {
  // Related local-runtime issue: https://github.com/cloudflare/workerd/issues/7634
  // Consume only a bounded body through EOF; cancellation alone can reset a
  // service-binding connection. Never parse, retain or act on rejected content.
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reachedEnd = false;
  try {
    reader = req.body?.getReader();
    if (!reader) return;
    const expired = Symbol("rejection-drain-deadline");
    const deadline = new Promise<typeof expired>((resolve) => {
      timer = setTimeout(() => resolve(expired), 1000);
    });
    let bytes = 0;
    for (let reads = 0; reads < 256; reads++) {
      const result = await Promise.race([reader.read(), deadline]);
      if (result === expired) break;
      if (result.done) {
        reachedEnd = true;
        break;
      }
      bytes += result.value.byteLength;
      if (bytes > Math.min(maxBytes, 300000)) break;
    }
  } catch {
    // Best effort cleanup must not replace the original authorization response.
  } finally {
    if (timer) clearTimeout(timer);
    if (reader) {
      if (!reachedEnd) void reader.cancel().catch(() => {});
      try { reader.releaseLock(); } catch {}
    }
  }
}
