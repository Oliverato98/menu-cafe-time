// netlify/functions/polla.js
// API de la Polla "Colombia vs RD Congo" - usa Netlify Blobs como base de datos.
const { getStore } = require("@netlify/blobs");

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

// Calcula los puntos de un pronóstico dado el resultado real
function calcularPuntos(entry, resultado) {
  if (!resultado) return 0;
  let puntos = 0;

  const exacto =
    Number(entry.colombia) === Number(resultado.colombia) &&
    Number(entry.congo) === Number(resultado.congo);
  if (exacto) puntos += 5; // marcador exacto

  const diffEntry = Number(entry.colombia) - Number(entry.congo);
  const diffResultado = Number(resultado.colombia) - Number(resultado.congo);
  if (diffEntry === diffResultado) puntos += 3; // diferencia de goles

  if (
    entry.goleador &&
    resultado.goleador &&
    entry.goleador === resultado.goleador
  ) {
    puntos += 3; // goleador
  }

  const ganador = (c, g) => (c > g ? "COL" : c < g ? "CON" : "EMPATE");
  if (
    ganador(Number(entry.colombia), Number(entry.congo)) ===
    ganador(Number(resultado.colombia), Number(resultado.congo))
  ) {
    puntos += 3; // equipo ganador
  }

  return puntos;
}

// Construye el ranking: 1er puesto y 2do puesto (pueden ser varios empatados)
function construirRanking(entries, resultado) {
  if (!resultado) return { primerPuesto: [], segundoPuesto: [] };

  const conPuntos = entries.map((e) => ({
    ...e,
    puntos: calcularPuntos(e, resultado),
  }));

  const puntosUnicos = [...new Set(conPuntos.map((e) => e.puntos))].sort(
    (a, b) => b - a
  );

  const primerPuntaje = puntosUnicos[0];
  const segundoPuntaje = puntosUnicos[1];

  const primerPuesto = conPuntos.filter((e) => e.puntos === primerPuntaje);
  const segundoPuesto =
    segundoPuntaje !== undefined
      ? conPuntos.filter((e) => e.puntos === segundoPuntaje)
      : [];

  return { primerPuesto, segundoPuesto, conPuntos };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }

  const store = getStore("polla");

  try {
    if (event.httpMethod === "GET") {
      const entries = (await store.get("entries", { type: "json" })) || [];
      const resultado = (await store.get("resultado", { type: "json" })) || null;
      const { primerPuesto, segundoPuesto, conPuntos } = construirRanking(
        entries,
        resultado
      );
      return json(200, {
        entries: conPuntos || entries,
        resultado,
        primerPuesto,
        segundoPuesto,
      });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      // --- Acción: enviar pronóstico de un cliente ---
      if (body.action === "submit") {
        const { nombre, colombia, congo, goleador } = body;
        if (
          !nombre ||
          colombia === undefined ||
          congo === undefined ||
          colombia === "" ||
          congo === ""
        ) {
          return json(400, { error: "Faltan datos del pronóstico." });
        }

        const entries = (await store.get("entries", { type: "json" })) || [];
        const nombreNormalizado = String(nombre).trim();

        const nuevaEntry = {
          id:
            Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          nombre: nombreNormalizado,
          colombia: Number(colombia),
          congo: Number(congo),
          goleador: goleador || "",
          fecha: new Date().toISOString(),
        };

        // Si la persona ya había pronosticado (mismo nombre exacto), se actualiza su pronóstico
        const idx = entries.findIndex(
          (e) => e.nombre.toLowerCase() === nombreNormalizado.toLowerCase()
        );
        if (idx >= 0) {
          nuevaEntry.id = entries[idx].id;
          entries[idx] = nuevaEntry;
        } else {
          entries.push(nuevaEntry);
        }

        await store.setJSON("entries", entries);
        return json(200, { ok: true, entry: nuevaEntry });
      }

      // --- Acción: admin ingresa el resultado real ---
      if (body.action === "admin_set_resultado") {
        if (body.password !== process.env.ADMIN_PASSWORD) {
          return json(401, { error: "Contraseña incorrecta." });
        }
        const { colombia, congo, goleador } = body;
        if (colombia === undefined || congo === undefined) {
          return json(400, { error: "Faltan datos del resultado." });
        }
        const resultado = {
          colombia: Number(colombia),
          congo: Number(congo),
          goleador: goleador || "",
        };
        await store.setJSON("resultado", resultado);
        return json(200, { ok: true, resultado });
      }

      // --- Acción: admin valida contraseña (login) ---
      if (body.action === "admin_login") {
        if (body.password !== process.env.ADMIN_PASSWORD) {
          return json(401, { error: "Contraseña incorrecta." });
        }
        return json(200, { ok: true });
      }

      // --- Acción: admin borra todo (reiniciar la polla) ---
      if (body.action === "admin_reset") {
        if (body.password !== process.env.ADMIN_PASSWORD) {
          return json(401, { error: "Contraseña incorrecta." });
        }
        await store.setJSON("entries", []);
        await store.delete("resultado");
        return json(200, { ok: true });
      }

      return json(400, { error: "Acción no reconocida." });
    }

    return json(405, { error: "Método no permitido." });
  } catch (err) {
    return json(500, { error: "Error del servidor: " + err.message });
  }
};
