const invoke = window.__TAURI_INTERNALS__.invoke;
const $ = (id) => document.getElementById(id);
const PROBE_TIMEOUT_MS = 8000;

function show(state, server, reason) {
  $("connecting").hidden = state !== "connecting";
  $("setup").hidden = state === "connecting";
  $("form").hidden = state === "connecting";
  $("connecting-url").textContent = server?.url ?? "";
  $("reason").textContent = reason ?? "";
  $("retry").hidden = !server?.url;
  $("reset").hidden = !server?.defaultUrl || server.source !== "saved";
  $("hint").textContent = server?.allowsLoopbackHttp
    ? "Debug build: http://localhost and http://127.0.0.1 are allowed, for example http://localhost:4401 through adb reverse."
    : "The server must use https://.";
  if (server?.url && !$("url").value) $("url").value = server.url;
}

async function reachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // no-cors resolves on any HTTP answer and rejects on network failure, which is all
    // this probe needs; the server does not have to send CORS headers.
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function connect(server) {
  if (!server.url) {
    show("setup", server, "Enter the address of your Super Duper server.");
    return;
  }
  show("connecting", server);
  if (await reachable(server.url)) {
    window.location.replace(server.url);
  } else {
    show("setup", server, `Cannot reach ${server.url}. Check the address and your connection, or enter another server.`);
  }
}

function fail(error) {
  $("error").hidden = false;
  $("error").textContent = error?.message ?? String(error);
}

$("form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("error").hidden = true;
  invoke("set_server_url", { url: $("url").value }).catch(fail);
});
$("reset").addEventListener("click", () => {
  $("url").value = "";
  invoke("set_server_url", { url: null }).catch(fail);
});
$("retry").addEventListener("click", () => invoke("get_server_url").then(connect).catch(fail));

invoke("get_server_url").then(connect).catch(fail);
