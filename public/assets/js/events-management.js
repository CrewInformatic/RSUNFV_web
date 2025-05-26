import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAUBAyRnT0XEoKLlv-9GAmxi6F12peZd7c",
  authDomain: "rsunfv.firebaseapp.com",
  projectId: "rsunfv",
  storageBucket: "rsunfv.firebasestorage.app",
  messagingSenderId: "125433829660",
  appId: "1:125433829660:web:ef60f4871bf4ad74ae02d9",
  measurementId: "G-QCWGD7EJ46",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================================
// FUNCIONES DE GESTIÓN DE SESIÓN (Reutilizadas)
// =============================================

function getStoredSession() {
  try {
    const storedSession = localStorage.getItem("userSession");
    if (storedSession) {
      return JSON.parse(storedSession);
    }
    return null;
  } catch (error) {
    console.error("Error al obtener sesión:", error);
    localStorage.removeItem("userSession");
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem("userSession");
    console.log("Sesión limpiada");
  } catch (error) {
    console.error("Error al limpiar sesión:", error);
  }
}

function checkAuthentication() {
  const session = getStoredSession();
  if (!session) {
    console.log("No hay sesión activa, redirigiendo al login");
    window.location.href = "index.html";
    return null;
  }

  if (!session.esAdmin) {
    console.log("Usuario sin privilegios de administrador");
    alert("No tienes permisos para acceder a esta página");
    window.location.href = "portal_test.html";
    return null;
  }

  return session;
}

// =============================================
// FUNCIONES DE NAVEGACIÓN (Reutilizadas)
// =============================================

window.navigateToPage = function (pageName) {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  const adminPages = [
    "eventos.html",
    "administradores.html",
    "usuarios.html",
    "configuracion.html",
    "reportes.html",
  ];
  if (adminPages.includes(pageName) && !session.esAdmin) {
    alert("No tienes permisos para acceder a esta página");
    return;
  }

  window.location.href = pageName;
};

window.showProfile = function () {
  const session = getStoredSession();
  if (session) {
    alert(
      `Perfil de Usuario:\n\nNombre: ${session.nombre}\nCorreo: ${
        session.correo
      }\nRol: ${
        session.esAdmin ? "Administrador" : "Usuario"
      }\nÚltimo acceso: ${new Date(session.loginTime).toLocaleString()}`
    );
  }
};

window.showSettings = function () {
  alert("Página de configuración en desarrollo");
};

window.handleLogout = function () {
  const confirmed = confirm("¿Estás seguro de que deseas cerrar sesión?");
  if (confirmed) {
    console.log("Cerrando sesión...");
    clearSession();
    alert("Sesión cerrada exitosamente");
    window.location.href = "index.html";
  }
};

// =============================================
// FUNCIONES DE GESTIÓN DE EVENTOS
// =============================================

// Cargar eventos futuros
async function loadUpcomingEvents() {
  const loadingEl = document.getElementById("upcomingLoading");
  const eventsContainer = document.getElementById("upcomingEvents");

  try {
    if (loadingEl) loadingEl.style.display = "block";

    const now = new Date();
    const eventosRef = collection(db, "eventos");
    const q = query(
      eventosRef,
      where("fechaInicio", ">=", Timestamp.fromDate(now)),
      orderBy("fechaInicio", "asc")
    );

    const querySnapshot = await getDocs(q);
    const events = [];

    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });

    displayUpcomingEvents(events);
  } catch (error) {
    console.error("Error al cargar eventos futuros:", error);
    if (eventsContainer) {
      eventsContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
          <div>Error al cargar eventos futuros</div>
          <small class="text-muted">Intenta recargar la página</small>
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

// Mostrar eventos futuros
function displayUpcomingEvents(events) {
  const eventsContainer = document.getElementById("upcomingEvents");
  if (!eventsContainer) return;

  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-calendar-plus fa-3x text-muted mb-3"></i>
        <h5>No hay eventos futuros programados</h5>
        <p class="text-muted">Crea un nuevo evento usando la pestaña "Crear Evento"</p>
      </div>
    `;
    return;
  }

  let eventsHTML = "";
  events.forEach((event) => {
    const fechaInicio = event.fechaInicio
      ? event.fechaInicio.toDate()
      : new Date();
    const fechaFin = event.fechaFin ? event.fechaFin.toDate() : null;

    eventsHTML += `
      <div class="event-card" data-event-id="${event.id}">
        <div class="event-card-header">
          <div class="d-flex justify-content-between align-items-start">
            <h5 class="event-title">${event.titulo || "Sin título"}</h5>
            <span class="status-badge status-upcoming">Próximo</span>
          </div>
        </div>
        <div class="event-card-body">
          <div class="event-meta">
            <div class="event-meta-item">
              <i class="fas fa-calendar"></i>
              <span>${fechaInicio.toLocaleDateString("es-ES", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-clock"></i>
              <span>${event.horaInicio || "No definida"} - ${
      event.horaFin || "No definida"
    }</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-map-marker-alt"></i>
              <span>${event.ubicacion || "No especificada"}</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-users"></i>
              <span>${
                event.voluntariosRegistrados || 0
              } voluntarios registrados</span>
            </div>
            ${
              event.maxVoluntarios
                ? `
            <div class="event-meta-item">
              <i class="fas fa-user-plus"></i>
              <span>Máximo: ${event.maxVoluntarios} voluntarios</span>
            </div>
            `
                : ""
            }
          </div>
          <p class="event-description">
            ${event.descripcion || "Sin descripción disponible"}
          </p>
          <div class="event-actions">
            <button class="btn btn-primary btn-sm" onclick="editEvent('${
              event.id
            }')">
              <i class="fas fa-edit me-1"></i>Editar
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="viewVolunteers('${
              event.id
            }')">
              <i class="fas fa-users me-1"></i>Ver Voluntarios
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="cancelEvent('${
              event.id
            }')">
              <i class="fas fa-trash me-1"></i>Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
  });

  eventsContainer.innerHTML = eventsHTML;
}

// Cargar eventos pasados
async function loadPastEvents() {
  const loadingEl = document.getElementById("pastLoading");
  const eventsContainer = document.getElementById("pastEvents");

  try {
    if (loadingEl) loadingEl.style.display = "block";

    const now = new Date();
    const eventosRef = collection(db, "eventos");
    const q = query(
      eventosRef,
      where("fechaFin", "<", Timestamp.fromDate(now)),
      orderBy("fechaFin", "desc")
    );

    const querySnapshot = await getDocs(q);
    const events = [];

    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });

    displayPastEvents(events);
  } catch (error) {
    console.error("Error al cargar eventos pasados:", error);
    if (eventsContainer) {
      eventsContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
          <div>Error al cargar eventos pasados</div>
          <small class="text-muted">Intenta recargar la página</small>
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

// Mostrar eventos pasados
function displayPastEvents(events) {
  const eventsContainer = document.getElementById("pastEvents");
  if (!eventsContainer) return;

  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-history fa-3x text-muted mb-3"></i>
        <h5>No hay eventos pasados</h5>
        <p class="text-muted">Los eventos completados aparecerán aquí</p>
      </div>
    `;
    return;
  }

  let eventsHTML = "";
  events.forEach((event) => {
    const fechaInicio = event.fechaInicio
      ? event.fechaInicio.toDate()
      : new Date();

    eventsHTML += `
      <div class="event-card" data-event-id="${event.id}">
        <div class="event-card-header">
          <div class="d-flex justify-content-between align-items-start">
            <h5 class="event-title">${event.titulo || "Sin título"}</h5>
            <span class="status-badge status-completed">Completado</span>
          </div>
        </div>
        <div class="event-card-body">
          <div class="event-meta">
            <div class="event-meta-item">
              <i class="fas fa-calendar"></i>
              <span>${fechaInicio.toLocaleDateString("es-ES", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-map-marker-alt"></i>
              <span>${event.ubicacion || "No especificada"}</span>
            </div>
            <div class="event-meta-item">
              <i class="fas fa-users"></i>
              <span>${
                event.voluntariosRegistrados || 0
              } voluntarios participaron</span>
            </div>
            ${
              event.resultados
                ? `
            <div class="event-meta-item">
              <i class="fas fa-check-circle"></i>
              <span>${event.resultados}</span>
            </div>
            `
                : ""
            }
          </div>
          <p class="event-description">
            ${event.descripcion || "Sin descripción disponible"}
          </p>
          <div class="event-actions">
            <button class="btn btn-outline-secondary btn-sm" onclick="viewEventReport('${
              event.id
            }')">
              <i class="fas fa-chart-bar me-1"></i>Ver Reporte
            </button>
            <button class="btn btn-outline-secondary btn-sm" onclick="viewEventPhotos('${
              event.id
            }')">
              <i class="fas fa-camera me-1"></i>Ver Fotos
            </button>
          </div>
        </div>
      </div>
    `;
  });

  eventsContainer.innerHTML = eventsHTML;
}

// Crear nuevo evento
async function createEvent(eventData) {
  try {
    const session = getStoredSession();
    if (!session) {
      throw new Error("Sesión no válida");
    }

    // Preparar datos del evento
    const newEvent = {
      titulo: eventData.titulo,
      descripcion: eventData.descripcion,
      tipo: eventData.tipo,
      fechaInicio: Timestamp.fromDate(new Date(eventData.fechaInicio)),
      fechaFin: eventData.fechaFin
        ? Timestamp.fromDate(new Date(eventData.fechaFin))
        : null,
      horaInicio: eventData.horaInicio,
      horaFin: eventData.horaFin,
      ubicacion: eventData.ubicacion,
      maxVoluntarios: eventData.maxVoluntarios
        ? parseInt(eventData.maxVoluntarios)
        : null,
      requisitos: eventData.requisitos || "",
      materiales: eventData.materiales || "",
      createdBy: session.correo,
      createdAt: serverTimestamp(),
      voluntariosRegistrados: 0,
      estado: "activo",
    };

    // Agregar evento a Firestore
    const docRef = await addDoc(collection(db, "eventos"), newEvent);
    console.log("Evento creado con ID:", docRef.id);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error al crear evento:", error);
    return { success: false, error: error.message };
  }
}

// =============================================
// FUNCIONES DE ACCIONES DE EVENTOS
// =============================================

// Editar evento
window.editEvent = function (eventId) {
  alert(`Funcionalidad de edición en desarrollo para evento: ${eventId}`);
  // Aquí se implementaría la lógica para editar el evento
};

// Ver voluntarios del evento
window.viewVolunteers = function (eventId) {
  alert(`Ver voluntarios del evento: ${eventId}`);
  // Aquí se implementaría la lógica para mostrar voluntarios registrados
};

// Cancelar evento
window.cancelEvent = async function (eventId) {
  const confirmed = confirm(
    "¿Estás seguro de que deseas cancelar este evento?"
  );
  if (!confirmed) return;

  try {
    // En lugar de eliminar, actualizar el estado a cancelado
    const eventRef = doc(db, "eventos", eventId);
    await updateDoc(eventRef, {
      estado: "cancelado",
      fechaCancelacion: serverTimestamp(),
    });

    alert("Evento cancelado exitosamente");
    // Recargar eventos
    await loadUpcomingEvents();
  } catch (error) {
    console.error("Error al cancelar evento:", error);
    alert("Error al cancelar el evento. Intenta de nuevo.");
  }
};

// Ver reporte del evento
window.viewEventReport = function (eventId) {
  alert(`Ver reporte del evento: ${eventId}`);
  // Aquí se implementaría la lógica para mostrar el reporte del evento
};

// Ver fotos del evento
window.viewEventPhotos = function (eventId) {
  alert(`Ver fotos del evento: ${eventId}`);
  // Aquí se implementaría la lógica para mostrar las fotos del evento
};

// =============================================
// MANEJO DEL FORMULARIO DE CREACIÓN
// =============================================

function initializeEventForm() {
  const form = document.getElementById("createEventForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Obtener datos del formulario
    const formData = new FormData(form);
    const eventData = {
      titulo: document.getElementById("eventTitle").value,
      descripcion: document.getElementById("eventDescription").value,
      tipo: document.getElementById("eventType").value,
      fechaInicio: document.getElementById("eventDate").value,
      horaInicio: document.getElementById("eventStartTime").value,
      horaFin: document.getElementById("eventEndTime").value,
      ubicacion: document.getElementById("eventLocation").value,
      maxVoluntarios: document.getElementById("maxVolunteers").value,
      requisitos: document.getElementById("requirements").value,
      materiales: document.getElementById("materials").value,
    };

    // Validar fecha
    const eventDate = new Date(eventData.fechaInicio);
    const now = new Date();
    if (eventDate <= now) {
      alert("La fecha del evento debe ser futura");
      return;
    }

    // Crear fechaFin combinando fecha y hora de fin
    if (eventData.horaFin) {
      eventData.fechaFin = `${eventData.fechaInicio}T${eventData.horaFin}:00`;
    }
    eventData.fechaInicio = `${eventData.fechaInicio}T${eventData.horaInicio}:00`;

    // Mostrar loading
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i>Creando...';
    submitBtn.disabled = true;

    try {
      const result = await createEvent(eventData);

      if (result.success) {
        alert("Evento creado exitosamente");
        form.reset();

        // Cambiar a la pestaña de eventos futuros y recargar
        const upcomingTab = document.getElementById("upcoming-tab");
        if (upcomingTab) {
          upcomingTab.click();
          await loadUpcomingEvents();
        }
      } else {
        alert(`Error al crear evento: ${result.error}`);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error inesperado al crear el evento");
    } finally {
      // Restaurar botón
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// =============================================
// FUNCIONES DE SIDEBAR Y NAVEGACIÓN
// =============================================

function initializeSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.toggle("show");
      sidebarOverlay.classList.toggle("show");
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", function () {
      sidebar.classList.remove("show");
      sidebarOverlay.classList.remove("show");
    });
  }

  // Manejar clicks en los enlaces del sidebar
  const navLinks = document.querySelectorAll(".nav-link[data-section]");
  navLinks.forEach((link) => {
    link.addEventListener("click", function () {
      navLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      if (window.innerWidth < 992) {
        sidebar.classList.remove("show");
        sidebarOverlay.classList.remove("show");
      }
    });
  });
}

// =============================================
// FUNCIONES DE INICIALIZACIÓN
// =============================================

function updateUserInfo(session) {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombre || session.correo;
  }
}

async function initializeEventsPage() {
  console.log("Inicializando página de eventos...");

  // Verificar autenticación
  const session = checkAuthentication();
  if (!session) return;

  // Actualizar información del usuario
  updateUserInfo(session);

  // Inicializar sidebar
  initializeSidebar();

  // Inicializar formulario
  initializeEventForm();

  // Cargar eventos iniciales
  await loadUpcomingEvents();

  // Configurar event listeners para las pestañas
  const upcomingTab = document.getElementById("upcoming-tab");
  const pastTab = document.getElementById("past-tab");

  if (upcomingTab) {
    upcomingTab.addEventListener("shown.bs.tab", loadUpcomingEvents);
  }

  if (pastTab) {
    pastTab.addEventListener("shown.bs.tab", loadPastEvents);
  }

  console.log("Página de eventos inicializada correctamente");
}

// =============================================
// EVENT LISTENERS Y INICIALIZACIÓN
// =============================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM cargado, inicializando página de eventos...");
  initializeEventsPage();
});

// Manejar cambios de tamaño de ventana
window.addEventListener("resize", function () {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (window.innerWidth >= 992) {
    if (sidebar) sidebar.classList.remove("show");
    if (sidebarOverlay) sidebarOverlay.classList.remove("show");
  }
});

// Función para refrescar eventos
window.refreshEvents = function () {
  const activeTab = document.querySelector(".nav-link.active");
  if (activeTab && activeTab.id === "past-tab") {
    loadPastEvents();
  } else {
    loadUpcomingEvents();
  }
};

// Exportar funciones para uso global
window.getStoredSession = getStoredSession;
window.clearSession = clearSession;
window.checkAuthentication = checkAuthentication;
