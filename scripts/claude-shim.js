/* Hook Studio on the web: stands in for the artifact runtime's claude.use().
   "sample" calls our /api/sample route (Claude via the Anthropic SDK).
   "downloads" saves files with a normal browser download. */
window.claude = {
  async use(name) {
    if (name === "downloads") {
      return {
        async save({ filename, data }) {
          const blob = data instanceof Blob ? data : new Blob([data]);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
      };
    }
    if (name !== "sample") {
      const e = new Error("not available");
      e.code = "not_declared";
      throw e;
    }
    return {
      async json(prompt, opts = {}) {
        let res;
        try {
          res = await fetch("/api/sample", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt, task: opts.task }),
            signal: opts.signal,
          });
        } catch (err) {
          const e = new Error("request failed");
          e.code = err && err.name === "AbortError" ? "cancelled" : "network";
          throw e;
        }
        if (res.status === 401) { location.href = "/sign-in?next=/studio"; return null; }
        if (res.status === 402) { location.href = "/pricing"; return null; }
        if (!res.ok) {
          const e = new Error("sample failed");
          e.code = res.status === 429 ? "rate_limited" : "error";
          throw e;
        }
        const data = await res.json();
        return data.result;
      },
    };
  },
};
