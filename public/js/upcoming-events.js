import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  updateDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { showVolunteersModal } from "./users-events.js";
// =============================================
// VARIABLES GLOBALES
// =============================================
let db = null;

// Función para obtener la instancia de Firebase
function getFirebaseDB() {
  if (!db) {
    db = window.firebaseDB;
  }
  return db;
}

// =============================================
// FUNCIONES AUXILIARES PARA FECHAS STRING
// =============================================

/**
 * Convertir string de fecha a objeto Date
 * Formatos soportados: "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"
 */
function parseStringToDate(dateString) {
  if (!dateString || typeof dateString !== "string") {
    console.warn("⚠️ Fecha inválida:", dateString);
    return new Date();
  }

  // Limpiar la string de espacios extra
  dateString = dateString.trim();

  try {
    // Formato ISO: YYYY-MM-DD
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(dateString + "T00:00:00");
    }

    // Formato DD/MM/YYYY
    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = dateString.split("/");
      return new Date(year, month - 1, day);
    }

    // Formato MM/DD/YYYY
    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      // Intentar como MM/DD/YYYY si DD/MM/YYYY no funcionó
      const [month, day, year] = dateString.split("/");
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Intentar parseado directo
    const parsedDate = new Date(dateString);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }

    console.warn("⚠️ No se pudo parsear la fecha:", dateString);
    return new Date();
  } catch (error) {
    console.error("❌ Error al parsear fecha:", dateString, error);
    return new Date();
  }
}

/**
 * Obtener fecha de inicio del día actual como string
 */
function getTodayAsString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Comparar si una fecha string es mayor o igual a hoy
 */
function isDateFromToday(dateString) {
  const eventDate = parseStringToDate(dateString);
  const today = new Date();

  // Resetear horas para comparar solo fechas
  const eventDateOnly = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate()
  );
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return eventDateOnly >= todayOnly;
}

// =============================================
// FUNCIONES PARA EVENTOS FUTUROS
// =============================================

/**
 * Cargar y mostrar eventos futuros - ACTUALIZADA PARA FECHAS STRING
 */
export async function loadUpcomingEvents() {
  console.log("🔄 Iniciando carga de eventos futuros...");

  const loadingEl = document.getElementById("upcomingLoading");
  const eventsContainer = document.getElementById("upcomingEvents");

  try {
    if (loadingEl) loadingEl.style.display = "block";

    // Obtener instancia de Firebase
    const firebaseDB = getFirebaseDB();
    if (!firebaseDB) {
      throw new Error("Firebase no está inicializado");
    }

    console.log("📅 Consultando eventos desde hoy...");

    const eventosRef = collection(firebaseDB, "eventos");

    // CONSULTA SIMPLIFICADA: Solo obtener eventos activos
    // Ya no podemos filtrar por fecha en la consulta porque es string
    const q = query(eventosRef, where("estado", "==", "activo"));

    const querySnapshot = await getDocs(q);
    const events = [];

    querySnapshot.forEach((docSnapshot) => {
      const eventData = { id: docSnapshot.id, ...docSnapshot.data() };

      // Filtrar eventos futuros en memoria
      if (eventData.fechaInicio && isDateFromToday(eventData.fechaInicio)) {
        console.log("📋 Evento encontrado:", {
          id: eventData.id,
          titulo: eventData.titulo,
          fechaInicio: eventData.fechaInicio,
          fechaParsed: parseStringToDate(eventData.fechaInicio),
          estado: eventData.estado,
        });
        events.push(eventData);
      }
    });

    // Ordenar eventos por fecha manualmente
    events.sort((a, b) => {
      const dateA = parseStringToDate(a.fechaInicio);
      const dateB = parseStringToDate(b.fechaInicio);
      return dateA - dateB;
    });

    displayUpcomingEvents(events);
    console.log(`✅ Cargados ${events.length} eventos futuros activos`);
  } catch (error) {
    console.error("❌ Error al cargar eventos futuros:", error);

    if (eventsContainer) {
      eventsContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle fa-2x mb-2" style="color: #FF8C00;"></i>
          <div class="fw-bold" style="color: #CC6A00;">Error al cargar eventos futuros</div>
          <small class="text-muted d-block mb-2">Error: ${error.message}</small>
          <br>
          <button class="btn btn-orange btn-sm mt-2" onclick="window.loadUpcomingEvents()">
            <i class="fas fa-redo"></i> Reintentar
          </button>
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

/**
 * Mostrar eventos futuros en el DOM - ACTUALIZADA PARA FECHAS STRING
 */
function displayUpcomingEvents(events) {
  const eventsContainer = document.getElementById("upcomingEvents");
  if (!eventsContainer) {
    console.error("❌ Contenedor 'upcomingEvents' no encontrado");
    return;
  }

  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-calendar-plus fa-3x mb-3" style="color: #FF8C00;"></i>
        <h5 style="color: #CC6A00;">No hay eventos futuros programados</h5>
        <p class="text-muted">Crea un nuevo evento usando la pestaña "Crear Evento"</p>
        <button class="btn btn-orange" onclick="document.getElementById('create-tab')?.click()">
          <i class="fas fa-plus"></i> Crear Nuevo Evento
        </button>
      </div>
    `;
    return;
  }

  let eventsHTML = "";
  events.forEach((event) => {
    const fechaInicio = parseStringToDate(event.fechaInicio);
    const fechaFin = event.fechaFin ? parseStringToDate(event.fechaFin) : null;

    eventsHTML += createUpcomingEventCard(event, fechaInicio, fechaFin);
  });

  eventsContainer.innerHTML = eventsHTML;
  console.log(`✅ Mostrados ${events.length} eventos en el DOM`);
}

/**
 * Crear tarjeta HTML para evento futuro (versión compacta) - ACTUALIZADA
 */
function createUpcomingEventCard(event, fechaInicio, fechaFin) {
  // Verificar si el evento es hoy
  const today = new Date();
  const isToday = fechaInicio.toDateString() === today.toDateString();
  const statusClass = isToday ? "bg-warning text-dark" : "bg-orange text-white";
  const statusText = isToday ? "Hoy" : "Próximo";

  // Calcular días restantes
  const timeDiff = fechaInicio.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  let timeInfo = "";

  if (isToday) {
    timeInfo = "¡Es hoy!";
  } else if (daysDiff === 1) {
    timeInfo = "Mañana";
  } else if (daysDiff > 0) {
    timeInfo = `En ${daysDiff} días`;
  } else {
    timeInfo = "En curso";
  }

  return `
    <div class="event-card mb-3 animate__animated animate__fadeIn" data-event-id="${
      event.id
    }">
      <div class="card shadow-sm border-orange">
        <!-- Header compacto con gradiente -->
        <div class="card-header d-flex justify-content-between align-items-center py-2" 
             style="background: linear-gradient(135deg, #FF8C00, #E67A00); color: white;">
          <h6 class="card-title mb-0 text-white fw-bold">${
            event.titulo || "Sin título"
          }</h6>
          <div class="d-flex gap-2 align-items-center">
            <span class="badge ${statusClass} fw-semibold px-2 py-1">${statusText}</span>
            <small class="text-white opacity-75 fw-medium">${timeInfo}</small>
          </div>
        </div>
        
        <!-- Cuerpo compacto -->
        <div class="card-body bg-light p-3">
          <!-- Info principal en una sola fila -->
          <div class="row g-2 mb-2">
            <div class="col-6">
              <div class="d-flex align-items-center text-sm">
                <i class="fas fa-calendar me-2 text-orange"></i>
                <span class="fw-medium text-dark small">${formatEventDate(
                  fechaInicio
                )}</span>
              </div>
            </div>
            <div class="col-6">
              <div class="d-flex align-items-center text-sm">
                <i class="fas fa-clock me-2 text-orange"></i>
                <span class="text-dark small">${
                  event.horaInicio || "No definida"
                } - ${event.horaFin || "No definida"}</span>
              </div>
            </div>
          </div>
          
          <div class="row g-2 mb-3">
            <div class="col-6">
              <div class="d-flex align-items-center text-sm">
                <i class="fas fa-map-marker-alt me-2 text-orange"></i>
                <span class="text-dark small">${
                  event.ubicacion || "No especificada"
                }</span>
              </div>
            </div>
            <div class="col-6">
              <div class="d-flex align-items-center text-sm">
                <i class="fas fa-users me-2 text-orange"></i>
                <span class="text-dark small fw-medium">${
                  event.voluntariosInscritos || 0
                } / ${event.cantidadVoluntariosMax || "∞"}</span>
              </div>
            </div>
          </div>
          
          <!-- Descripción colapsible si existe -->
          ${
            event.descripcion
              ? `
            <div class="mb-3">
              <div class="collapse" id="desc-${event.id}">
                <div class="p-2 rounded" style="background-color: #FFF8F0; border-left: 3px solid #FF8C00;">
                  <small class="text-dark">${event.descripcion}</small>
                </div>
              </div>
            </div>
          `
              : ""
          }
          
          <!-- Acciones compactas -->
          ${createCompactEventActions(event.id, event.foto, event.descripcion)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Crear botones de acciones compactos para eventos futuros
 */
function createCompactEventActions(eventId, foto, descripcion) {
  return `
    <div class="d-flex gap-1 flex-wrap justify-content-between align-items-center">
      <!-- Botones principales -->
      <div class="d-flex gap-1 flex-wrap">
        <button class="btn btn-orange btn-sm px-2 py-1" onclick="editEvent('${eventId}')" title="Editar evento">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-outline-orange btn-sm px-2 py-1" onclick="viewVolunteers('${eventId}')" title="Ver voluntarios">
          <i class="fas fa-users"></i>
        </button>
        ${
          foto
            ? `
          <button class="btn btn-outline-info btn-sm px-2 py-1" onclick="previewEventImage('${foto}', '${eventId}')" title="Ver imagen">
            <i class="fas fa-image"></i>
          </button>
        `
            : ""
        }
        ${
          descripcion
            ? `
          <button class="btn btn-outline-secondary btn-sm px-2 py-1" 
                  data-bs-toggle="collapse" 
                  data-bs-target="#desc-${eventId}" 
                  title="Ver descripción">
            <i class="fas fa-info-circle"></i>
          </button>
        `
            : ""
        }
      </div>
      
      <!-- Botón cancelar -->
      <button class="btn btn-outline-danger btn-sm px-2 py-1" onclick="cancelUpcomingEvent('${eventId}')" title="Cancelar evento">
        <i class="fas fa-ban"></i>
      </button>
    </div>
  `;
}

/**
 * Función para mostrar vista previa de imagen del evento
 */
function previewEventImage(imageUrl, eventId) {
  // Crear modal dinámico para la vista previa
  const modal = document.createElement("div");
  modal.className = "photo-modal";
  modal.innerHTML = `
    <div class="photo-modal-overlay" onclick="closePhotoPreview()">
      <div class="photo-modal-content" onclick="event.stopPropagation()">
        <div class="photo-modal-header">
          <h5 class="photo-modal-title">Vista previa del evento</h5>
          <button class="photo-modal-close" onclick="closePhotoPreview()" aria-label="Cerrar vista previa">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="photo-modal-body">
          <img src="${imageUrl}" alt="Foto del evento" class="photo-preview-img" 
               onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuM2VtIj5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4='">
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // Añadir event listener para cerrar con ESC
  document.addEventListener("keydown", handleEscKey);
}

/**
 * Función para cerrar la vista previa de imagen
 */
function closePhotoPreview() {
  const modal = document.querySelector(".photo-modal");
  if (modal) {
    // Animación de salida
    modal.style.animation = "fadeOut 0.2s ease";

    setTimeout(() => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscKey);
    }, 200);
  }
}

/**
 * Función para manejar la tecla ESC
 */
function handleEscKey(event) {
  if (event.key === "Escape") {
    closePhotoPreview();
  }
}

/**
 * Formatear fecha para mostrar - ACTUALIZADA PARA FECHAS STRING
 */
function formatEventDate(date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return "Hoy";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Mañana";
  } else {
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }
}

// =============================================
// FUNCIONES DE ACCIÓN PARA EVENTOS FUTUROS
// =============================================

/**
 * Cancelar evento futuro
 */
export async function cancelUpcomingEvent(eventId) {
  const confirmed = confirm(
    "¿Estás seguro de que deseas cancelar este evento?\n\nEsta acción cambiará el estado del evento a 'cancelado'."
  );
  if (!confirmed) return;

  try {
    const firebaseDB = getFirebaseDB();
    if (!firebaseDB) {
      throw new Error("Firebase no está inicializado");
    }

    console.log("🚫 Cancelando evento:", eventId);

    const eventRef = doc(firebaseDB, "eventos", eventId);
    await updateDoc(eventRef, {
      estado: "cancelado",
      fechaCancelacion: serverTimestamp(),
      canceladoPor: window.currentUser?.correo || "admin",
    });

    console.log("✅ Evento cancelado exitosamente");

    window.showSuccess
      ? window.showSuccess("Evento cancelado exitosamente")
      : alert("Evento cancelado exitosamente");

    // Recargar eventos después de un breve delay
    setTimeout(() => {
      loadUpcomingEvents();
    }, 500);
  } catch (error) {
    console.error("❌ Error al cancelar evento:", error);
    window.showError
      ? window.showError("Error al cancelar el evento", error)
      : alert("Error al cancelar el evento. Intenta de nuevo.");
  }
}

// Importar la función del modal
import { showEditModal } from "./editModal.js";

/**
 * Editar evento - Actualizada para usar modal
 */
export function editEvent(eventId) {
  console.log("✏️ Editando evento:", eventId);

  // Llamar al modal de edición
  showEditModal(eventId);
}

/**
 * Ver voluntarios de evento
 */
export function viewVolunteers(eventId) {
  console.log("👥 Abriendo modal de voluntarios para evento:", eventId);

  // Verificar que showVolunteersModal esté disponible
  if (typeof showVolunteersModal === "function") {
    showVolunteersModal(eventId);
  } else {
    console.error("❌ showVolunteersModal no está disponible");
    alert("Error al cargar el modal de voluntarios");
  }
}

/**
 * Refrescar eventos futuros
 */
export function refreshUpcomingEvents() {
  console.log("🔄 Refrescando eventos futuros...");
  loadUpcomingEvents();
}

// =============================================
// FUNCIONES DE DEBUG
// =============================================

/**
 * Función de debug para Firebase
 */
window.debugFirebase = function () {
  console.log("🔍 Debug Firebase:");
  console.log("- Firebase DB:", !!window.firebaseDB);
  console.log("- Current User:", window.currentUser);

  if (window.firebaseDB) {
    console.log("- Firebase inicializado correctamente");
    // Intentar una consulta simple
    const eventosRef = collection(window.firebaseDB, "eventos");
    getDocs(eventosRef)
      .then((snapshot) => {
        console.log(`- Total eventos en BD: ${snapshot.size}`);

        // Mostrar algunos ejemplos de fechas
        let count = 0;
        snapshot.forEach((doc) => {
          if (count < 3) {
            const data = doc.data();
            console.log(`- Evento ${count + 1}:`, {
              id: doc.id,
              titulo: data.titulo,
              fechaInicio: data.fechaInicio,
              fechaParsed: parseStringToDate(data.fechaInicio),
              estado: data.estado,
            });
            count++;
          }
        });
      })
      .catch((err) => {
        console.error("- Error al consultar eventos:", err);
      });
  } else {
    console.error("- Firebase NO inicializado");
  }
};

// =============================================
// FUNCIONES GLOBALES PARA USO EN HTML
// =============================================

// Exponer funciones al scope global para uso en HTML
window.editEvent = editEvent;
window.viewVolunteers = viewVolunteers;
window.cancelUpcomingEvent = cancelUpcomingEvent;
window.refreshUpcomingEvents = refreshUpcomingEvents;
window.loadUpcomingEvents = loadUpcomingEvents;
window.previewEventImage = previewEventImage;
window.closePhotoPreview = closePhotoPreview;
window.handleEscKey = handleEscKey;

// =============================================
// INICIALIZACIÓN
// =============================================

/**
 * Inicializar eventos futuros cuando se carga la página
 */
export function initializeUpcomingEvents() {
  console.log("🚀 Inicializando módulo de eventos futuros");
  // Resto del código de inicialización...
  const checkFirebase = () => {
    if (window.firebaseDB) {
      console.log("✅ Firebase disponible, configurando eventos futuros");

      const upcomingTab = document.getElementById("upcoming-tab");
      if (upcomingTab) {
        upcomingTab.addEventListener("shown.bs.tab", function () {
          console.log("📋 Pestaña de eventos futuros activada");
          loadUpcomingEvents();
        });
        console.log("✅ Event listener configurado para upcoming-tab");
      }

      const upcomingPane = document.getElementById("upcoming");
      if (upcomingPane && upcomingPane.classList.contains("active")) {
        console.log(
          "📋 Pestaña de eventos futuros ya activa, cargando eventos"
        );
        setTimeout(loadUpcomingEvents, 100);
      }

      return true;
    }
    return false;
  };

  if (!checkFirebase()) {
    let attempts = 0;
    const maxAttempts = 20;
    const interval = 250;

    const waitForFirebase = setInterval(() => {
      attempts++;
      console.log(
        `🔄 Esperando Firebase... intento ${attempts}/${maxAttempts}`
      );

      if (checkFirebase() || attempts >= maxAttempts) {
        clearInterval(waitForFirebase);
        if (attempts >= maxAttempts) {
          console.error("❌ Firebase no se inicializó después de esperar");
        }
      }
    }, interval);
  }
}

// Auto-inicializar si el DOM ya está listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeUpcomingEvents);
} else {
  // Delay más largo para asegurar que otros scripts se hayan cargado
  setTimeout(initializeUpcomingEvents, 200);
}

// Exportar función de inicialización
window.initializeUpcomingEvents = initializeUpcomingEvents;

console.log(
  "📅 Módulo upcoming-events.js cargado correctamente - VERSION STRING DATES"
);
