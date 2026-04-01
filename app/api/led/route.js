import net from "net";

export const runtime = "nodejs";
 
export async function POST(req) {
  const body = await req.json();

  // Valeurs par défaut (sécurité)
  const {
    color =1,
    front = "small",
    light = 0,
    row1 = "",
    row2 = "",
    row3 = "SAFER",
    row4 = "TOGO",
    bright = 50,
    url:{
        panelAddress,
        panelPort,
    }
  } = body;

  // Construction dynamique de la trame
  const data =
    `color=${color},` +
    `front=${front},` +
    `light=${light},` +
    `row1=${row1},` +
    `row2=${row2},` +
    `row3=${row3},` +
    `row4=${row4},` +
    `bright=${bright}\r\n`;

  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.connect(panelPort, panelAddress, () => {
      console.log("Connecté au panneau");
      console.log("Trame envoyée:", data);
      socket.write(Buffer.from(data, "ascii"));
    });

    socket.on("data", (chunk) => {
      console.log("Réponse panneau:", chunk.toString());
    });

    socket.on("error", (err) => {
      console.error("Erreur socket:", err.message);
      resolve(
        new Response(JSON.stringify({ error: err.message }), { status: 500 })
      );
    });

    socket.on("close", () => {
      resolve(
        new Response(JSON.stringify({ ok: true, sent: data }))
      );
    });
  });
}

