// =============================================
// USUARIOS-EVENTS.JS - Gestión de Voluntarios (MEJORADO)
// =============================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =============================================
// VARIABLES GLOBALES
// =============================================
let db = null;
let currentEventId = null;
let currentVolunteersList = [];
let currentEventData = null;

// Función para obtener la instancia de Firebase
function getFirebaseDB() {
  if (!db) {
    db = window.firebaseDB;
  }
  return db;
}

// =============================================
// FUNCIONES PRINCIPALES DEL MODAL
// =============================================

/**
 * Mostrar modal con voluntarios del evento
 * @param {string} eventId - ID del evento
 */
async function showVolunteersModal(eventId) {
  console.log("👥 Mostrando modal de voluntarios para evento:", eventId);

  if (!eventId) {
    console.error("❌ ID de evento no válido");
    return;
  }

  try {
    // Mostrar el modal
    const modal = new bootstrap.Modal(
      document.getElementById("voluntariosModal")
    );
    modal.show();

    // Cargar datos del evento y voluntarios
    await loadEventVolunteers(eventId);
  } catch (error) {
    console.error("❌ Error al mostrar modal de voluntarios:", error);
    window.showError
      ? window.showError("Error al cargar voluntarios", error)
      : alert("Error al cargar los voluntarios del evento");
  }
}

/**
 * Cargar evento y sus voluntarios
 * @param {string} eventId - ID del evento
 */
async function loadEventVolunteers(eventId) {
  const firebaseDB = getFirebaseDB();
  if (!firebaseDB) {
    throw new Error("Firebase no está inicializado");
  }

  // Mostrar loading
  showVolunteersLoading(true);
  hideVolunteersStates();

  try {
    // 1. Cargar datos del evento
    console.log("📋 Cargando datos del evento...");
    const eventDoc = await getDoc(doc(firebaseDB, "eventos", eventId));

    if (!eventDoc.exists()) {
      throw new Error("Evento no encontrado");
    }

    currentEventData = { id: eventDoc.id, ...eventDoc.data() };
    currentEventId = eventId;

    console.log("✅ Evento cargado:", currentEventData);

    // 2. Actualizar información del evento en el modal
    updateEventInfoInModal(currentEventData);

    // 3. Cargar voluntarios
    console.log("👥 Cargando voluntarios...");
    const voluntariosInscritos = currentEventData.voluntariosInscritos || [];
    console.log("📝 IDs de voluntarios:", voluntariosInscritos);

    if (voluntariosInscritos.length === 0) {
      showNoVolunteersState();
      return;
    }

    // 4. Obtener información completa de cada voluntario
    const voluntariosData = await loadVolunteersData(voluntariosInscritos);
    currentVolunteersList = voluntariosData;

    console.log("✅ Voluntarios cargados:", voluntariosData.length);
    displayVolunteers(voluntariosData);
  } catch (error) {
    console.error("❌ Error al cargar evento y voluntarios:", error);
    showErrorState();

    // Mostrar título de error
    const modalTitle = document.getElementById("voluntariosModalTitle");
    if (modalTitle) {
      modalTitle.textContent = "Error al cargar evento";
    }
  }
}

/**
 * Cargar datos de múltiples voluntarios
 * @param {Array} volunteerIds - Array de IDs de voluntarios
 * @returns {Array} Array de datos de voluntarios
 */
async function loadVolunteersData(volunteerIds) {
  const firebaseDB = getFirebaseDB();
  const voluntariosData = [];

  console.log(`🔄 Cargando datos de ${volunteerIds.length} voluntarios...`);

  // Procesar voluntarios en lotes para evitar muchas consultas simultáneas
  const batchSize = 5;
  for (let i = 0; i < volunteerIds.length; i += batchSize) {
    const batch = volunteerIds.slice(i, i + batchSize);

    const batchPromises = batch.map(async (volunteerId) => {
      try {
        const volunteerDoc = await getDoc(
          doc(firebaseDB, "usuarios", volunteerId)
        );

        if (volunteerDoc.exists()) {
          const volunteerData = { id: volunteerDoc.id, ...volunteerDoc.data() };
          console.log(
            `✅ Voluntario cargado: ${
              volunteerData.nombreUsuario || volunteerData.correo
            }`
          );
          return volunteerData;
        } else {
          console.warn(`⚠️ Voluntario no encontrado: ${volunteerId}`);
          return {
            id: volunteerId,
            nombreUsuario: "Usuario eliminado",
            correo: "No disponible",
            celular: "N/A",
            estado: "inactivo",
            eliminado: true,
          };
        }
      } catch (error) {
        console.error(`❌ Error al cargar voluntario ${volunteerId}:`, error);
        return {
          id: volunteerId,
          nombreUsuario: "Error al cargar",
          correo: "Error",
          celular: "N/A",
          estado: "error",
          error: true,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    voluntariosData.push(...batchResults);
  }

  // Filtrar voluntarios válidos y ordenar por nombre
  const voluntariosValidos = voluntariosData
    .filter((volunteer) => volunteer !== null)
    .sort((a, b) => {
      const nameA = (a.nombreUsuario || a.nombre || "").toLowerCase();
      const nameB = (b.nombreUsuario || b.nombre || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

  console.log(`✅ Cargados ${voluntariosValidos.length} voluntarios`);
  return voluntariosValidos;
}

/**
 * Actualizar información del evento en el modal
 * @param {Object} eventData - Datos del evento
 */
function updateEventInfoInModal(eventData) {
  console.log("🔄 Actualizando información del evento en modal:", eventData);

  // Actualizar título del modal principal
  const modalTitle = document.getElementById("voluntariosModalTitle");
  if (modalTitle) {
    modalTitle.textContent = `Voluntarios: ${
      eventData.titulo || eventData.nombre || "Evento sin título"
    }`;
  }

  // Actualizar label del modal
  const modalLabelEl = document.getElementById("voluntariosModalLabel");
  if (modalLabelEl) {
    modalLabelEl.innerHTML = `
      <i class="fas fa-users me-2"></i>
      Voluntarios: ${eventData.titulo || eventData.nombre || "Sin título"}
    `;
  }

  // Actualizar información del evento en el área específica
  updateEventDetailsSection(eventData);

  console.log("✅ Información del evento actualizada en modal");
}

/**
 * Actualizar sección de detalles del evento
 * @param {Object} eventData - Datos del evento
 */
function updateEventDetailsSection(eventData) {
  // Título del evento
  const eventTitleEl = document.getElementById("eventTitleModal");
  if (eventTitleEl) {
    eventTitleEl.textContent =
      eventData.titulo || eventData.nombre || "Sin título";
  }

  // Fecha del evento
  const eventDateEl = document.getElementById("eventDateModal");
  if (eventDateEl) {
    eventDateEl.textContent = formatEventDate(eventData.fechaInicio);
  }

  // Hora del evento
  const eventTimeEl = document.getElementById("eventTimeModal");
  if (eventTimeEl) {
    const horaInicio = eventData.horaInicio || "No definida";
    const horaFin = eventData.horaFin || "No definida";
    eventTimeEl.textContent = `${horaInicio} - ${horaFin}`;
  }

  // Ubicación del evento
  const eventLocationEl = document.getElementById("eventLocationModal");
  if (eventLocationEl) {
    eventLocationEl.textContent = eventData.ubicacion || "No especificada";
  }

  // Información completa del evento usando el HTML mejorado
  const eventInfo = document.getElementById("eventInfo");
  if (eventInfo) {
    eventInfo.innerHTML = createEventInfoHTML(eventData);
  }

  // Actualizar contadores de voluntarios
  updateVolunteersCount(eventData.voluntariosInscritos?.length || 0);
}

/**
 * Crear HTML con información completa del evento
 * @param {Object} eventData - Datos del evento
 * @returns {string} HTML con información del evento
 */
function createEventInfoHTML(eventData) {
  // Formatear fechas si están en formato timestamp
  const formatearFecha = (fecha) => {
    if (!fecha) return "No especificada";

    try {
      // Si es un timestamp de Firebase
      if (fecha.seconds) {
        return new Date(fecha.seconds * 1000).toLocaleDateString("es-ES", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      // Si es una fecha normal
      if (fecha instanceof Date) {
        return fecha.toLocaleDateString("es-ES", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      // Si es un string
      return fecha.toString();
    } catch (error) {
      console.warn("⚠️ Error al formatear fecha:", fecha);
      return "No especificada";
    }
  };

  return `
    <div class="event-info-card p-3 rounded border" style="background: linear-gradient(135deg, #FFF8F0, #FFF0E6);">
      <div class="row g-3">
        <div class="col-md-6">
          <div class="d-flex align-items-center">
            <i class="fas fa-calendar text-orange me-2"></i>
            <div>
              <small class="text-muted d-block">Fecha de Inicio</small>
              <span class="fw-medium">${formatearFecha(
                eventData.fechaInicio
              )}</span>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="d-flex align-items-center">
            <i class="fas fa-calendar-check text-orange me-2"></i>
            <div>
              <small class="text-muted d-block">Fecha de Fin</small>
              <span class="fw-medium">${formatearFecha(
                eventData.fechaFin
              )}</span>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="d-flex align-items-center">
            <i class="fas fa-clock text-orange me-2"></i>
            <div>
              <small class="text-muted d-block">Horario</small>
              <span class="fw-medium">${
                eventData.horaInicio || "No definido"
              } - ${eventData.horaFin || "No definido"}</span>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="d-flex align-items-center">
            <i class="fas fa-users text-orange me-2"></i>
            <div>
              <small class="text-muted d-block">Voluntarios</small>
              <span class="fw-medium">${
                eventData.voluntariosRegistrados ||
                eventData.voluntariosInscritos?.length ||
                0
              } / ${eventData.cantidadVoluntariosMax || "Sin límite"}</span>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="d-flex align-items-center">
            <i class="fas fa-map-marker-alt text-orange me-2"></i>
            <div>
              <small class="text-muted d-block">Ubicación</small>
              <span class="fw-medium">${
                eventData.ubicacion || "No especificada"
              }</span>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="d-flex align-items-center">
            <i class="fas fa-info-circle text-orange me-2"></i>
            <div>
              <small class="text-muted d-block">Estado</small>
              <span class="fw-medium">${eventData.estado || "Activo"}</span>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="d-flex align-items-start">
            <i class="fas fa-align-left text-orange me-2 mt-1"></i>
            <div>
              <small class="text-muted d-block">Descripción</small>
              <span class="fw-medium">${
                eventData.descripcion || "Sin descripción disponible"
              }</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Mostrar lista de voluntarios
 * @param {Array} volunteers - Array de voluntarios
 */
function displayVolunteers(volunteers) {
  const listEl = document.getElementById("voluntariosList");

  if (!listEl) {
    console.error("❌ Elemento voluntariosList no encontrado");
    return;
  }

  // Ocultar loading y otros estados
  showVolunteersLoading(false);
  hideVolunteersStates();

  // Mostrar lista
  listEl.style.display = "block";

  // Generar HTML de voluntarios
  let volunteersHTML = "";
  volunteers.forEach((volunteer, index) => {
    volunteersHTML += createVolunteerCard(volunteer, index);
  });

  listEl.innerHTML = volunteersHTML;

  // Actualizar contador
  updateVolunteersCount(volunteers.length);

  console.log(`✅ Mostrados ${volunteers.length} voluntarios en el DOM`);
}

/**
 * Crear tarjeta HTML para un voluntario (VERSION MEJORADA)
 * @param {Object} volunteer - Datos del voluntario
 * @param {number} index - Índice del voluntario
 * @returns {string} HTML de la tarjeta
 */
function createVolunteerCard(volunteer, index) {
  const nombre = volunteer.nombreUsuario || volunteer.nombre || "Sin nombre";
  const correo = volunteer.correo || "Sin correo";
  const celular = volunteer.celular || volunteer.telefono || "No especificado";
  const fotoPerfil = volunteer.fotoPerfil || volunteer.foto || "";
  const polera =
    volunteer.poloTallaID || volunteer.tallaPolo || "No especificada";
  const estado = volunteer.estado || "activo";

  // Determinar estado y color
  const isActive =
    estado === "activo" && !volunteer.eliminado && !volunteer.error;
  const statusClass = isActive ? "status-activo" : "status-inactivo";
  const statusText = volunteer.eliminado
    ? "Eliminado"
    : volunteer.error
    ? "Error"
    : estado === "activo"
    ? "Activo"
    : "Inactivo";

  return `
    <div class="volunteer-card mb-3 animate__animated animate__fadeIn" style="animation-delay: ${
      index * 0.1
    }s;" data-volunteer-id="${volunteer.id}">
      <div class="card border-0 shadow-sm">
        <div class="card-body p-3">
          <div class="row align-items-center">
            <!-- Avatar y nombre -->
            <div class="col-md-4">
              <div class="d-flex align-items-center">
                ${
                  fotoPerfil
                    ? `<div class="me-3">
                         <img src="${fotoPerfil}" alt="Foto de ${nombre}" class="rounded-circle" width="50" height="50" style="object-fit: cover;">
                       </div>`
                    : `<div class="me-3">
                         <div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 50px; height: 50px; font-size: 1.2rem; display: none;">
                           Sin foto
                         </div>
                       </div>`
                }
                <div>
                  <h6 class="mb-0 fw-bold text-dark">${nombre}</h6>
                  <small class="text-muted">Voluntario #${index + 1}</small>
                  <div class="mt-1">
                    <span class="volunteer-status badge ${statusClass}">${statusText}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Información de contacto -->
            <div class="col-md-4">
              <div class="volunteer-info">
                <div class="d-flex align-items-center mb-2">
                  <i class="fas fa-envelope text-orange me-2 small"></i>
                  <small class="text-dark">${correo}</small>
                </div>
                <div class="d-flex align-items-center mb-2">
                  <i class="fas fa-phone text-orange me-2 small"></i>
                  <small class="text-dark">${celular}</small>
                </div>
                <div class="d-flex align-items-center">
                  <i class="fas fa-tshirt text-orange me-2 small"></i>
                  <small class="text-dark">Talla: ${polera}</small>
                </div>
              </div>
            </div>
            
            <!-- Información adicional y acciones -->
            <div class="col-md-4">
              <div class="d-flex flex-column align-items-end gap-2">
                ${
                  isActive
                    ? `
                  <div class="volunteer-actions">
                    ${
                      celular && celular !== "No especificado"
                        ? `
                      <button class="btn btn-outline-success btn-sm me-1" 
                              onclick="contactVolunteer('${volunteer.id}', 'phone')"
                              title="Llamar">
                        <i class="fas fa-phone"></i>
                      </button>
                    `
                        : ""
                    }
                    <button class="btn btn-outline-primary btn-sm" 
                            onclick="contactVolunteer('${
                              volunteer.id
                            }', 'email')"
                            title="Enviar email">
                      <i class="fas fa-envelope"></i>
                    </button>
                  </div>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================
// FUNCIONES DE ESTADO Y UI
// =============================================

/**
 * Mostrar estado de carga
 */
function showVolunteersLoading(show = true) {
  const loadingEl = document.getElementById("voluntariosLoading");
  if (loadingEl) {
    loadingEl.style.display = show ? "block" : "none";
  }
}

/**
 * Ocultar todos los estados
 */
function hideVolunteersStates() {
  const elements = ["voluntariosList", "noVoluntarios", "voluntariosError"];

  elements.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = "none";
    }
  });
}

/**
 * Mostrar estado sin voluntarios
 */
function showNoVolunteersState() {
  showVolunteersLoading(false);
  hideVolunteersStates();

  const noVolEl = document.getElementById("noVoluntarios");
  if (noVolEl) {
    noVolEl.style.display = "block";
  }

  // Actualizar contador
  updateVolunteersCount(0);
}

/**
 * Mostrar estado de error
 */
function showErrorState() {
  showVolunteersLoading(false);
  hideVolunteersStates();

  const errorEl = document.getElementById("voluntariosError");
  if (errorEl) {
    errorEl.style.display = "block";
  }
}

/**
 * Actualizar contador de voluntarios
 * @param {number} count - Número de voluntarios
 */
function updateVolunteersCount(count) {
  const countElements = [
    document.getElementById("voluntariosCount"),
    document.getElementById("volunteerCountModal"),
    document.getElementById("totalVolunteersFooter"),
  ];

  countElements.forEach((element) => {
    if (element) {
      element.textContent = count;
    }
  });
}

// =============================================
// FUNCIONES DE UTILIDAD
// =============================================

/**
 * Formatear fecha del evento
 * @param {*} dateInput - Fecha en cualquier formato
 * @returns {string} Fecha formateada
 */
function formatEventDate(dateInput) {
  if (!dateInput) return "Fecha no definida";

  try {
    let date;

    // Si es un timestamp de Firebase
    if (dateInput.seconds) {
      date = new Date(dateInput.seconds * 1000);
    }
    // Si tiene método toDate (Timestamp de Firebase)
    else if (dateInput.toDate) {
      date = dateInput.toDate();
    }
    // Si es una fecha normal o string
    else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return dateInput.toString();
    }

    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return "Hoy";
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return "Mañana";
    }

    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return dateInput?.toString() || "Fecha no válida";
  }
}

// =============================================
// FUNCIONES DE ACCIÓN
// =============================================

/**
 * Contactar voluntario
 * @param {string} volunteerId - ID del voluntario
 * @param {string} method - Método de contacto ('phone' o 'email')
 */
function contactVolunteer(volunteerId, method) {
  console.log(`📞 Contactando voluntario ${volunteerId} por ${method}`);

  const voluntario = currentVolunteersList.find((v) => v.id === volunteerId);
  if (!voluntario) {
    console.error("Voluntario no encontrado:", volunteerId);
    alert("Voluntario no encontrado");
    return;
  }

  if (method === "phone") {
    const telefono = voluntario.celular || voluntario.telefono;
    if (telefono && telefono !== "No especificado") {
      window.open(`tel:${telefono}`, "_self");
    } else {
      alert("Número de teléfono no disponible");
    }
  } else if (method === "email") {
    const correo = voluntario.correo;
    if (correo && correo !== "Sin correo") {
      const subject = encodeURIComponent(
        `Evento: ${currentEventData?.titulo || "Sin título"}`
      );
      const body = encodeURIComponent(
        `Hola ${
          voluntario.nombreUsuario || voluntario.nombre
        },\n\nTe escribo respecto al evento "${
          currentEventData?.titulo || "Sin título"
        }".\n\nSaludos cordiales.`
      );
      window.open(`mailto:${correo}?subject=${subject}&body=${body}`, "_self");
    } else {
      alert("Correo electrónico no disponible");
    }
  }
}

/**
 * Reintentar cargar voluntarios
 */
function retryLoadVolunteers() {
  console.log("🔄 Reintentando cargar voluntarios...");
  if (currentEventId) {
    loadEventVolunteers(currentEventId);
  }
}

/**
 * Exportar lista de voluntarios
 */
function exportVolunteersList() {
  console.log("📤 Exportando lista de voluntarios...");

  if (currentVolunteersList.length === 0) {
    alert("No hay voluntarios para exportar");
    return;
  }

  try {
    // Crear CSV
    const csvContent = generateCSV(currentVolunteersList);

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `voluntarios_${currentEventData?.titulo || "evento"}_${
          new Date().toISOString().split("T")[0]
        }.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log("✅ Lista de voluntarios exportada exitosamente");
    }
  } catch (error) {
    console.error("❌ Error al exportar lista:", error);
    alert("Error al exportar la lista de voluntarios");
  }
}

/**
 * Generar contenido CSV
 * @param {Array} volunteers - Lista de voluntarios
 * @returns {string} Contenido CSV
 */
function generateCSV(volunteers) {
  const headers = [
    "#",
    "Nombre",
    "Correo",
    "Celular",
    "Talla Polo",
    "Estado",
    "Fecha Registro",
  ];
  const csvRows = [headers.join(",")];

  volunteers.forEach((volunteer, index) => {
    const row = [
      index + 1,
      `"${volunteer.nombreUsuario || volunteer.nombre || "Sin nombre"}"`,
      `"${volunteer.correo || "Sin correo"}"`,
      `"${volunteer.celular || volunteer.telefono || "No especificado"}"`,
      `"${volunteer.poloTallaID || volunteer.tallaPolo || "No especificada"}"`,
      `"${volunteer.estado || "Activo"}"`,
      `"${volunteer.fechaRegistro || volunteer.createdAt || "No disponible"}"`,
    ];
    csvRows.push(row.join(","));
  });

  return csvRows.join("\n");
}

// =============================================
// FUNCIONES GLOBALES
// =============================================

// Exponer funciones al scope global
window.showVolunteersModal = showVolunteersModal;
window.contactVolunteer = contactVolunteer;
window.retryLoadVolunteers = retryLoadVolunteers;
window.exportVolunteersList = exportVolunteersList;

// =============================================
// INICIALIZACIÓN
// =============================================

/**
 * Inicializar módulo de voluntarios
 */
function initializeVolunteersModal() {
  console.log("🚀 Inicializando módulo de modal de voluntarios");

  // Verificar que Bootstrap esté disponible
  if (typeof bootstrap === "undefined") {
    console.warn(
      "⚠️ Bootstrap no está cargado, el modal podría no funcionar correctamente"
    );
  }

  // Limpiar modal al cerrarlo
  const modal = document.getElementById("voluntariosModal");
  if (modal) {
    modal.addEventListener("hidden.bs.modal", function () {
      console.log("🔄 Limpiando modal de voluntarios");
      currentEventId = null;
      currentVolunteersList = [];
      currentEventData = null;

      // Limpiar contenido
      const elements = [
        "voluntariosModalTitle",
        "voluntariosModalLabel",
        "eventTitleModal",
        "eventDateModal",
        "eventTimeModal",
        "eventLocationModal",
        "eventInfo",
        "voluntariosList",
        "voluntariosCount",
        "volunteerCountModal",
        "totalVolunteersFooter",
      ];

      elements.forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
          if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
            element.value = "";
          } else {
            element.innerHTML = "";
          }
        }
      });

      // Resetear estados
      hideVolunteersStates();
      showVolunteersLoading(false);
    });
  }

  console.log("✅ Módulo de modal de voluntarios inicializado correctamente");
}

// Auto-inicializar
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeVolunteersModal);
} else {
  setTimeout(initializeVolunteersModal, 100);
}

console.log("👥 Módulo usuarios-events.js (MEJORADO) cargado correctamente");

// =============================================
// EXPORTACIONES
// =============================================

// Exportar funciones principales
export {
  showVolunteersModal,
  contactVolunteer,
  retryLoadVolunteers,
  exportVolunteersList,
  initializeVolunteersModal,
};
