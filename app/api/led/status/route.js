import net from "net";

export const runtime = "nodejs";

function checkPanelOnline(ip, port, timeout = 2000) {
  return new Promise((resolve) => {
    if (!ip || !port) return resolve(false);

    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeout);

    socket.connect(port, ip, () => {
      resolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on("error", () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
  });
}

export async function POST(req) {
  const { ip, port } = await req.json();

  const online = await checkPanelOnline(ip, port);

  return new Response(
    JSON.stringify({
      online,
      timestamp: Date.now(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
