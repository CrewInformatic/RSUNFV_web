// Reset form function
function resetForm() {
  const form = document.getElementById("createEventForm");
  if (form) {
    form.reset();
    form.classList.remove("was-validated");
  }

  // Switch to upcoming events tab
  const upcomingTab = document.getElementById("upcoming-tab");
  if (upcomingTab) {
    upcomingTab.click();
  }
}

// Update event counters
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

// Setup observer to update counters when events change
function setupEventObserver() {
  const upcomingContainer = document.getElementById("upcomingEvents");
  const pastContainer = document.getElementById("pastEvents");

  if (upcomingContainer && pastContainer) {
    const observer = new MutationObserver(updateEventCounts);

    observer.observe(upcomingContainer, { childList: true, subtree: true });
    observer.observe(pastContainer, { childList: true, subtree: true });
  }
}

// Initialize observer when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setupEventObserver();
  updateEventCounts();
});

// Search and filter functions
document.addEventListener("DOMContentLoaded", () => {
  // Search in upcoming events
  const searchUpcoming = document.getElementById("searchUpcoming");
  if (searchUpcoming) {
    searchUpcoming.addEventListener("input", function () {
      filterEvents("upcoming", this.value);
    });
  }

  // Search in past events
  const searchPast = document.getElementById("searchPast");
  if (searchPast) {
    searchPast.addEventListener("input", function () {
      filterEvents("past", this.value);
    });
  }

  // Filter by type
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
  const containerId = type === "upcoming" ? "upcomingEvents" : "pastEvents";
  const container = document.getElementById(containerId);

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
  const containerId = tabType === "upcoming" ? "upcomingEvents" : "pastEvents";
  const container = document.getElementById(containerId);

  if (!container) return;

  const eventCards = container.querySelectorAll(".event-card");

  eventCards.forEach((card) => {
    if (!eventType) {
      card.style.display = "block";
      return;
    }

    //TODO: Implement type filtering logic
    card.style.display = "block";
  });
}
