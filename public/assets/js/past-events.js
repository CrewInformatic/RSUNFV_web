import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
    console.log("📅 Fecha actual:", now);

    const eventosRef = collection(db, "eventos");

    // MÉTODO 1: Buscar por fechaFin (eventos que tienen fecha de finalización)
    let queryWithEndDate = null;
    try {
      queryWithEndDate = query(
        eventosRef,
        where("fechaFin", "<", Timestamp.fromDate(now)),
        orderBy("fechaFin", "desc")
      );
    } catch (indexError) {
      console.warn("⚠️ Índice para fechaFin no disponible:", indexError);
    }

    // MÉTODO 2: Buscar por fechaInicio (eventos que ya pasaron su fecha de inicio)
    let queryWithStartDate = null;
    try {
      queryWithStartDate = query(
        eventosRef,
        where("fechaInicio", "<", Timestamp.fromDate(now)),
        orderBy("fechaInicio", "desc")
      );
    } catch (indexError) {
      console.warn("⚠️ Índice para fechaInicio no disponible:", indexError);
    }

    const events = [];
    const eventIds = new Set(); // Para evitar duplicados

    // Ejecutar consultas disponibles
    try {
      if (queryWithEndDate) {
        console.log("🔍 Buscando eventos por fechaFin...");
        const snapshot1 = await getDocs(queryWithEndDate);
        snapshot1.forEach((doc) => {
          const eventData = { id: doc.id, ...doc.data() };
          if (!eventIds.has(doc.id) && isPastEvent(eventData, now)) {
            events.push(eventData);
            eventIds.add(doc.id);
          }
        });
        console.log(`📊 Encontrados ${snapshot1.size} eventos con fechaFin`);
      }
    } catch (error) {
      console.warn("⚠️ Error en consulta por fechaFin:", error);
    }

    try {
      if (queryWithStartDate) {
        console.log("🔍 Buscando eventos por fechaInicio...");
        const snapshot2 = await getDocs(queryWithStartDate);
        snapshot2.forEach((doc) => {
          const eventData = { id: doc.id, ...doc.data() };
          if (!eventIds.has(doc.id) && isPastEvent(eventData, now)) {
            events.push(eventData);
            eventIds.add(doc.id);
          }
        });
        console.log(`📊 Encontrados ${snapshot2.size} eventos con fechaInicio`);
      }
    } catch (error) {
      console.warn("⚠️ Error en consulta por fechaInicio:", error);
    }

    // Si las consultas con índices fallan, hacer consulta general
    if (events.length === 0) {
      console.log("🔍 Haciendo consulta general de eventos...");
      try {
        const generalQuery = query(eventosRef, orderBy("fechaInicio", "desc"));
        const generalSnapshot = await getDocs(generalQuery);

        generalSnapshot.forEach((doc) => {
          const eventData = { id: doc.id, ...doc.data() };
          if (isPastEvent(eventData, now)) {
            events.push(eventData);
          }
        });
        console.log(
          `📊 Encontrados ${events.length} eventos pasados en consulta general`
        );
      } catch (error) {
        console.warn("⚠️ Error en consulta general:", error);
        // Última opción: consulta sin orderBy
        const basicQuery = query(eventosRef);
        const basicSnapshot = await getDocs(basicQuery);

        basicSnapshot.forEach((doc) => {
          const eventData = { id: doc.id, ...doc.data() };
          if (isPastEvent(eventData, now)) {
            events.push(eventData);
          }
        });

        // Ordenar manualmente
        events.sort((a, b) => {
          const dateA = (a.fechaFin || a.fechaInicio)?.toDate() || new Date(0);
          const dateB = (b.fechaFin || b.fechaInicio)?.toDate() || new Date(0);
          return dateB - dateA; // Más reciente primero
        });
      }
    }

    // Filtrar y ordenar eventos finales
    const finalEvents = events
      .filter(
        (event) =>
          event.estado === "completado" ||
          event.estado === "cancelado" ||
          isPastEvent(event, now)
      )
      .sort((a, b) => {
        const dateA = (a.fechaFin || a.fechaInicio)?.toDate() || new Date(0);
        const dateB = (b.fechaFin || b.fechaInicio)?.toDate() || new Date(0);
        return dateB - dateA;
      });

    console.log(
      `✅ Total de eventos pasados procesados: ${finalEvents.length}`
    );
    displayPastEvents(finalEvents);
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
 * Verificar si un evento es pasado
 */
function isPastEvent(event, currentDate) {
  try {
    // Si tiene fecha de finalización y ya pasó
    if (event.fechaFin) {
      const fechaFin = event.fechaFin.toDate();
      if (fechaFin < currentDate) {
        return true;
      }
    }

    // Si tiene fecha de inicio y ya pasó (considerando eventos de un día)
    if (event.fechaInicio) {
      const fechaInicio = event.fechaInicio.toDate();

      // Si no tiene fecha de fin, considerar que el evento dura un día
      if (!event.fechaFin) {
        const endOfEventDay = new Date(fechaInicio);
        endOfEventDay.setHours(23, 59, 59, 999); // Fin del día del evento
        return endOfEventDay < currentDate;
      }

      // Si tiene fecha de fin pero la fecha de inicio ya pasó hace más de un día
      const dayAfterStart = new Date(fechaInicio);
      dayAfterStart.setDate(dayAfterStart.getDate() + 1);
      return dayAfterStart < currentDate;
    }

    // Si el estado indica que el evento terminó
    return event.estado === "completado" || event.estado === "cancelado";
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

  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-history fa-3x text-muted mb-3"></i>
        <h5>No hay eventos pasados</h5>
        <p class="text-muted">Los eventos completados aparecerán aquí</p>
        <button class="btn btn-outline-primary mt-2" onclick="window.refreshPastEvents()">
          <i class="fas fa-refresh me-1"></i>Recargar
        </button>
      </div>
    `;
    return;
  }

  let eventsHTML = "";
  events.forEach((event, index) => {
    try {
      const fechaInicio = event.fechaInicio?.toDate() || new Date();
      const fechaFin = event.fechaFin?.toDate() || null;
      eventsHTML += createPastEventCard(event, fechaInicio, fechaFin, index);
    } catch (error) {
      console.warn("⚠️ Error al crear tarjeta para evento:", event.id, error);
    }
  });

  eventsContainer.innerHTML = eventsHTML;
  console.log(`📋 Mostrados ${events.length} eventos pasados`);
}

/**
 * Crear tarjeta HTML para evento pasado
 */
function createPastEventCard(event, fechaInicio, fechaFin, index = 0) {
  const statusBadge = getEventStatusBadge(event.estado);
  const eventStatus = event.estado || "completado";

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
        ${
          event.foto
            ? `
          <div class="event-image mb-3">
            <img src="${event.foto}" alt="${event.titulo}" 
                 class="img-fluid rounded" 
                 style="max-height: 200px; width: 100%; object-fit: cover;"
                 onerror="this.style.display='none'">
          </div>
        `
            : ""
        }
        <div class="event-meta">
          <div class="event-meta-item">
            <i class="fas fa-calendar text-primary"></i>
            <span><strong>Inicio:</strong> ${formatEventDate(
              fechaInicio
            )}</span>
          </div>
          ${
            fechaFin
              ? `
            <div class="event-meta-item">
              <i class="fas fa-calendar-check text-success"></i>
              <span><strong>Terminó:</strong> ${formatEventDate(
                fechaFin
              )}</span>
            </div>
          `
              : `
            <div class="event-meta-item">
              <i class="fas fa-info-circle text-info"></i>
              <span><em>Evento de un día</em></span>
            </div>
          `
          }
          <div class="event-meta-item">
            <i class="fas fa-map-marker-alt text-danger"></i>
            <span>${event.ubicacion || "Ubicación no especificada"}</span>
          </div>
          <div class="event-meta-item">
            <i class="fas fa-users text-info"></i>
            <span>${event.voluntariosRegistrados || 0} voluntarios ${
    eventStatus === "cancelado" ? "estaban registrados" : "participaron"
  }</span>
          </div>
          ${
            event.resultados
              ? `
            <div class="event-meta-item">
              <i class="fas fa-check-circle text-success"></i>
              <span><strong>Resultados:</strong> ${event.resultados}</span>
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
                event.fechaCancelacion.toDate()
              )}</span>
            </div>
          `
              : ""
          }
          ${
            event.motivoCancelacion && eventStatus === "cancelado"
              ? `
            <div class="event-meta-item text-warning">
              <i class="fas fa-exclamation-triangle"></i>
              <span><strong>Motivo:</strong> ${event.motivoCancelacion}</span>
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
  `;
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
      <button class="btn btn-outline-primary btn-sm" onclick="viewEventFeedback('${event.id}')">
        <i class="fas fa-comments me-1"></i>Comentarios
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
 * Ver comentarios y feedback del evento
 */
export function viewEventFeedback(eventId) {
  console.log(`💬 Solicitando feedback para evento: ${eventId}`);
  // TODO: Implementar vista de feedback
  alert(`Cargando comentarios del evento: ${eventId}`);
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
 * Refrescar eventos pasados
 */
export function refreshPastEvents() {
  console.log("🔄 Refrescando eventos pasados...");
  loadPastEvents();
}

/**
 * Obtener estadísticas de eventos pasados
 */
export async function getPastEventsStats() {
  try {
    console.log("📊 Calculando estadísticas de eventos pasados...");
    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Base de datos no disponible");
    }

    const now = new Date();
    const eventosRef = collection(db, "eventos");

    // Consulta general para obtener todos los eventos
    const querySnapshot = await getDocs(eventosRef);
    const stats = {
      total: 0,
      completados: 0,
      cancelados: 0,
      totalVoluntarios: 0,
    };

    querySnapshot.forEach((doc) => {
      const event = doc.data();

      // Solo contar eventos pasados
      if (isPastEvent(event, now)) {
        stats.total++;

        if (event.estado === "completado") {
          stats.completados++;
          stats.totalVoluntarios += event.voluntariosRegistrados || 0;
        } else if (event.estado === "cancelado") {
          stats.cancelados++;
        } else {
          // Eventos sin estado específico pero que ya pasaron
          stats.completados++;
          stats.totalVoluntarios += event.voluntariosRegistrados || 0;
        }
      }
    });

    console.log("📊 Estadísticas calculadas:", stats);
    return stats;
  } catch (error) {
    console.error("❌ Error al obtener estadísticas:", error);
    return null;
  }
}

// =============================================
// FUNCIONES GLOBALES PARA USO EN HTML
// =============================================

// Exponer funciones al scope global para uso en HTML
window.viewEventDetails = viewEventDetails;
window.viewEventReport = viewEventReport;
window.viewEventPhotos = viewEventPhotos;
window.viewEventFeedback = viewEventFeedback;
window.viewCancellationDetails = viewCancellationDetails;
window.refreshPastEvents = refreshPastEvents;

// =============================================
// INICIALIZACIÓN
// =============================================

/**
 * Inicializar eventos pasados cuando se carga la página
 */
export function initializePastEvents() {
  console.log("🚀 Inicializando módulo de eventos pasados");

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
    console.log("✅ Event listener configurado para pestaña past-tab");
  } else {
    console.warn("⚠️ Elemento 'past-tab' no encontrado");
  }

  // Cargar eventos iniciales si la pestaña está activa
  const pastPane = document.getElementById("past");
  if (pastPane && pastPane.classList.contains("active")) {
    console.log("📋 Panel de eventos pasados está activo, cargando eventos...");
    loadPastEvents();
  }

  console.log("✅ Módulo de eventos pasados inicializado correctamente");
}

// Auto-inicializar si el DOM ya está listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePastEvents);
} else {
  initializePastEvents();
}

// Exportar funciones principales para el coordinador
window.initializePastEvents = initializePastEvents;
window.loadPastEvents = loadPastEvents;

console.log("📋 Módulo past-events.js cargado y mejorado");
