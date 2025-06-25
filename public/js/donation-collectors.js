// donation-collectors.js - Sistema de Selección de Recolectores de Donaciones
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =============================================
// CONSTANTES
// =============================================
const COLLECTOR_ROLE_ID = "rol_004";
const FIRESTORE_COLLECTIONS = {
  USERS: "usuarios",
};

const DOM_IDS = {
  MODAL: "donationCollectorsModal",
  SELECTED_RECEPTORS: "selectedReceptors",
  SELECTED_COUNT: "selectedCount",
  CONFIRM_BUTTON: "confirmCollectors",
  COLLECTORS_CONTAINER: "collectorsContainer",
};

const CSS_CLASSES = {
  SELECTED_CARD: "border-primary bg-light",
  COLLECTOR_CARD: "collector-card",
  COLLECTOR_CHECKBOX: "collector-checkbox",
};

// =============================================
// ESTADO DE LA APLICACIÓN
// =============================================
class CollectorsState {
  constructor() {
    this.availableCollectors = [];
    this.selectedCollectors = [];
    this.isLoading = false;
    this.isModalInitialized = false;
  }

  reset() {
    this.selectedCollectors = [];
  }

  addCollector(collector) {
    if (!this.isCollectorSelected(collector.id)) {
      this.selectedCollectors.push(collector);
    }
  }

  removeCollector(collectorId) {
    this.selectedCollectors = this.selectedCollectors.filter(
      (collector) => collector.id !== collectorId
    );
  }

  isCollectorSelected(collectorId) {
    return this.selectedCollectors.some(
      (collector) => collector.id === collectorId
    );
  }

  selectAll() {
    this.selectedCollectors = [...this.availableCollectors];
  }

  getSelectedIds() {
    return this.selectedCollectors.map((collector) => ({ id: collector.id }));
  }
}

// =============================================
// SERVICIO DE FIREBASE
// =============================================
class FirebaseService {
  static validateFirebase() {
    if (!window.firebaseDB) {
      throw new Error("Firebase no está inicializado");
    }
  }

  static async fetchCollectors() {
    this.validateFirebase();

    const db = window.firebaseDB;
    const usersQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.USERS),
      where("idRol", "==", COLLECTOR_ROLE_ID)
    );

    const querySnapshot = await getDocs(usersQuery);
    return this.mapCollectorsFromSnapshot(querySnapshot);
  }

  static mapCollectorsFromSnapshot(querySnapshot) {
    const collectors = [];

    querySnapshot.forEach((doc) => {
      const userData = doc.data();

      if (this.isValidCollectorData(userData)) {
        collectors.push(this.createCollectorObject(doc.id, userData));
      }
    });

    return collectors;
  }

  static isValidCollectorData(userData) {
    return userData.nombreUsuario || (userData.nombre && userData.apellido);
  }

  static createCollectorObject(docId, userData) {
    return {
      id: docId,
      idRol: userData.idRol,
      nombre: userData.nombreUsuario || userData.nombre || "Sin nombre",
      apellido: userData.apellido || "",
      rol: userData.idRol || COLLECTOR_ROLE_ID,
      escuela: userData.escuelaID || userData.escuela || "No especificada",
      ciclo: userData.ciclo || "No especificado",
      correo: userData.correo || "",
      telefono: userData.celular || userData.telefono || "",
      codigoUsuario: userData.codigoUsuario || "",
      facultad: userData.facultadID || "",
    };
  }
}

// =============================================
// GENERADOR DE HTML
// =============================================
class HTMLGenerator {
  static createModalHTML(state) {
    return `
      <div class="modal fade" id="${
        DOM_IDS.MODAL
      }" tabindex="-1" aria-labelledby="donationCollectorsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            ${this.createModalHeader()}
            ${this.createModalBody(state)}
            ${this.createModalFooter(state)}
          </div>
        </div>
      </div>
    `;
  }

  static createModalHeader() {
    return `
      <div class="modal-header bg-primary text-white">
        <h5 class="modal-title" id="donationCollectorsModalLabel">
          <i class="fas fa-hand-holding-heart me-2"></i>
          Seleccionar Recolectores de Donaciones
        </h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
    `;
  }

  static createModalBody(state) {
    return `
      <div class="modal-body">
        ${this.createInfoAlert()}
        ${this.createSelectionControls(state)}
        ${this.createCollectorsContainer(state)}
      </div>
    `;
  }

  static createInfoAlert() {
    return `
      <div class="selection-info mb-3">
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          Selecciona los usuarios que se encargarán de recolectar las donaciones para este evento.
          Solo se muestran usuarios con roles autorizados para manejo de donaciones.
        </div>
      </div>
    `;
  }

  static createSelectionControls(state) {
    return `
      <div class="selection-controls mb-3">
        <div class="d-flex justify-content-between align-items-center">
          <div class="selection-stats">
            <span class="badge bg-secondary">
              <i class="fas fa-users me-1"></i>
              Seleccionados: <span id="${DOM_IDS.SELECTED_COUNT}">${state.selectedCollectors.length}</span>
            </span>
          </div>
          <div class="selection-buttons">
            <button type="button" class="btn btn-sm btn-outline-primary me-2" id="selectAllCollectors">
              <i class="fas fa-check-double me-1"></i>
              Seleccionar Todos
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="deselectAllCollectors">
              <i class="fas fa-times me-1"></i>
              Deseleccionar Todos
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static createCollectorsContainer(state) {
    const content =
      state.availableCollectors.length === 0
        ? this.createEmptyState()
        : this.createCollectorsGrid(state);

    return `
      <div class="collectors-container" id="${DOM_IDS.COLLECTORS_CONTAINER}" style="max-height: 400px; overflow-y: auto;">
        ${content}
      </div>
    `;
  }

  static createEmptyState() {
    return `
      <div class="text-center py-4">
        <i class="fas fa-users fa-2x text-muted mb-3"></i>
        <p class="text-muted">No hay recolectores disponibles</p>
      </div>
    `;
  }

  static createCollectorsGrid(state) {
    const cards = state.availableCollectors
      .map((collector) => this.createCollectorCard(collector, state))
      .join("");

    return `<div class="row g-3" id="collectorsGrid">${cards}</div>`;
  }

  static createCollectorCard(collector, state) {
    const isSelected = state.isCollectorSelected(collector.id);
    const selectedClass = isSelected ? CSS_CLASSES.SELECTED_CARD : "";

    return `
      <div class="col-12 col-md-6">
        <div class="card ${CSS_CLASSES.COLLECTOR_CARD} ${selectedClass}" 
             data-collector-id="${collector.id}" 
             style="cursor: pointer;">
          <div class="card-body p-3">
            ${this.createCollectorCheckbox(collector, isSelected)}
          </div>
        </div>
      </div>
    `;
  }

  static createCollectorCheckbox(collector, isSelected) {
    return `
      <div class="form-check">
        <input class="form-check-input ${CSS_CLASSES.COLLECTOR_CHECKBOX}" 
               type="checkbox" 
               id="collector_${collector.id}" 
               value="${collector.id}"
               ${isSelected ? "checked" : ""}>
        <label class="form-check-label ms-2" for="collector_${collector.id}">
          ${this.createCollectorInfo(collector)}
        </label>
      </div>
    `;
  }

  static createCollectorInfo(collector) {
    return `
      <div class="d-flex align-items-center">
        <div class="me-3">
          <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" 
               style="width: 40px; height: 40px;">
            <i class="fas fa-user"></i>
          </div>
        </div>
        <div class="flex-grow-1">
          <h6 class="mb-1 fw-bold">${collector.nombre} ${collector.apellido}</h6>
          <small class="text-muted d-block">
            <i class="fas fa-school me-1"></i>${collector.escuela}
          </small>
          <small class="text-muted">
            <i class="fas fa-graduation-cap me-1"></i>Ciclo: ${collector.ciclo}
          </small>
        </div>
      </div>
    `;
  }

  static createModalFooter(state) {
    const isDisabled = state.selectedCollectors.length === 0;

    return `
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
          <i class="fas fa-times me-1"></i>
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" id="${
          DOM_IDS.CONFIRM_BUTTON
        }" 
                ${isDisabled ? "disabled" : ""}>
          <i class="fas fa-check me-1"></i>
          Confirmar Selección
        </button>
      </div>
    `;
  }

  static createSelectedCollectorsView(collectors) {
    if (collectors.length === 0) {
      return `
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          No hay recolectores seleccionados
        </div>
      `;
    }

    const collectorsHtml = collectors
      .map((collector) => this.createSelectedCollectorItem(collector))
      .join("");

    return `
      <div class="selected-collectors-list">
        <h6 class="mb-3">
          <i class="fas fa-users me-2"></i>
          Recolectores Seleccionados (${collectors.length})
        </h6>
        ${collectorsHtml}
      </div>
    `;
  }

  static createSelectedCollectorItem(collector) {
    return `
      <div class="selected-collector-item mb-2">
        <div class="card">
          <div class="card-body py-2">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong>${collector.nombre} ${collector.apellido}</strong>
                <small class="text-muted d-block">${collector.escuela} - Ciclo ${collector.ciclo}</small>
              </div>
              <button type="button" class="btn btn-sm btn-outline-danger" 
                      onclick="collectorsManager.removeSelectedCollector('${collector.id}')">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// =============================================
// MANEJADOR DE MODALES
// =============================================
class ModalManager {
  static show(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (window.bootstrap?.Modal) {
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
    } else {
      this.showManually(modal);
    }
  }

  static hide(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (window.bootstrap?.Modal) {
      const bsModal = bootstrap.Modal.getInstance(modal);
      bsModal?.hide();
    } else {
      this.hideManually(modal);
    }
  }

  static showManually(modal) {
    modal.style.display = "block";
    modal.classList.add("show");
    document.body.classList.add("modal-open");
  }

  static hideManually(modal) {
    modal.style.display = "none";
    modal.classList.remove("show");
    document.body.classList.remove("modal-open");
    setTimeout(() => modal.remove(), 300);
  }

  static removeExisting(modalId) {
    const existingModal = document.getElementById(modalId);
    existingModal?.remove();
  }
}

// =============================================
// CONTROLADOR PRINCIPAL
// =============================================
class DonationCollectorsManager {
  constructor() {
    this.state = new CollectorsState();
    this.init();
  }

  init() {
    console.log("🔧 Inicializando módulo de recolectores de donaciones...");
    this.exposeGlobalMethods();
    console.log("✅ Módulo de recolectores inicializado");
  }

  async showModal() {
    console.log("🎯 Iniciando modal de recolectores...");

    try {
      await this.loadCollectors();
      this.createModal();
      ModalManager.show(DOM_IDS.MODAL);
    } catch (error) {
      console.error("❌ Error mostrando modal de recolectores:", error);
      this.showErrorMessage(error.message);
    }
  }

  async loadCollectors() {
    if (this.state.isLoading) {
      console.log("⏳ Ya se están cargando los recolectores...");
      return;
    }

    this.state.isLoading = true;

    try {
      console.log("📥 Cargando recolectores desde Firestore...");
      this.state.availableCollectors = await FirebaseService.fetchCollectors();
      console.log(
        `✅ ${this.state.availableCollectors.length} recolectores cargados`
      );
    } catch (error) {
      console.error("❌ Error cargando recolectores:", error);
      throw new Error("No se pudieron cargar los recolectores disponibles");
    } finally {
      this.state.isLoading = false;
    }
  }

  createModal() {
    ModalManager.removeExisting(DOM_IDS.MODAL);

    const modalHtml = HTMLGenerator.createModalHTML(this.state);
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    this.setupModalEvents();
  }

  setupModalEvents() {
    const modal = document.getElementById(DOM_IDS.MODAL);
    if (!modal) return;

    this.setupCheckboxEvents(modal);
    this.setupButtonEvents(modal);
    this.setupModalCloseEvents(modal);
  }

  setupCheckboxEvents(modal) {
    const checkboxes = modal.querySelectorAll(
      `.${CSS_CLASSES.COLLECTOR_CHECKBOX}`
    );

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        this.handleCheckboxChange(event.target);
      });
    });
  }

  setupButtonEvents(modal) {
    const selectAllBtn = modal.querySelector("#selectAllCollectors");
    const deselectAllBtn = modal.querySelector("#deselectAllCollectors");
    const confirmBtn = modal.querySelector(`#${DOM_IDS.CONFIRM_BUTTON}`);

    selectAllBtn?.addEventListener("click", () => this.selectAll());
    deselectAllBtn?.addEventListener("click", () => this.deselectAll());
    confirmBtn?.addEventListener("click", () => this.confirmSelection());
  }

  setupModalCloseEvents(modal) {
    modal.addEventListener("hidden.bs.modal", () => {
      setTimeout(() => modal.remove(), 300);
    });

    const closeBtn = modal.querySelector(".btn-close");
    closeBtn?.addEventListener("click", () => this.closeModal());
  }

  handleCheckboxChange(checkbox) {
    const card = checkbox.closest(`.${CSS_CLASSES.COLLECTOR_CARD}`);
    const collectorId = checkbox.value;

    if (checkbox.checked) {
      card.classList.add(...CSS_CLASSES.SELECTED_CARD.split(" "));
      this.addCollectorToSelection(collectorId);
    } else {
      card.classList.remove(...CSS_CLASSES.SELECTED_CARD.split(" "));
      this.state.removeCollector(collectorId);
    }

    this.updateUI();
  }

  addCollectorToSelection(collectorId) {
    const collector = this.state.availableCollectors.find(
      (c) => c.id === collectorId
    );
    if (collector) {
      this.state.addCollector(collector);
      console.log(
        `✅ Recolector agregado: ${collector.nombre} ${collector.apellido}`
      );
    }
  }

  selectAll() {
    this.state.selectAll();
    this.updateAllCheckboxes(true);
    this.updateUI();
  }

  deselectAll() {
    this.state.reset();
    this.updateAllCheckboxes(false);
    this.updateUI();
  }

  updateAllCheckboxes(checked) {
    document
      .querySelectorAll(`.${CSS_CLASSES.COLLECTOR_CHECKBOX}`)
      .forEach((checkbox) => {
        checkbox.checked = checked;
        const card = checkbox.closest(`.${CSS_CLASSES.COLLECTOR_CARD}`);

        if (checked) {
          card.classList.add(...CSS_CLASSES.SELECTED_CARD.split(" "));
        } else {
          card.classList.remove(...CSS_CLASSES.SELECTED_CARD.split(" "));
        }
      });
  }

  updateUI() {
    this.updateSelectedCount();
    this.updateConfirmButton();
  }

  updateSelectedCount() {
    const countElement = document.getElementById(DOM_IDS.SELECTED_COUNT);
    if (countElement) {
      countElement.textContent = this.state.selectedCollectors.length;
    }
  }

  updateConfirmButton() {
    const confirmButton = document.getElementById(DOM_IDS.CONFIRM_BUTTON);
    if (confirmButton) {
      confirmButton.disabled = this.state.selectedCollectors.length === 0;
    }
  }

  confirmSelection() {
    console.log(
      "✅ Confirmando selección de recolectores:",
      this.state.selectedCollectors
    );

    this.updateSelectedCollectorsView();
    this.closeModal();

    if (this.state.selectedCollectors.length > 0) {
      const names = this.state.selectedCollectors
        .map((c) => `${c.nombre} ${c.apellido}`)
        .join(", ");
      console.log(
        `🎉 ${this.state.selectedCollectors.length} recolector(es) seleccionado(s): ${names}`
      );
    }
  }

  updateSelectedCollectorsView() {
    const container = document.getElementById(DOM_IDS.SELECTED_RECEPTORS);
    if (!container) {
      console.warn(
        `⚠️ Contenedor '${DOM_IDS.SELECTED_RECEPTORS}' no encontrado`
      );
      return;
    }

    container.innerHTML = HTMLGenerator.createSelectedCollectorsView(
      this.state.selectedCollectors
    );
  }

  removeSelectedCollector(collectorId) {
    console.log(`🗑️ Removiendo recolector: ${collectorId}`);

    this.state.removeCollector(collectorId);
    this.updateSelectedCollectorsView();
    this.updateModalCheckbox(collectorId, false);

    console.log(`✅ Recolector removido: ${collectorId}`);
  }

  updateModalCheckbox(collectorId, checked) {
    const checkbox = document.querySelector(`#collector_${collectorId}`);
    if (checkbox) {
      checkbox.checked = checked;
      const card = checkbox.closest(`.${CSS_CLASSES.COLLECTOR_CARD}`);
      if (card) {
        if (checked) {
          card.classList.add(...CSS_CLASSES.SELECTED_CARD.split(" "));
        } else {
          card.classList.remove(...CSS_CLASSES.SELECTED_CARD.split(" "));
        }
      }
    }
  }

  closeModal() {
    ModalManager.hide(DOM_IDS.MODAL);
  }

  showErrorMessage(message) {
    alert(`Error cargando recolectores: ${message}`);
  }

  // Métodos públicos para la API
  getSelectedCollectors() {
    return this.state.getSelectedIds();
  }

  getSelectedCollectorsDetails() {
    return [...this.state.selectedCollectors];
  }

  resetSelection() {
    this.state.reset();
    this.updateSelectedCollectorsView();
    console.log("🔄 Selección de recolectores reseteada");
  }

  // Exposición de métodos globales
  exposeGlobalMethods() {
    window.showDonationCollectorsModal = () => this.showModal();
    window.getSelectedCollectors = () => this.getSelectedCollectors();
    window.getSelectedCollectorsDetails = () =>
      this.getSelectedCollectorsDetails();
    window.resetCollectorSelection = () => this.resetSelection();
    window.collectorsManager = this;
  }
}

// =============================================
// INICIALIZACIÓN
// =============================================
function initializeModule() {
  const manager = new DonationCollectorsManager();
  console.log("📦 Módulo donation-collectors.js cargado correctamente");
  return manager;
}

// Auto-inicialización
let collectorsManager;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    collectorsManager = initializeModule();
  });
} else {
  collectorsManager = initializeModule();
}

export { DonationCollectorsManager };
