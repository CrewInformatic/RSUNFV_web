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
// GESTIÓN DE SESIÓN SIMPLIFICADA
// =============================================

let currentUser = null;

function getStoredSession() {
  try {
    if (currentUser) return currentUser;

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
    // Silencioso en producción
  }
}

// =============================================
// UTILIDADES DE FECHA
// =============================================

function isCurrentMonth(date) {
  if (!date) return false;

  const now = new Date();
  let targetDate;

  if (typeof date === "string") {
    targetDate = new Date(date);
  } else if (date.seconds) {
    targetDate = new Date(date.seconds * 1000);
  } else if (date.toDate && typeof date.toDate === "function") {
    targetDate = date.toDate();
  } else {
    targetDate = new Date(date);
  }

  if (isNaN(targetDate.getTime())) return false;

  return (
    now.getMonth() === targetDate.getMonth() &&
    now.getFullYear() === targetDate.getFullYear()
  );
}

function parseEventDate(dateField) {
  if (!dateField) return null;

  try {
    if (typeof dateField === "string") {
      return new Date(dateField);
    }
    if (dateField.seconds) {
      return new Date(dateField.seconds * 1000);
    }
    if (typeof dateField === "number") {
      return new Date(dateField);
    }
    return new Date(dateField);
  } catch (error) {
    return null;
  }
}

function formatEventDate(dateField) {
  const date = parseEventDate(dateField);

  if (!date || isNaN(date.getTime())) {
    return "No definida";
  }

  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// =============================================
// CÁLCULO DE ESTADÍSTICAS
// =============================================

async function calculateDashboardStats() {
  try {
    const [eventsData, usersData] = await Promise.all([
      getEventsData(),
      getUsersData(),
    ]);

    const stats = {
      totalEvents: eventsData.total,
      totalVolunteers: usersData.volunteers,
      totalAdmins: usersData.admins,
      totalParticipants: eventsData.totalParticipants,
      monthlyStats: {
        newEvents: eventsData.newEventsThisMonth,
        newVolunteers: usersData.newVolunteersThisMonth,
        newParticipants: eventsData.newParticipantsThisMonth,
      },
    };

    return stats;
  } catch (error) {
    return getEmptyStats();
  }
}

async function getEventsData() {
  const eventosRef = collection(db, "eventos");
  const snapshot = await getDocs(eventosRef);

  let totalParticipants = 0;
  let newEventsThisMonth = 0;
  let newParticipantsThisMonth = 0;

  snapshot.forEach((doc) => {
    const eventData = doc.data();

    if (
      eventData.voluntariosInscritos &&
      Array.isArray(eventData.voluntariosInscritos)
    ) {
      const participants = eventData.voluntariosInscritos.length;
      totalParticipants += participants;

      if (isEventFromThisMonth(eventData)) {
        newParticipantsThisMonth += participants;
      }
    }

    if (isEventFromThisMonth(eventData)) {
      newEventsThisMonth++;
    }
  });

  return {
    total: snapshot.size,
    totalParticipants,
    newEventsThisMonth,
    newParticipantsThisMonth,
  };
}

function isEventFromThisMonth(eventData) {
  const dateFields = [
    eventData.fechaCreacion,
    eventData.fechaRegistro,
    eventData.timestamp,
    eventData.createdAt,
    eventData.dateCreated,
  ];

  for (const dateField of dateFields) {
    if (dateField && isCurrentMonth(dateField)) {
      return true;
    }
  }

  return false;
}

async function getUsersData() {
  const usuariosRef = collection(db, "usuarios");
  const snapshot = await getDocs(usuariosRef);

  let volunteers = 0;
  let admins = 0;
  let newVolunteersThisMonth = 0;

  snapshot.forEach((doc) => {
    const userData = doc.data();

    if (userData.esAdmin) {
      admins++;
    } else {
      volunteers++;

      const dateFields = [
        userData.fechaRegistro,
        userData.fechaCreacion,
        userData.timestamp,
        userData.createdAt,
        userData.dateRegistered,
      ];

      for (const dateField of dateFields) {
        if (dateField && isCurrentMonth(dateField)) {
          newVolunteersThisMonth++;
          break;
        }
      }
    }
  });

  return {
    volunteers,
    admins,
    newVolunteersThisMonth,
  };
}

function getEmptyStats() {
  return {
    totalEvents: 0,
    totalVolunteers: 0,
    totalAdmins: 0,
    totalParticipants: 0,
    monthlyStats: {
      newEvents: 0,
      newVolunteers: 0,
      newParticipants: 0,
    },
  };
}

// =============================================
// ACTUALIZACIÓN DE LA UI
// =============================================

async function loadDashboardStats() {
  const stats = await calculateDashboardStats();
  updateStatsUI(stats);
}

function updateStatsUI(stats) {
  updateStatNumbers(stats);
  updateStatChanges(stats);
}

function updateStatNumbers(stats) {
  const elements = [
    { id: "totalEvents", value: stats.totalEvents },
    { id: "totalVolunteers", value: stats.totalVolunteers },
    { id: "totalAdmins", value: stats.totalAdmins },
    { id: "totalParticipants", value: stats.totalParticipants },
  ];

  elements.forEach(({ id, value }) => {
    const element = document.getElementById(id);
    if (element) {
      animateNumber(element, value);
    }
  });
}

function updateStatChanges(stats) {
  const changes = document.querySelectorAll(".stat-change");
  const changeData = [
    {
      count: stats.monthlyStats.newEvents,
      icon: "fas fa-plus",
      text: "nuevo",
      textPlural: "nuevos",
      suffix: "este mes",
    },
    {
      count: stats.totalVolunteers,
      icon: "fas fa-users",
      text: "registrado",
      textPlural: "registrados",
      suffix: "",
    },
    {
      count: stats.totalAdmins,
      icon: "fas fa-user-shield",
      text: "activo",
      textPlural: "activos",
      suffix: "",
    },
    {
      count: stats.monthlyStats.newParticipants,
      icon: "fas fa-plus",
      text: "nueva",
      textPlural: "nuevas",
      suffix: "este mes",
    },
  ];

  changes.forEach((change, index) => {
    if (changeData[index]) {
      const data = changeData[index];
      const displayText = data.count === 1 ? data.text : data.textPlural;
      const suffix = data.suffix ? ` ${data.suffix}` : "";

      change.innerHTML = `<i class="${data.icon}"></i> ${data.count} ${displayText}${suffix}`;
    }
  });
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

// =============================================
// GESTIÓN DE EVENTOS
// =============================================

async function loadRecentEvents() {
  try {
    const events = await getEventsList();
    const sortedEvents = sortEventsByRecentness(events);
    const recentEvents = sortedEvents.slice(0, 5);
    updateEventsTable(recentEvents);
  } catch (error) {
    updateEventsTable([]);
  }
}

async function getEventsList() {
  const eventosRef = collection(db, "eventos");
  const querySnapshot = await getDocs(eventosRef);

  const events = [];
  querySnapshot.forEach((doc) => {
    events.push({ id: doc.id, ...doc.data() });
  });

  return events;
}

function sortEventsByRecentness(events) {
  return events.sort((a, b) => {
    if (a.fechaCreacion && b.fechaCreacion) {
      const dateA = parseEventDate(a.fechaCreacion);
      const dateB = parseEventDate(b.fechaCreacion);
      if (dateA && dateB) {
        return dateB.getTime() - dateA.getTime();
      }
    }

    if (a.fechaInicio && b.fechaInicio) {
      const dateA = parseEventDate(a.fechaInicio);
      const dateB = parseEventDate(b.fechaInicio);
      if (dateA && dateB) {
        return dateB.getTime() - dateA.getTime();
      }
    }

    const titleA = (a.titulo || a.nombreUsuario || "").toLowerCase();
    const titleB = (b.titulo || b.nombreUsuario || "").toLowerCase();
    return titleA.localeCompare(titleB);
  });
}

function updateEventsTable(events) {
  const eventsTable = document.getElementById("eventsTable");
  if (!eventsTable) return;

  if (events.length === 0) {
    eventsTable.innerHTML = createEmptyEventsMessage();
    return;
  }

  const tableHTML = events.map(createEventRow).join("");
  eventsTable.innerHTML = tableHTML;
}

function createEmptyEventsMessage() {
  return `
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
}

function createEventRow(event) {
  const eventInfo = extractEventInfo(event);
  const volunteersBadge = createVolunteersBadge(
    eventInfo.volunteersCount,
    eventInfo.maxCapacity
  );
  const statusBadge = createStatusBadge(event, eventInfo.startDate);

  return `
    <tr class="align-middle">
      <td>
        <div class="d-flex flex-column">
          <div class="fw-bold text-dark">${eventInfo.title}</div>
          <small class="text-muted">${eventInfo.shortDescription}</small>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <i class="fas fa-map-marker-alt text-primary me-2"></i>
          <span>${eventInfo.location}</span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <i class="fas fa-calendar text-info me-2"></i>
          <span>${eventInfo.formattedDate}</span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center justify-content-center">
          ${volunteersBadge}
        </div>
      </td>
      <td>
        <span class="badge ${statusBadge.class} px-3 py-2">${statusBadge.text}</span>
      </td>
    </tr>
  `;
}

function extractEventInfo(event) {
  const volunteersCount = event.voluntariosInscritos?.length || 0;
  const maxCapacity =
    event.cantidadVoluntarios || event.voluntarios || event.capacidad || 0;
  const title = event.titulo || event.nombreUsuario || "Sin título";
  const description = event.descripcion || event.resumen || "Sin descripción";
  const location = event.ubicacion || event.ubicación || "📍 No especificada";
  const startDate = parseEventDate(event.fechaInicio);
  const formattedDate = formatEventDate(event.fechaInicio);

  return {
    volunteersCount,
    maxCapacity,
    title,
    description,
    shortDescription:
      description.length > 60
        ? description.substring(0, 60) + "..."
        : description,
    location,
    startDate,
    formattedDate,
  };
}

function createVolunteersBadge(volunteersCount, maxCapacity) {
  const hasCapacity = maxCapacity > 0 && maxCapacity !== volunteersCount;
  const capacityText = hasCapacity
    ? `<small class="ms-1 opacity-75">/${maxCapacity}</small>`
    : "";
  const indicatorClass = volunteersCount > 0 ? "bg-success" : "bg-secondary";
  const indicatorTitle =
    volunteersCount > 0
      ? "Hay voluntarios inscritos"
      : "Sin voluntarios inscritos";

  return `
    <span class="badge bg-primary rounded-pill px-3 py-2 position-relative">
      <i class="fas fa-users me-1"></i>
      <span class="fw-bold">${volunteersCount}</span>
      ${capacityText}
    </span>
    <span class="badge ${indicatorClass} ms-2 rounded-circle" 
          style="width: 8px; height: 8px;" 
          title="${indicatorTitle}"></span>
  `;
}

function createStatusBadge(event, startDate) {
  if (!event.fechaInicio) {
    return { class: "bg-secondary text-white", text: "⏳ Pendiente" };
  }

  if (!startDate || isNaN(startDate.getTime())) {
    return { class: "bg-warning text-dark", text: "⚠️ Fecha inválida" };
  }

  const endDate = parseEventDate(event.fechaFin);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventStart = new Date(startDate);
  eventStart.setHours(0, 0, 0, 0);

  const eventEnd = endDate ? new Date(endDate) : null;
  if (eventEnd) eventEnd.setHours(23, 59, 59, 999);

  if (eventEnd && today > eventEnd) {
    return { class: "bg-success text-white", text: "✅ Completado" };
  }

  if (today >= eventStart && (!eventEnd || today <= eventEnd)) {
    return { class: "bg-warning text-dark", text: "🔥 En curso" };
  }

  if (today < eventStart) {
    const diffDays = Math.ceil((eventStart - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) {
      return { class: "bg-info text-white", text: `🔜 En ${diffDays}d` };
    }
    return { class: "bg-info text-white", text: "📅 Próximo" };
  }

  return { class: "bg-secondary text-white", text: "⏳ Pendiente" };
}

// =============================================
// NAVEGACIÓN Y SIDEBAR
// =============================================

function initializeSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("show");
      sidebarOverlay.classList.toggle("show");
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
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

function updateUserInfo(session) {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombreUsuario || session.correo;
  }

  const welcomeSection = document.querySelector(".welcome-section h2");
  if (welcomeSection) {
    const userName = session.nombreUsuario ? `, ${session.nombreUsuario}` : "";
    welcomeSection.textContent = `¡Bienvenido${userName}!`;
  }
}

// =============================================
// INICIALIZACIÓN SIMPLIFICADA
// =============================================

async function initializeDashboard() {
  const session = getStoredSession();
  if (!session) return;

  updateUserInfo(session);
  initializeSidebar();
  await loadDashboardStats();
  await loadRecentEvents();
}

// =============================================
// FUNCIONES GLOBALES EXPORTADAS SIMPLIFICADAS
// =============================================

window.refreshDashboard = async function () {
  await loadDashboardStats();
  await loadRecentEvents();
};

// Funciones básicas de sesión (para compatibilidad)
window.getStoredSession = getStoredSession;
window.clearSession = clearSession;

// =============================================
// EVENT LISTENERS
// =============================================

document.addEventListener("DOMContentLoaded", initializeDashboard);

window.addEventListener("resize", () => {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (window.innerWidth >= 992) {
    if (sidebar) sidebar.classList.remove("show");
    if (sidebarOverlay) sidebarOverlay.classList.remove("show");
  }
});
