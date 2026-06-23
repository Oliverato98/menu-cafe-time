// polla.js — lógica del cliente para la Polla Colombia vs RD Congo
const API_POLLA = "/api/polla";

async function cargarPolla() {
  const lista = document.getElementById("pollaLista");
  const ranking = document.getElementById("pollaRanking");
  if (!lista) return; // si la sección no existe en esta página, salir

  try {
    const res = await fetch(API_POLLA);
    const data = await res.json();

    // Lista de pronósticos
    if (!data.entries || data.entries.length === 0) {
      lista.innerHTML = '<p class="polla-msg">Aún no hay pronósticos. ¡Sé el primero!</p>';
    } else {
      const orden = [...data.entries].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
      lista.innerHTML = orden
        .map(
          (e) => `
        <div class="polla-entry">
          <div>
            <strong>${escapeHtml(e.nombre)}</strong>
            <span class="polla-pick">${e.colombia} - ${e.congo}${e.goleador ? " · ⚽ " + escapeHtml(e.goleador) : ""}</span>
          </div>
          ${data.resultado ? `<span class="polla-points">${e.puntos ?? 0} pts</span>` : ""}
        </div>`
        )
        .join("");
    }

    // Ranking (solo si ya hay resultado oficial)
    if (data.resultado) {
      const podio = (titulo, arr, medalla) =>
        arr.length
          ? `<div class="podio-puesto">
              <span class="podio-medalla">${medalla} ${titulo}</span>
              ${arr.map((e) => `<div class="podio-nombre">${escapeHtml(e.nombre)} — ${e.puntos} pts</div>`).join("")}
            </div>`
          : "";

      ranking.innerHTML = `
        <p class="polla-resultado-final">Resultado final: Colombia ${data.resultado.colombia} - ${data.resultado.congo} RD Congo
        ${data.resultado.goleador ? " · Goleador: " + escapeHtml(data.resultado.goleador) : ""}</p>
        ${podio("Primer puesto", data.primerPuesto, "🥇")}
        ${podio("Segundo puesto", data.segundoPuesto, "🥈")}
      `;
    } else {
      ranking.innerHTML = '<p class="polla-msg">Esperando el resultado oficial del partido...</p>';
    }
  } catch (err) {
    lista.innerHTML = '<p class="polla-msg">No se pudo cargar la información. Intenta de nuevo.</p>';
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
  cargarPolla();
  const form = document.getElementById("pollaForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("pollaMsg");
      const nombre = document.getElementById("pNombre").value.trim();
      const colombia = document.getElementById("pColombia").value;
      const congo = document.getElementById("pCongo").value;
      const goleador = document.getElementById("pGoleador").value;

      if (!nombre || colombia === "" || congo === "") {
        msg.textContent = "Completa tu nombre y el marcador.";
        msg.className = "polla-msg error";
        return;
      }

      msg.textContent = "Enviando...";
      msg.className = "polla-msg";

      try {
        const res = await fetch(API_POLLA, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit", nombre, colombia, congo, goleador }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al enviar");

        msg.textContent = "¡Pronóstico registrado! 🎉";
        msg.className = "polla-msg success";
        cargarPolla();
      } catch (err) {
        msg.textContent = "Error: " + err.message;
        msg.className = "polla-msg error";
      }
    });
  }

  // refresca el ranking cada 30s para que se vea en vivo
  setInterval(cargarPolla, 30000);
});
