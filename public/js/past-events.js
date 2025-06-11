import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =============================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// =============================================

let autoRefreshInterval = null;
const AUTO_REFRESH_MINUTES = 5; // Actualizar cada 5 minutos

// =============================================
// FUNCIONES PARA EVENTOS PASADOS
// =============================================

/**
 * Cargar y mostrar eventos pasados
 */
export async function loadPastEvents() {
  const loadingEl = document.getElementById("pastLoading");
  const eventsContainer = document.getElementById("pastEvents");

  try {
    console.log("🔄 Iniciando carga de eventos pasados...");
    if (loadingEl) loadingEl.style.display = "block";

    // Verificar que Firebase esté disponible
    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Base de datos no disponible");
    }

    const now = new Date();
    console.log("📅 Fecha y hora actual:", now.toLocaleString("es-ES"));

    const eventosRef = collection(db, "eventos");
    const events = [];

    // Hacer consulta general sin filtros de fecha (ya que fechaInicio es string)
    console.log(
      "🔍 Obteniendo todos los eventos para filtrar por fecha string..."
    );
    const querySnapshot = await getDocs(eventosRef);

    querySnapshot.forEach((doc) => {
      const eventData = { id: doc.id, ...doc.data() };
      if (isPastEvent(eventData, now)) {
        events.push(eventData);
      }
    });

    // Ordenar eventos por fecha de inicio (más reciente primero)
    const sortedEvents = events.sort((a, b) => {
      const dateA = parseStringDate(a.fechaInicio) || new Date(0);
      const dateB = parseStringDate(b.fechaInicio) || new Date(0);
      return dateB - dateA; // Más reciente primero
    });

    console.log(
      `✅ Total de eventos pasados encontrados: ${sortedEvents.length}`
    );
    displayPastEvents(sortedEvents);

    // Iniciar auto-refresh si no está activo
    startAutoRefresh();
  } catch (error) {
    console.error("❌ Error al cargar eventos pasados:", error);
    if (eventsContainer) {
      eventsContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
          <div>Error al cargar eventos pasados</div>
          <small class="text-muted">Intenta recargar la página</small>
          <br><small class="text-danger mt-2">${error.message}</small>
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

/**
 * Parsear fecha string a objeto Date
 * Acepta formatos: "YYYY-MM-DD HH:mm", "YYYY-MM-DD", "DD/MM/YYYY HH:mm", etc.
 */
function parseStringDate(dateString) {
  if (!dateString) return null;

  try {
    // Si ya es un objeto Date
    if (dateString instanceof Date) {
      return dateString;
    }

    // Si es un Timestamp de Firebase
    if (dateString && typeof dateString.toDate === "function") {
      return dateString.toDate();
    }

    // Si es string, intentar parsearlo
    if (typeof dateString === "string") {
      // Formato ISO: "2024-12-25T10:30:00"
      if (dateString.includes("T")) {
        return new Date(dateString);
      }

      // Formato: "2024-12-25 10:30"
      if (dateString.includes("-") && dateString.includes(":")) {
        return new Date(dateString.replace(" ", "T"));
      }

      // Formato: "2024-12-25"
      if (dateString.includes("-") && dateString.split("-").length === 3) {
        return new Date(dateString + "T00:00:00");
      }

      // Formato: "25/12/2024 10:30"
      if (dateString.includes("/")) {
        const parts = dateString.split(" ");
        const datePart = parts[0];
        const timePart = parts[1] || "00:00";

        const [day, month, year] = datePart.split("/");
        return new Date(
          `${year}-${month.padStart(2, "0")}-${day.padStart(
            2,
            "0"
          )}T${timePart}`
        );
      }

      // Intentar parse directo
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    console.warn("🚨 No se pudo parsear la fecha:", dateString);
    return null;
  } catch (error) {
    console.warn("🚨 Error al parsear fecha:", dateString, error);
    return null;
  }
}

/**
 * Verificar si un evento es pasado (mejorado para fechas string)
 */
function isPastEvent(event, currentDate) {
  try {
    // Verificar por estado primero
    if (event.estado === "completado" || event.estado === "cancelado") {
      return true;
    }

    // Parsear fecha de inicio
    const fechaInicio = parseStringDate(event.fechaInicio);

    if (!fechaInicio) {
      console.warn(
        "⚠️ Evento sin fecha de inicio válida:",
        event.id,
        event.fechaInicio
      );
      return false;
    }

    // Comparar con fecha actual
    const isPast = fechaInicio < currentDate;

    if (isPast) {
      console.log(`📅 Evento ${event.id} es pasado:`, {
        titulo: event.titulo,
        fechaInicio: fechaInicio.toLocaleString("es-ES"),
        fechaActual: currentDate.toLocaleString("es-ES"),
        diferencia:
          Math.round((currentDate - fechaInicio) / (1000 * 60)) + " minutos",
      });
    }

    return isPast;
  } catch (error) {
    console.warn("⚠️ Error al verificar si evento es pasado:", error, event);
    return false;
  }
}

/**
 * Mostrar eventos pasados en el DOM
 */
function displayPastEvents(events) {
  const eventsContainer = document.getElementById("pastEvents");
  if (!eventsContainer) {
    console.warn("⚠️ Contenedor 'pastEvents' no encontrado");
    return;
  }

  // Mostrar información de última actualización
  const lastUpdate = new Date().toLocaleString("es-ES");

  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-history fa-3x text-muted mb-3"></i>
        <h5>No hay eventos pasados</h5>
        <p class="text-muted">Los eventos completados aparecerán aquí automáticamente</p>
        <small class="text-muted">Última actualización: ${lastUpdate}</small>
        <br>
        <button class="btn btn-outline-primary mt-2" onclick="window.refreshPastEvents()">
          <i class="fas fa-refresh me-1"></i>Actualizar
        </button>
      </div>
    `;
    return;
  }

  let eventsHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h6 class="text-muted mb-0">
        <i class="fas fa-history me-1"></i>
        ${events.length} evento${events.length !== 1 ? "s" : ""} pasado${
    events.length !== 1 ? "s" : ""
  }
      </h6>
      <small class="text-muted">
        <i class="fas fa-clock me-1"></i>
        Actualizado: ${lastUpdate}
      </small>
    </div>
  `;

  events.forEach((event, index) => {
    try {
      const fechaInicio = parseStringDate(event.fechaInicio);
      eventsHTML += createPastEventCard(event, fechaInicio, index);
    } catch (error) {
      console.warn("⚠️ Error al crear tarjeta para evento:", event.id, error);
    }
  });

  // Agregar modal para imágenes
  eventsHTML += createImageModal();

  eventsContainer.innerHTML = eventsHTML;
  console.log(`📋 Mostrados ${events.length} eventos pasados`);
}

/**
 * Crear tarjeta HTML para evento pasado con imagen miniatura mejorada
 */
function createPastEventCard(event, fechaInicio, index = 0) {
  const statusBadge = getEventStatusBadge(event.estado);
  const eventStatus = event.estado || "finalizado";
  const timeAgo = getTimeAgo(fechaInicio);

  return `
    <div class="event-card ${
      eventStatus === "cancelado" ? "event-cancelled" : ""
    }" data-event-id="${event.id}" style="animation-delay: ${index * 0.1}s">
      <div class="event-card-header">
        <div class="d-flex justify-content-between align-items-start">
          <h5 class="event-title">${event.titulo || "Sin título"}</h5>
          ${statusBadge}
        </div>
      </div>
      <div class="event-card-body">
        <div class="row">
          ${
            event.foto
              ? `
            <div class="col-md-4 mb-3">
              <div class="event-image-container">
                <img src="${event.foto}" 
                     alt="${event.titulo}" 
                     class="event-thumbnail" 
                     onclick="openImageModal('${event.foto}', '${event.titulo}')"
                     onerror="this.parentElement.style.display='none'"
                     title="Clic para ampliar imagen">
                <div class="image-overlay">
                  <i class="fas fa-search-plus"></i>
                </div>
              </div>
            </div>
            <div class="col-md-8">
          `
              : '<div class="col-12">'
          }
            <div class="event-meta">
              <div class="event-meta-item">
                <i class="fas fa-calendar text-primary"></i>
                <span><strong>Fecha:</strong> ${formatEventDate(
                  fechaInicio
                )}</span>
              </div>
              <div class="event-meta-item">
                <i class="fas fa-clock text-info"></i>
                <span><strong>Hace:</strong> ${timeAgo}</span>
              </div>
              <div class="event-meta-item">
                <i class="fas fa-map-marker-alt text-danger"></i>
                <span>${event.ubicacion || "Ubicación no especificada"}</span>
              </div>
              <div class="event-meta-item">
                <i class="fas fa-users text-info"></i>
                <span>${event.voluntariosInscritos?.length || 0} voluntarios ${
    eventStatus === "cancelado" ? "estaban registrados" : "participaron"
  }</span>
              </div>
              <div class="event-meta-item">
                <i class="fas fa-user-plus text-success"></i>
                <span><strong>Máximo:</strong> ${
                  event.cantidadVoluntariosMax || "Sin límite"
                }</span>
              </div>
              ${
                event.requisitos
                  ? `
                <div class="event-meta-item">
                  <i class="fas fa-list-check text-warning"></i>
                  <span><strong>Requisitos:</strong> ${event.requisitos}</span>
                </div>
              `
                  : ""
              }
              ${
                eventStatus === "cancelado" && event.fechaCancelacion
                  ? `
                <div class="event-meta-item text-danger">
                  <i class="fas fa-times-circle"></i>
                  <span><strong>Cancelado:</strong> ${formatEventDate(
                    parseStringDate(event.fechaCancelacion)
                  )}</span>
                </div>
              `
                  : ""
              }
            </div>
            <p class="event-description">
              ${event.descripcion || "Sin descripción disponible"}
            </p>
            ${createPastEventActions(event)}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Crear modal para mostrar imágenes ampliadas
 */
function createImageModal() {
  return `
    <div class="modal fade" id="imageModal" tabindex="-1" aria-labelledby="imageModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="imageModalLabel">Imagen del Evento</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body text-center">
            <img id="modalImage" src="" alt="" class="img-fluid rounded" style="max-width: 100%; height: auto;">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            <button type="button" class="btn btn-primary" onclick="downloadImage()">
              <i class="fas fa-download me-1"></i>Descargar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Abrir modal con imagen ampliada
 */
function openImageModal(imageSrc, eventTitle) {
  console.log("🖼️ Abriendo modal para imagen:", imageSrc);

  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  const modalTitle = document.getElementById("imageModalLabel");

  if (modal && modalImage && modalTitle) {
    modalImage.src = imageSrc;
    modalImage.alt = eventTitle;
    modalTitle.textContent = eventTitle;

    // Guardar la URL de la imagen para descarga
    modal.setAttribute("data-image-src", imageSrc);
    modal.setAttribute("data-image-title", eventTitle);

    // Verificar si Bootstrap está disponible
    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    } else {
      // Fallback manual si Bootstrap no está disponible
      modal.style.display = "block";
      modal.classList.add("show");
      document.body.style.overflow = "hidden";

      // Cerrar modal al hacer clic fuera
      modal.addEventListener("click", function (e) {
        if (e.target === modal) {
          closeImageModal();
        }
      });
    }
  } else {
    console.error("❌ Elementos del modal no encontrados");
    console.log("Modal:", modal);
    console.log("Modal Image:", modalImage);
    console.log("Modal Title:", modalTitle);
  }
}

/**
 * Descargar imagen desde el modal
 */
function downloadImage() {
  const modalImage = document.getElementById("modalImage");
  if (modalImage && modalImage.src) {
    const link = document.createElement("a");
    link.href = modalImage.src;
    link.download = `evento_${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Obtener badge de estado del evento
 */
function getEventStatusBadge(estado) {
  switch (estado) {
    case "completado":
      return '<span class="status-badge status-completed"><i class="fas fa-check-circle me-1"></i>Completado</span>';
    case "cancelado":
      return '<span class="status-badge status-cancelled"><i class="fas fa-times-circle me-1"></i>Cancelado</span>';
    case "en_progreso":
      return '<span class="status-badge status-progress"><i class="fas fa-clock me-1"></i>En Progreso</span>';
    default:
      return '<span class="status-badge status-past"><i class="fas fa-history me-1"></i>Finalizado</span>';
  }
}

/**
 * Calcular tiempo transcurrido desde la fecha del evento
 */
function getTimeAgo(date) {
  if (!date) return "Fecha no disponible";

  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 60) {
    return `${diffMinutes} minuto${diffMinutes !== 1 ? "s" : ""}`;
  } else if (diffHours < 24) {
    return `${diffHours} hora${diffHours !== 1 ? "s" : ""}`;
  } else if (diffDays < 7) {
    return `${diffDays} día${diffDays !== 1 ? "s" : ""}`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} semana${diffWeeks !== 1 ? "s" : ""}`;
  } else {
    return `${diffMonths} mes${diffMonths !== 1 ? "es" : ""}`;
  }
}

/**
 * Crear botones de acciones para eventos pasados
 */
function createPastEventActions(event) {
  const baseActions = `
    <button class="btn btn-outline-info btn-sm" onclick="viewEventDetails('${event.id}')">
      <i class="fas fa-info-circle me-1"></i>Detalles
    </button>
    <button class="btn btn-outline-secondary btn-sm" onclick="viewEventPhotos('${event.id}')">
      <i class="fas fa-camera me-1"></i>Fotos
    </button>
  `;

  if (event.estado === "cancelado") {
    return `
      <div class="event-actions">
        ${baseActions}
        <button class="btn btn-outline-warning btn-sm" onclick="viewCancellationDetails('${event.id}')">
          <i class="fas fa-exclamation-triangle me-1"></i>Cancelación
        </button>
      </div>
    `;
  }

  return `
    <div class="event-actions">
      ${baseActions}
      <button class="btn btn-outline-success btn-sm" onclick="viewEventReport('${event.id}')">
        <i class="fas fa-chart-bar me-1"></i>Reporte
      </button>
      <button class="btn btn-outline-primary btn-sm" onclick="viewVolunteersList('${event.id}')">
        <i class="fas fa-users me-1"></i>Voluntarios
      </button>
    </div>
  `;
}

/**
 * Formatear fecha para mostrar
 */
function formatEventDate(date) {
  if (!date) return "Fecha no disponible";

  try {
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return date.toString();
  }
}

// =============================================
// FUNCIONES DE AUTO-ACTUALIZACIÓN
// =============================================

/**
 * Iniciar actualización automática
 */
function startAutoRefresh() {
  // Limpiar intervalo existente
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  // Configurar nuevo intervalo
  autoRefreshInterval = setInterval(() => {
    console.log("🔄 Auto-actualizando eventos pasados...");
    const pastPane = document.getElementById("past");

    // Solo actualizar si la pestaña de eventos pasados está activa
    if (pastPane && pastPane.classList.contains("active")) {
      loadPastEvents();
    }
  }, AUTO_REFRESH_MINUTES * 60 * 1000);

  console.log(
    `⏰ Auto-refresh configurado cada ${AUTO_REFRESH_MINUTES} minutos`
  );
}

/**
 * Detener actualización automática
 */
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    console.log("⏹️ Auto-refresh detenido");
  }
}

// =============================================
// FUNCIONES DE ACCIÓN PARA EVENTOS PASADOS
// =============================================

/**
 * Ver detalles completos del evento
 */
export function viewEventDetails(eventId) {
  console.log(`📋 Mostrando detalles del evento: ${eventId}`);
  // TODO: Implementar modal con detalles completos
  alert(`Ver detalles completos del evento: ${eventId}`);
}

/**
 * Ver reporte del evento
 */
export function viewEventReport(eventId) {
  console.log(`📊 Solicitando reporte para evento: ${eventId}`);
  // TODO: Implementar vista de reporte detallado
  alert(`Generando reporte del evento: ${eventId}`);
}

/**
 * Ver fotos del evento
 */
export function viewEventPhotos(eventId) {
  console.log(`📷 Solicitando fotos para evento: ${eventId}`);
  // TODO: Implementar galería de fotos
  alert(`Abriendo galería de fotos del evento: ${eventId}`);
}

/**
 * Ver lista de voluntarios del evento
 */
export function viewVolunteersList(eventId) {
  console.log(`👥 Solicitando lista de voluntarios para evento: ${eventId}`);
  // TODO: Implementar vista de voluntarios
  alert(`Cargando lista de voluntarios del evento: ${eventId}`);
}

/**
 * Ver detalles de cancelación
 */
export function viewCancellationDetails(eventId) {
  console.log(`❌ Solicitando detalles de cancelación para evento: ${eventId}`);
  // TODO: Implementar vista de detalles de cancelación
  alert(`Mostrando motivos de cancelación del evento: ${eventId}`);
}

/**
 * Refrescar eventos pasados manualmente
 */
export function refreshPastEvents() {
  console.log("🔄 Refrescando eventos pasados manualmente...");
  loadPastEvents();
}

// =============================================
// FUNCIONES GLOBALES PARA USO EN HTML
// =============================================

// Exponer funciones al scope global para uso en HTML
window.viewEventDetails = viewEventDetails;
window.viewEventReport = viewEventReport;
window.viewEventPhotos = viewEventPhotos;
window.viewVolunteersList = viewVolunteersList;
window.viewCancellationDetails = viewCancellationDetails;
window.refreshPastEvents = refreshPastEvents;
window.openImageModal = openImageModal;
window.downloadImage = downloadImage;

// =============================================
// INICIALIZACIÓN
// =============================================

/**
 * Inicializar eventos pasados cuando se carga la página
 */
export function initializePastEvents() {
  console.log("🚀 Inicializando módulo de eventos pasados mejorado");

  // Verificar dependencias
  if (!window.firebaseDB) {
    console.warn("⚠️ Firebase DB no disponible, reintentando en 1 segundo...");
    setTimeout(initializePastEvents, 1000);
    return;
  }

  // Configurar event listener para la pestaña de eventos pasados
  const pastTab = document.getElementById("past-tab");
  if (pastTab) {
    pastTab.addEventListener("shown.bs.tab", function () {
      console.log("📋 Pestaña de eventos pasados activada");
      loadPastEvents();
    });

    // Event listener para cuando se oculta la pestaña (optimización)
    pastTab.addEventListener("hidden.bs.tab", function () {
      console.log("📋 Pestaña de eventos pasados desactivada");
      // No detener auto-refresh para mantener datos actualizados
    });

    console.log("✅ Event listeners configurados para pestaña past-tab");
  } else {
    console.warn("⚠️ Elemento 'past-tab' no encontrado");
  }

  // Cargar eventos iniciales si la pestaña está activa
  const pastPane = document.getElementById("past");
  if (pastPane && pastPane.classList.contains("active")) {
    console.log("📋 Panel de eventos pasados está activo, cargando eventos...");
    loadPastEvents();
  }

  // Limpiar intervalos cuando se cierra la página
  window.addEventListener("beforeunload", () => {
    stopAutoRefresh();
  });

  console.log(
    "✅ Módulo de eventos pasados inicializado correctamente con auto-refresh"
  );
}

// Auto-inicializar si el DOM ya está listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePastEvents);
} else {
  initializePastEvents();
}

// Exportar funciones principales
window.initializePastEvents = initializePastEvents;
window.loadPastEvents = loadPastEvents;
window.stopAutoRefresh = stopAutoRefresh;
window.startAutoRefresh = startAutoRefresh;

console.log(
  "📋 Módulo past-events.js cargado y mejorado con sistema de miniaturas"
);
