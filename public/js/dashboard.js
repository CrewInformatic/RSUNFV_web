import { db } from "./firebase_config.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =============================================
// GESTIÓN DE SESIÓN
// =============================================

let currentUser = null;

function getStoredSession() {
  try {
    if (currentUser) {
      return currentUser;
    }

    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      const parsedSession = JSON.parse(storedSession);
      currentUser = parsedSession;
      return parsedSession;
    }

    return null;
  } catch (error) {
    sessionStorage.removeItem("userSession");
    return null;
  }
}

function clearSession() {
  try {
    currentUser = null;
    sessionStorage.removeItem("userSession");
  } catch (error) {
    console.error("Error al limpiar sesión:", error);
  }
}

function checkAuthentication() {
  const session = getStoredSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  if (!session.esAdmin) {
    alert("No tienes permisos para acceder a esta página");
    window.location.href = "descarga_app.html";
    return null;
  }

  return session;
}

// =============================================
// INICIALIZACIÓN DE EVENTOS
// =============================================

async function initializeEventsPage() {
  const session = checkAuthentication();
  if (!session) {
    return;
  }

  updateUserInfo(session);
  initializeSidebar();
  initializeEventForm();
  await loadUpcomingEvents();

  const upcomingTab = document.getElementById("upcoming-tab");
  const pastTab = document.getElementById("past-tab");

  if (upcomingTab) {
    upcomingTab.addEventListener("shown.bs.tab", loadUpcomingEvents);
  }

  if (pastTab) {
    pastTab.addEventListener("shown.bs.tab", loadPastEvents);
  }
}

// =============================================
// FUNCIONES DE NAVEGACIÓN
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
      `Perfil de Usuario:\n\nUsuario: ${session.nombreUsuario}\nCorreo: ${
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
    clearSession();
    alert("Sesión cerrada exitosamente");
    window.location.href = "index.html";
  }
};

// =============================================
// CARGA DE ESTADÍSTICAS
// =============================================

async function loadDashboardStats() {
  try {
    const eventosRef = collection(db, "eventos");
    const eventosSnapshot = await getDocs(eventosRef);
    const totalEvents = eventosSnapshot.size;

    const usuariosRef = collection(db, "usuarios");
    const usuariosSnapshot = await getDocs(usuariosRef);
    const allUsers = [];
    usuariosSnapshot.forEach((doc) => {
      allUsers.push(doc.data());
    });

    const totalVolunteers = allUsers.filter((user) => !user.esAdmin).length;
    const totalAdmins = allUsers.filter((user) => user.esAdmin).length;

    let totalParticipants = 0;
    try {
      const participacionesRef = collection(db, "participaciones");
      const participacionesSnapshot = await getDocs(participacionesRef);
      totalParticipants = participacionesSnapshot.size;
    } catch (error) {
      // Colección no existe
    }

    updateStatsUI({
      totalEvents,
      totalVolunteers,
      totalAdmins,
      totalParticipants,
    });
  } catch (error) {
    console.error("Error al cargar estadísticas:", error);
    updateStatsUI({
      totalEvents: 0,
      totalVolunteers: 0,
      totalAdmins: 0,
      totalParticipants: 0,
    });
  }
}

function updateStatsUI(stats) {
  const totalEventsEl = document.getElementById("totalEvents");
  const totalVolunteersEl = document.getElementById("totalVolunteers");
  const totalAdminsEl = document.getElementById("totalAdmins");
  const totalParticipantsEl = document.getElementById("totalParticipants");

  if (totalEventsEl) {
    animateNumber(totalEventsEl, stats.totalEvents);
  }
  if (totalVolunteersEl) {
    animateNumber(totalVolunteersEl, stats.totalVolunteers);
  }
  if (totalAdminsEl) {
    animateNumber(totalAdminsEl, stats.totalAdmins);
  }
  if (totalParticipantsEl) {
    animateNumber(totalParticipantsEl, stats.totalParticipants);
  }

  updateStatChanges(stats);
}

function animateNumber(element, finalNumber) {
  const duration = 1000;
  const steps = 30;
  const stepValue = finalNumber / steps;
  const stepDuration = duration / steps;

  let currentNumber = 0;
  const timer = setInterval(() => {
    currentNumber += stepValue;
    if (currentNumber >= finalNumber) {
      currentNumber = finalNumber;
      clearInterval(timer);
    }
    element.textContent = Math.floor(currentNumber);
  }, stepDuration);
}

function updateStatChanges(stats) {
  const changes = document.querySelectorAll(".stat-change");
  changes.forEach((change, index) => {
    switch (index) {
      case 0:
        change.innerHTML = '<i class="fas fa-arrow-up"></i> +2 este mes';
        break;
      case 1:
        change.innerHTML = `<i class="fas fa-arrow-up"></i> ${stats.totalVolunteers} registrados`;
        break;
      case 2:
        change.innerHTML = `<i class="fas fa-minus"></i> ${stats.totalAdmins} activos`;
        break;
      case 3:
        change.innerHTML = '<i class="fas fa-arrow-up"></i> +15 este mes';
        break;
    }
  });
}

// =============================================
// CARGA DE EVENTOS
// =============================================

async function loadRecentEvents() {
  try {
    const eventosRef = collection(db, "eventos");
    const querySnapshot = await getDocs(eventosRef);

    const events = [];
    querySnapshot.forEach((doc) => {
      const eventData = { id: doc.id, ...doc.data() };
      events.push(eventData);
    });

    const sortedEvents = events.sort((a, b) => {
      if (a.fechaCreacion && b.fechaCreacion) {
        const dateA = new Date(a.fechaCreacion);
        const dateB = new Date(b.fechaCreacion);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime();
        }
      }

      if (a.fechaInicio && b.fechaInicio) {
        const dateA = new Date(a.fechaInicio);
        const dateB = new Date(a.fechaInicio);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime();
        }
      }

      if (a.fechaInicio && !b.fechaInicio) return -1;
      if (!a.fechaInicio && b.fechaInicio) return 1;

      const titleA = (a.titulo || a.nombreUsuario || "").toLowerCase();
      const titleB = (b.titulo || b.nombreUsuario || "").toLowerCase();
      return titleA.localeCompare(titleB);
    });

    const recentEvents = sortedEvents.slice(0, 5);
    updateEventsTable(recentEvents);
  } catch (error) {
    console.error("Error al cargar eventos:", error);
    await loadEventsSimple();
  }
}

async function loadEventsSimple() {
  try {
    const eventosRef = collection(db, "eventos");
    const querySnapshot = await getDocs(eventosRef);

    const events = [];
    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });

    const limitedEvents = events.slice(0, 10);
    updateEventsTable(limitedEvents);
  } catch (error) {
    console.error("Error en carga simple:", error);
    updateEventsTable([]);
  }
}

function updateEventsTable(events) {
  const eventsTable = document.getElementById("eventsTable");
  if (!eventsTable) {
    return;
  }

  if (events.length === 0) {
    eventsTable.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4">
          <div class="d-flex flex-column align-items-center">
            <i class="fas fa-calendar-times fa-3x text-muted mb-3"></i>
            <h5 class="text-muted">No hay eventos registrados</h5>
            <p class="text-muted mb-0">Los eventos aparecerán aquí una vez creados</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let tableHTML = "";
  events.forEach((event) => {
    let fechaInicio = "No definida";
    let fechaOriginal = null;

    if (event.fechaInicio) {
      try {
        let fecha;

        if (
          typeof event.fechaInicio === "string" &&
          event.fechaInicio.includes("-")
        ) {
          fecha = new Date(event.fechaInicio);
        } else if (event.fechaInicio.seconds) {
          fecha = new Date(event.fechaInicio.seconds * 1000);
        } else if (typeof event.fechaInicio === "number") {
          fecha = new Date(event.fechaInicio);
        } else {
          fecha = new Date(event.fechaInicio);
        }

        if (!isNaN(fecha.getTime())) {
          fechaOriginal = fecha;
          fechaInicio = fecha.toLocaleDateString("es-ES", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        } else {
          fechaInicio = `📅 ${event.fechaInicio}`;
        }
      } catch (error) {
        fechaInicio = `📅 ${event.fechaInicio}`;
      }
    }

    const estado = getEventStatus(event, fechaOriginal);
    const ubicacion =
      event.ubicacion || event.ubicación || "📍 No especificada";
    const voluntarios =
      event.cantidadVoluntarios || event.voluntarios || event.capacidad || 0;
    const titulo = event.titulo || event.nombreUsuario || "Sin título";
    const descripcion = event.descripcion || event.resumen || "Sin descripción";

    tableHTML += `
      <tr class="align-middle">
        <td>
          <div class="d-flex flex-column">
            <div class="fw-bold text-dark">${titulo}</div>
            <small class="text-muted">${
              descripcion.length > 60
                ? descripcion.substring(0, 60) + "..."
                : descripcion
            }</small>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <i class="fas fa-map-marker-alt text-primary me-2"></i>
            <span>${ubicacion}</span>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <i class="fas fa-calendar text-info me-2"></i>
            <span>${fechaInicio}</span>
          </div>
        </td>
        <td>
          <span class="badge bg-primary rounded-pill px-3 py-2">
            <i class="fas fa-users me-1"></i>
            ${voluntarios}
          </span>
        </td>
        <td>
          <span class="badge ${estado.class} px-3 py-2">${estado.text}</span>
        </td>
      </tr>
    `;
  });

  eventsTable.innerHTML = tableHTML;
}

function getEventStatus(event, fechaDate = null) {
  if (!event.fechaInicio) {
    return { class: "bg-secondary text-white", text: "⏳ Pendiente" };
  }

  try {
    const now = new Date();
    let startDate = fechaDate;

    if (!startDate) {
      if (typeof event.fechaInicio === "string") {
        startDate = new Date(event.fechaInicio);
      } else if (event.fechaInicio.seconds) {
        startDate = new Date(event.fechaInicio.seconds * 1000);
      } else {
        startDate = new Date(event.fechaInicio);
      }
    }

    if (isNaN(startDate.getTime())) {
      return { class: "bg-warning text-dark", text: "⚠️ Fecha inválida" };
    }

    let endDate = null;
    if (event.fechaFin) {
      try {
        if (typeof event.fechaFin === "string") {
          endDate = new Date(event.fechaFin);
        } else if (event.fechaFin.seconds) {
          endDate = new Date(event.fechaFin.seconds * 1000);
        } else {
          endDate = new Date(event.fechaFin);
        }

        if (isNaN(endDate.getTime())) {
          endDate = null;
        }
      } catch (error) {
        endDate = null;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventStart = new Date(startDate);
    eventStart.setHours(0, 0, 0, 0);
    const eventEnd = endDate ? new Date(endDate) : null;
    if (eventEnd) eventEnd.setHours(23, 59, 59, 999);

    if (eventEnd && today > eventEnd) {
      return { class: "bg-success text-white", text: "✅ Completado" };
    } else if (today >= eventStart && (!eventEnd || today <= eventEnd)) {
      return { class: "bg-warning text-dark", text: "🔥 En curso" };
    } else if (today < eventStart) {
      const diffDays = Math.ceil((eventStart - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        return { class: "bg-info text-white", text: `🔜 En ${diffDays}d` };
      } else {
        return { class: "bg-info text-white", text: "📅 Próximo" };
      }
    }

    return { class: "bg-secondary text-white", text: "⏳ Pendiente" };
  } catch (error) {
    return { class: "bg-danger text-white", text: "❌ Error" };
  }
}

// =============================================
// FUNCIONES DE DEBUG (SOLO DESARROLLO)
// =============================================

window.debugEvents = async function () {
  try {
    const eventosRef = collection(db, "eventos");
    const querySnapshot = await getDocs(eventosRef);

    const allEvents = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allEvents.push({
        id: doc.id,
        ...data,
      });
    });

    return allEvents;
  } catch (error) {
    console.error("Error en debug:", error);
  }
};

window.forceReloadEvents = async function () {
  await loadRecentEvents();
};

window.showAllEvents = async function () {
  try {
    const eventosRef = collection(db, "eventos");
    const querySnapshot = await getDocs(eventosRef);

    const events = [];
    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });

    updateEventsTable(events);
  } catch (error) {
    console.error("Error al mostrar todos los eventos:", error);
  }
};

// =============================================
// SIDEBAR Y NAVEGACIÓN
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
// INICIALIZACIÓN
// =============================================

async function initializeDashboard() {
  const session = checkAuthentication();
  if (!session) return;

  updateUserInfo(session);
  initializeSidebar();
  await loadDashboardStats();
  await loadRecentEvents();
}

function updateUserInfo(session) {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombreUsuario || session.correo;
  }

  const welcomeSection = document.querySelector(".welcome-section h2");
  if (welcomeSection) {
    welcomeSection.textContent = `¡Bienvenido${
      session.nombreUsuario ? ", " + session.nombreUsuario : ""
    }!`;
  }
}

// =============================================
// EVENT LISTENERS
// =============================================

document.addEventListener("DOMContentLoaded", function () {
  initializeDashboard();
});

window.addEventListener("resize", function () {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (window.innerWidth >= 992) {
    if (sidebar) sidebar.classList.remove("show");
    if (sidebarOverlay) sidebarOverlay.classList.remove("show");
  }
});

// =============================================
// FUNCIONES UTILITARIAS
// =============================================

window.showDebugInfo = function () {
  const session = getStoredSession();
  console.log("Información de sesión:", session);
  console.log("Página actual:", window.location.pathname);
  console.log("Usuario autenticado:", !!session);
  console.log("Es administrador:", session?.esAdmin || false);
};

window.refreshDashboard = async function () {
  await loadDashboardStats();
  await loadRecentEvents();
};

// Exportar funciones globales
window.getStoredSession = getStoredSession;
window.clearSession = clearSession;
window.checkAuthentication = checkAuthentication;
