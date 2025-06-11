// Función para resetear el formulario
function resetForm() {
  const form = document.getElementById("createEventForm");
  if (form) {
    form.reset();
    form.classList.remove("was-validated");
  }

  // Cambiar a la pestaña de eventos futuros
  const upcomingTab = document.getElementById("upcoming-tab");
  if (upcomingTab) {
    upcomingTab.click();
  }
}

// Actualizar contadores de eventos
function updateEventCounts() {
  const upcomingEvents = document.querySelectorAll(
    "#upcomingEvents .event-card"
  );
  const pastEvents = document.querySelectorAll("#pastEvents .event-card");

  const upcomingCount = document.getElementById("upcomingCount");
  const pastCount = document.getElementById("pastCount");

  if (upcomingCount) upcomingCount.textContent = upcomingEvents.length;
  if (pastCount) pastCount.textContent = pastEvents.length;
}

// Configurar observer para actualizar contadores cuando cambien los eventos
function setupEventObserver() {
  const upcomingContainer = document.getElementById("upcomingEvents");
  const pastContainer = document.getElementById("pastEvents");

  if (upcomingContainer && pastContainer) {
    const observer = new MutationObserver(updateEventCounts);

    observer.observe(upcomingContainer, { childList: true, subtree: true });
    observer.observe(pastContainer, { childList: true, subtree: true });
  }
}

// Inicializar observer cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  setupEventObserver();
  updateEventCounts();
});

// Funciones de búsqueda y filtrado (implementación básica FALTA MEJORAR)
document.addEventListener("DOMContentLoaded", function () {
  // Búsqueda en eventos futuros
  const searchUpcoming = document.getElementById("searchUpcoming");
  if (searchUpcoming) {
    searchUpcoming.addEventListener("input", function () {
      filterEvents("upcoming", this.value);
    });
  }

  // Búsqueda en eventos pasados
  const searchPast = document.getElementById("searchPast");
  if (searchPast) {
    searchPast.addEventListener("input", function () {
      filterEvents("past", this.value);
    });
  }

  // Filtros por tipo
  const filterUpcomingType = document.getElementById("filterUpcomingType");
  if (filterUpcomingType) {
    filterUpcomingType.addEventListener("change", function () {
      filterEventsByType("upcoming", this.value);
    });
  }

  const filterPastType = document.getElementById("filterPastType");
  if (filterPastType) {
    filterPastType.addEventListener("change", function () {
      filterEventsByType("past", this.value);
    });
  }
});

function filterEvents(type, searchTerm) {
  const container = document.getElementById(
    type === "upcoming" ? "upcomingEvents" : "pastEvents"
  );
  if (!container) return;

  const eventCards = container.querySelectorAll(".event-card");

  eventCards.forEach((card) => {
    const title = card.querySelector(".event-title").textContent.toLowerCase();
    const description = card
      .querySelector(".event-description")
      .textContent.toLowerCase();
    const location = card
      .querySelector(".event-meta-item:nth-child(3) span")
      .textContent.toLowerCase();

    const matchesSearch =
      title.includes(searchTerm.toLowerCase()) ||
      description.includes(searchTerm.toLowerCase()) ||
      location.includes(searchTerm.toLowerCase());

    card.style.display = matchesSearch ? "block" : "none";
  });
}

function filterEventsByType(tabType, eventType) {
  const container = document.getElementById(
    tabType === "upcoming" ? "upcomingEvents" : "pastEvents"
  );
  if (!container) return;

  const eventCards = container.querySelectorAll(".event-card");

  eventCards.forEach((card) => {
    if (!eventType) {
      card.style.display = "block";
      return;
    }

    // Por ahora, mostramos todos los eventos
    card.style.display = "block";
  });
}
