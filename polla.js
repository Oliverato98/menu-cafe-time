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

// Comprime una imagen a un tamaño razonable y la devuelve en base64
function comprimirImagen(file, maxAncho = 700, calidad = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxAncho / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  cargarPolla();
  const form = document.getElementById("pollaForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("pollaMsg");
      const nombre = document.getElementById("pNombre").value.trim();
      const telefono = document.getElementById("pTelefono").value.trim();
      const colombia = document.getElementById("pColombia").value;
      const congo = document.getElementById("pCongo").value;
      const goleador = document.getElementById("pGoleador").value;
      const archivoComprobante = document.getElementById("pComprobante").files[0];

      if (!nombre || !telefono || colombia === "" || congo === "") {
        msg.textContent = "Completa tu nombre, teléfono y el marcador.";
        msg.className = "polla-msg error";
        return;
      }

      msg.textContent = "Enviando...";
      msg.className = "polla-msg";

      try {
        let comprobante = "";
        if (archivoComprobante) {
          msg.textContent = "Procesando comprobante...";
          comprobante = await comprimirImagen(archivoComprobante);
        }

        const res = await fetch(API_POLLA, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit", nombre, telefono, colombia, congo, goleador, comprobante }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al enviar");

        msg.textContent = "¡Pronóstico registrado! 🎉";
        msg.className = "polla-msg success";
        form.reset();
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
