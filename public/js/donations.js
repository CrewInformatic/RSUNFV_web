class DonationFlowController {
  constructor() {
    this.state = {
      selectedAmount: 0,
      donorType: null,
      donorData: {},
      selectedCollector: null,
      collectorsData: [],
    };

    this.modals = {};
    this.elements = {};

    this.init();
  }

  // Constants
  static get DONOR_TYPES() {
    return {
      INDIVIDUAL: "individual",
      COMPANY: "company",
    };
  }

  static get VALIDATION_RULES() {
    return {
      dni: { length: 8, message: "El DNI debe tener 8 dígitos" },
      ruc: { length: 11, message: "El RUC debe tener 11 dígitos" },
      phone: { length: 9, message: "El teléfono debe tener 9 dígitos" },
      email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: "Ingresa un email válido",
      },
    };
  }

  static get TOAST_TYPES() {
    return {
      SUCCESS: { class: "bg-success", icon: "fa-check-circle" },
      WARNING: { class: "bg-warning", icon: "fa-exclamation-triangle" },
      ERROR: { class: "bg-danger", icon: "fa-times-circle" },
      INFO: { class: "bg-primary", icon: "fa-info-circle" },
    };
  }

  static get REQUIRED_FIELDS() {
    return {
      individual: ["firstName", "lastName", "dni", "phone", "email"],
      company: ["companyName", "ruc", "representative", "position", "email"],
    };
  }

  /**
   * Initialize the donation flow controller
   */
  init() {
    this.cacheElements();
    this.initializeModals();
    this.setupEventListeners();
  }

  /**
   * Cache DOM elements for better performance
   */
  cacheElements() {
    this.elements = {
      // Amount selection
      amountButtons: document.querySelectorAll(".amount-btn"),
      customAmountInput: document.getElementById("customAmountInput"),
      startDonationBtn: document.getElementById("startDonationBtn"),

      // Donor type
      donorTypeCards: document.querySelectorAll(".donor-type-card"),

      // Forms
      donorForm: document.getElementById("donorForm"),
      individualForm: document.getElementById("individualForm"),
      companyForm: document.getElementById("companyForm"),

      // Navigation
      goBackToType: document.getElementById("goBackToType"),
      continueToCollectors: document.getElementById("continueToCollectors"),
      goBackToData: document.getElementById("goBackToData"),
      continueToPayment: document.getElementById("continueToPayment"),

      // Displays
      selectedAmountDisplay: document.getElementById("selectedAmountDisplay"),
      selectedAmount2: document.getElementById("selectedAmount2"),
      donorNameDisplay: document.getElementById("donorNameDisplay"),
      donorDataModalLabel: document.getElementById("donorDataModalLabel"),

      // Collectors
      collectorsGrid: document.getElementById("collectorsGrid"),

      // Templates
      collectorCardTemplate: document.getElementById("collector-card-template"),
      toastTemplate: document.getElementById("toast-template"),
      toastContainer: document.getElementById("toast-container"),
      // Elementos del modal de pago (AGREGAR ESTOS)
      paymentModal: document.getElementById("paymentModal"),
      paymentAmount: document.getElementById("paymentAmount"),
      goBackToCollectors: document.getElementById("goBackToCollectors"),
      confirmPaymentBtn: document.getElementById("confirmPaymentBtn"),

      // Elementos para mostrar datos del recolector seleccionado
      selectedCollectorName: document.getElementById("selectedCollectorName"),
      selectedCollectorEmail: document.getElementById("selectedCollectorEmail"),
      selectedCollectorPhone: document.getElementById("selectedCollectorPhone"),
      selectedCollectorFaculty: document.getElementById(
        "selectedCollectorFaculty"
      ),
    };
  }

  /**
   * Initialize Bootstrap modals
   */
  initializeModals() {
    const modalIds = [
      "donorTypeModal",
      "donorDataModal",
      "collectorsModal",
      "paymentModal",
    ];

    modalIds.forEach((modalId) => {
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        this.modals[modalId] = new bootstrap.Modal(modalElement);
        modalElement.addEventListener("hidden.bs.modal", () =>
          this.resetFlow()
        );
      }
    });

    this.hidePaymentButton();
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    this.setupAmountSelection();
    this.setupDonorTypeSelection();
    this.setupFormNavigation();
    this.setupFormValidation();
    this.setupCollectorSelection();
    this.setupPaymentFlow();
  }
  setupPaymentFlow() {
    // Botón para volver a recolectores desde pago
    this.elements.goBackToCollectors?.addEventListener("click", () => {
      this.goBackToCollectors();
    });

    // Botón para confirmar pago
    this.elements.confirmPaymentBtn?.addEventListener("click", () => {
      this.handlePaymentConfirmation();
    });
  }
  /**
   * Setup amount selection functionality
   */
  setupAmountSelection() {
    // Preset amount buttons
    this.elements.amountButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleAmountSelection(button);
      });
    });

    // Custom amount input
    this.elements.customAmountInput?.addEventListener("input", (e) => {
      this.handleCustomAmount(e.target.value);
    });

    // Start donation button
    this.elements.startDonationBtn?.addEventListener("click", () => {
      this.handleStartDonation();
    });
  }

  handleAmountSelection(button) {
    const amount = parseInt(button.dataset.amount, 10);
    this.setSelectedAmount(amount);
    this.updateAmountButtonsUI(button);
    this.clearCustomAmountInput();
  }

  handleCustomAmount(value) {
    const amount = parseInt(value, 10) || 0;
    if (amount > 0) {
      this.setSelectedAmount(amount);
      this.clearAmountButtonsUI();
    } else {
      this.state.selectedAmount = 0;
    }
  }

  handleStartDonation() {
    if (this.state.selectedAmount === 0) {
      this.showToast("Por favor selecciona un monto para donar", "warning");
      return;
    }
    this.updateAmountDisplay();
    this.modals.donorTypeModal.show();
  }

  setupDonorTypeSelection() {
    this.elements.donorTypeCards.forEach((card) => {
      card.addEventListener("click", () => {
        this.handleDonorTypeSelection(card);
      });
    });
  }

  handleDonorTypeSelection(card) {
    const type = card.dataset.type;
    this.setDonorType(type);
    this.updateDonorTypeCardsUI(card);

    setTimeout(() => {
      this.proceedToDataCollection();
    }, 500);
  }

  setupFormNavigation() {
    const navigationHandlers = {
      goBackToType: () => this.goBackToTypeSelection(),
      continueToCollectors: () => this.handleContinueToCollectors(),
      goBackToData: () => this.goBackToDataForm(),
      continueToPayment: () => this.handleContinueToPayment(),
    };

    Object.entries(navigationHandlers).forEach(([elementKey, handler]) => {
      this.elements[elementKey]?.addEventListener("click", handler);
    });
  }

  handleContinueToCollectors() {
    if (this.validateDonorForm()) {
      this.collectDonorData();
      this.proceedToCollectorSelection();
    }
  }

  handleContinueToPayment() {
    if (this.state.selectedCollector) {
      this.proceedToPayment();
    } else {
      this.showToast("Por favor selecciona un recolector", "warning");
    }
  }

  setupFormValidation() {
    const form = this.elements.donorForm;
    if (!form) return;

    const inputs = form.querySelectorAll("input[required]");

    inputs.forEach((input) => {
      input.addEventListener("blur", () => this.validateField(input));
      input.addEventListener("input", () => this.clearFieldError(input));
    });

    this.setupFieldFormatting();
  }

  setupFieldFormatting() {
    const formatters = {
      dni: (value) => value.replace(/\D/g, "").substring(0, 8),
      ruc: (value) => value.replace(/\D/g, "").substring(0, 11),
      phone: (value) => value.replace(/\D/g, "").substring(0, 9),
    };

    Object.entries(formatters).forEach(([name, formatter]) => {
      const input = this.elements.donorForm?.querySelector(
        `input[name="${name}"]`
      );
      if (input) {
        input.addEventListener("input", (e) => {
          e.target.value = formatter(e.target.value);
        });
      }
    });
  }

  setupCollectorSelection() {
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("retry-btn")) {
        this.loadCollectors();
      }
    });
  }

  setSelectedAmount(amount) {
    this.state.selectedAmount = amount;
    console.log(`Amount selected: S/ ${amount}`);
  }

  setDonorType(type) {
    this.state.donorType = type;
    console.log(`Donor type selected: ${type}`);
  }

  updateAmountButtonsUI(selectedButton) {
    this.clearAmountButtonsUI();
    selectedButton.classList.add("active");
  }

  clearAmountButtonsUI() {
    this.elements.amountButtons.forEach((btn) => {
      btn.classList.remove("active");
    });
  }

  clearCustomAmountInput() {
    if (this.elements.customAmountInput) {
      this.elements.customAmountInput.value = "";
    }
  }

  updateAmountDisplay() {
    const displays = [
      this.elements.selectedAmountDisplay,
      this.elements.selectedAmount2,
    ];

    displays.forEach((display) => {
      if (display) {
        display.textContent = this.state.selectedAmount;
      }
    });
  }

  updateDonorTypeCardsUI(selectedCard) {
    this.elements.donorTypeCards.forEach((card) => {
      card.classList.remove("border-primary", "bg-light");
    });
    selectedCard.classList.add("border-primary", "bg-light");
  }

  proceedToDataCollection() {
    this.modals.donorTypeModal.hide();
    this.toggleDonorForms();
    this.updateModalTitle();

    setTimeout(() => {
      this.modals.donorDataModal.show();
    }, 300);
  }

  toggleDonorForms() {
    const isIndividual =
      this.state.donorType === DonationFlowController.DONOR_TYPES.INDIVIDUAL;

    if (this.elements.individualForm) {
      this.elements.individualForm.style.display = isIndividual
        ? "block"
        : "none";
    }

    if (this.elements.companyForm) {
      this.elements.companyForm.style.display = isIndividual ? "none" : "block";
    }

    this.updateRequiredFields(this.state.donorType);
  }

  updateModalTitle() {
    const titleText =
      this.state.donorType === DonationFlowController.DONOR_TYPES.INDIVIDUAL
        ? "Completa tus Datos Personales"
        : "Completa los Datos de la Empresa";

    if (this.elements.donorDataModalLabel) {
      this.elements.donorDataModalLabel.innerHTML = `<i class="fas fa-id-card me-2"></i>${titleText}`;
    }
  }

  updateRequiredFields(type) {
    const form = this.elements.donorForm;
    if (!form) return;

    // Clear all required attributes
    form.querySelectorAll("input").forEach((input) => {
      input.removeAttribute("required");
    });

    const requiredFields = DonationFlowController.REQUIRED_FIELDS[type] || [];

    requiredFields.forEach((fieldName) => {
      const field = form.querySelector(`input[name="${fieldName}"]`);
      if (field) {
        field.setAttribute("required", "required");
      }
    });

    const termsCheck = document.getElementById("termsCheck");
    if (termsCheck) {
      termsCheck.setAttribute("required", "required");
    }
  }

  validateDonorForm() {
    const form = this.elements.donorForm;
    if (!form) return false;

    const requiredInputs = form.querySelectorAll("input[required]");
    let isValid = true;

    requiredInputs.forEach((input) => {
      if (!this.validateField(input)) {
        isValid = false;
      }
    });

    return isValid;
  }

  validateField(input) {
    const value = input.value.trim();
    const validation = this.getFieldValidation(input, value);

    if (validation.isValid) {
      this.clearFieldError(input);
    } else {
      this.showFieldError(input, validation.message);
    }

    return validation.isValid;
  }

  getFieldValidation(input, value) {
    // Required field validation
    if (input.hasAttribute("required") && !value) {
      return { isValid: false, message: "Este campo es obligatorio" };
    }

    if (!value) {
      return { isValid: true, message: "" };
    }

    const rules = DonationFlowController.VALIDATION_RULES;
    const fieldName = input.name;

    if (fieldName === "email" && !rules.email.pattern.test(value)) {
      return { isValid: false, message: rules.email.message };
    }

    if (["dni", "ruc", "phone"].includes(fieldName)) {
      const rule = rules[fieldName];
      if (rule && value.length !== rule.length) {
        return { isValid: false, message: rule.message };
      }
    }

    return { isValid: true, message: "" };
  }

  showFieldError(input, message) {
    this.clearFieldError(input);
    input.classList.add("is-invalid");

    const errorDiv = document.createElement("div");
    errorDiv.className = "invalid-feedback";
    errorDiv.textContent = message;
    input.parentNode.appendChild(errorDiv);
  }

  clearFieldError(input) {
    input.classList.remove("is-invalid");
    const errorDiv = input.parentNode.querySelector(".invalid-feedback");
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  collectDonorData() {
    const form = this.elements.donorForm;
    if (!form) return;

    const formData = new FormData(form);

    this.state.donorData = {
      type: this.state.donorType,
      amount: this.state.selectedAmount,
      ...this.getTypeSpecificData(formData),
      ...this.getCommonData(formData),
    };

    console.log("Donor data collected:", this.state.donorData);
  }

  getTypeSpecificData(formData) {
    if (
      this.state.donorType === DonationFlowController.DONOR_TYPES.INDIVIDUAL
    ) {
      const firstName = formData.get("firstName");
      const lastName = formData.get("lastName");

      return {
        firstName,
        lastName,
        dni: formData.get("dni"),
        phone: formData.get("phone"),
        fullName: `${firstName} ${lastName}`,
      };
    }

    const companyName = formData.get("companyName");
    return {
      companyName,
      ruc: formData.get("ruc"),
      representative: formData.get("representative"),
      position: formData.get("position"),
      fullName: companyName,
    };
  }

  getCommonData(formData) {
    return {
      email: formData.get("email"),
      address: formData.get("address"),
      message: formData.get("message"),
      newsletter: formData.has("newsletterCheck"),
    };
  }

  proceedToCollectorSelection() {
    this.modals.donorDataModal.hide();
    this.updateDonorNameDisplay();

    setTimeout(() => {
      this.modals.collectorsModal.show();
      this.loadCollectors();
    }, 300);
  }

  updateDonorNameDisplay() {
    if (this.elements.donorNameDisplay) {
      this.elements.donorNameDisplay.textContent =
        this.state.donorData.fullName;
    }
  }

  async loadCollectors() {
    const collectorsGrid = this.elements.collectorsGrid;
    if (!collectorsGrid) return;

    try {
      this.showLoadingState(collectorsGrid);

      const { CollectorsService } = await import("./collectors-service.js");
      this.state.collectorsData =
        await CollectorsService.getCollectorsWithFallback();

      if (this.state.collectorsData.length === 0) {
        this.showNoCollectorsState(collectorsGrid);
        return;
      }

      this.renderCollectors(collectorsGrid, this.state.collectorsData);
      console.log(`${this.state.collectorsData.length} recolectores cargados`);
    } catch (error) {
      console.error("Error loading collectors:", error);
      this.showErrorState(collectorsGrid);
      this.showToast("Error al cargar recolectores", "error");
    }
  }

  showLoadingState(container) {
    const template = document.getElementById("collectors-loading-template");

    if (template) {
      container.innerHTML = "";
      container.appendChild(template.content.cloneNode(true));
    } else {
      container.innerHTML = this.getLoadingHTML();
    }
  }

  getLoadingHTML() {
    return `
      <div class="col-12 text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando recolectores...</span>
        </div>
        <p class="mt-2 text-muted">Buscando recolectores disponibles...</p>
      </div>
    `;
  }

  showNoCollectorsState(container) {
    const template = document.getElementById("no-collectors-template");

    if (template) {
      container.innerHTML = "";
      container.appendChild(template.content.cloneNode(true));
    } else {
      container.innerHTML = this.getNoCollectorsHTML();
    }
  }

  getNoCollectorsHTML() {
    return `
      <div class="col-12 text-center py-4">
        <i class="fas fa-users fa-3x text-muted mb-3"></i>
        <h5>No hay recolectores disponibles</h5>
        <p class="text-muted">
          No se encontraron recolectores en este momento.
          Por favor intenta más tarde.
        </p>
        <button class="btn btn-outline-primary retry-btn">
          <i class="fas fa-refresh me-2"></i>Reintentar
        </button>
      </div>
    `;
  }

  showErrorState(container) {
    container.innerHTML = `
      <div class="col-12 text-center py-4">
        <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
        <h5>Error al cargar recolectores</h5>
        <p class="text-muted">
          Hubo un problema al cargar los recolectores.
          Por favor intenta nuevamente.
        </p>
        <button class="btn btn-outline-primary retry-btn">
          <i class="fas fa-refresh me-2"></i>Reintentar
        </button>
      </div>
    `;
  }

  renderCollectors(container, collectors) {
    container.innerHTML = "";
    collectors.forEach((collector) => {
      const collectorCard = this.createCollectorCard(collector);
      container.appendChild(collectorCard);
    });
  }

  createCollectorCard(collector) {
    const template = this.elements.collectorCardTemplate;
    let cardElement;

    if (template) {
      cardElement = template.content.cloneNode(true);
    } else {
      cardElement = this.createCollectorCardFallback();
    }

    this.populateCollectorCard(cardElement, collector);
    this.addCollectorClickHandler(cardElement, collector);

    return cardElement;
  }

  createCollectorCardFallback() {
    const cardElement = document.createElement("div");
    cardElement.innerHTML = this.getCollectorCardHTML();
    return cardElement.firstElementChild;
  }

  getCollectorCardHTML() {
    return `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card collector-card h-100 shadow-sm">
          <div class="card-body text-center p-3">
            <div class="position-relative mb-3">
              <img class="collector-photo rounded-circle border border-2 border-light shadow-sm" 
                   width="80" height="80" alt="Foto del recolector">
              <div class="position-absolute bottom-0 end-0">
                <span class="badge bg-success rounded-pill">
                  <i class="fas fa-check fa-xs"></i>
                </span>
              </div>
            </div>
            <h6 class="card-title mb-2 fw-bold collector-name"></h6>
            <div class="row g-1 mb-3">
              <div class="col-6">
                <small class="text-warning d-block">
                  <i class="fas fa-star"></i>
                  <span class="collector-rating"></span>
                </small>
              </div>
              <div class="col-6">
                <small class="text-danger d-block">
                  <i class="fas fa-heart"></i>
                  <span class="collector-donations"></span>
                </small>
              </div>
            </div>
            <div class="mb-2">
              <small class="text-muted d-block">
                <i class="fas fa-clock me-1"></i>
                <span class="collector-experience"></span>
              </small>
            </div>
            <div class="mb-3">
              <small class="text-muted d-block">
                <i class="fas fa-map-marker-alt me-1"></i>
                <span class="collector-location"></span>
              </small>
            </div>
            <div class="collector-selection-indicator d-none">
              <i class="fas fa-check-circle text-primary fa-2x"></i>
              <small class="d-block text-primary fw-bold mt-1">Seleccionado</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  populateCollectorCard(cardElement, collector) {
    const elements = {
      photo: cardElement.querySelector(".collector-photo"),
      name: cardElement.querySelector(".collector-name"),
      rating: cardElement.querySelector(".collector-rating"),
      donations: cardElement.querySelector(".collector-donations"),
      experience: cardElement.querySelector(".collector-experience"),
      location: cardElement.querySelector(".collector-location"),
      card: cardElement.querySelector(".collector-card"),
    };

    if (elements.photo) {
      elements.photo.src = collector.fotoPerfil || collector.photo; // CAMBIAR ESTA LÍNEA
      elements.photo.alt = `Foto de ${
        collector.nombreUsuario || collector.name
      }`; // CAMBIAR ESTA LÍNEA
    }

    if (elements.name)
      elements.name.textContent = collector.nombreUsuario || collector.name; // CAMBIAR ESTA LÍNEA
    if (elements.rating) elements.rating.textContent = collector.rating;
    if (elements.donations)
      elements.donations.textContent = collector.donations;
    if (elements.experience)
      elements.experience.textContent = collector.experience;
    if (elements.location)
      elements.location.textContent =
        collector.facultadID || collector.location; // CAMBIAR ESTA LÍNEA

    if (elements.card) {
      elements.card.dataset.collectorId = collector.idUsuario || collector.id; // CAMBIAR ESTA LÍNEA
    }
  }

  addCollectorClickHandler(cardElement, collector) {
    const card = cardElement.querySelector(".collector-card");
    if (card) {
      card.addEventListener("click", () => {
        this.selectCollector(collector, card);
      });
    }
  }

  selectCollector(collector, cardElement) {
    this.clearCollectorSelection();
    this.markCollectorAsSelected(cardElement);
    this.state.selectedCollector = collector; // ESTO YA GUARDA TODOS LOS DATOS
    this.showPaymentButton();

    // VERIFICAR QUE LOS DATOS SE ESTÁN GUARDANDO CORRECTAMENTE
    console.log("Recolector seleccionado con todos los datos:", {
      id: collector.idUsuario || collector.id,
      name: collector.nombreUsuario || collector.name,
      email: collector.correo || collector.email,
      phone: collector.celular || collector.cellPhone,
      yape: collector.Yape,
      bankAccount: collector.cuentaBancaria,
      allData: collector, // MOSTRAR TODOS LOS DATOS
    });

    this.showToast(
      `Recolector ${collector.nombreUsuario || collector.name} seleccionado`,
      "success"
    );
  }

  clearCollectorSelection() {
    document.querySelectorAll(".collector-card").forEach((card) => {
      card.classList.remove("border-primary", "bg-light");
      const indicator = card.querySelector(".collector-selection-indicator");
      if (indicator) indicator.classList.add("d-none");
    });
  }

  markCollectorAsSelected(cardElement) {
    cardElement.classList.add("border-primary", "bg-light");
    const indicator = cardElement.querySelector(
      ".collector-selection-indicator"
    );
    if (indicator) indicator.classList.remove("d-none");
  }

  showPaymentButton() {
    const continueBtn = this.elements.continueToPayment;
    if (continueBtn) {
      continueBtn.style.display = "block";
      continueBtn.disabled = false;
    }
  }

  hidePaymentButton() {
    const continueBtn = this.elements.continueToPayment;
    if (continueBtn) {
      continueBtn.style.display = "none";
      continueBtn.disabled = true;
    }
  }

  proceedToPayment() {
    this.modals.collectorsModal.hide();
    this.updatePaymentModalWithData(); // CAMBIAR NOMBRE DEL MÉTODO

    setTimeout(() => {
      this.modals.paymentModal.show(); // MOSTRAR EL MODAL DE PAGO
      // Inicializar el controlador de pago
      this.initializePaymentController();
    }, 300);
  }
  async initializePaymentController() {
    try {
      const { PaymentController } = await import("./payment-controller.js");

      this.paymentController = new PaymentController({
        donationData: this.getDonationData(),
        collectorData: this.state.selectedCollector, // AGREGAR ESTA LÍNEA
        onPaymentComplete: (paymentData) =>
          this.handlePaymentComplete(paymentData),
        onGoBack: () => this.goBackToCollectors(),
      });

      await this.paymentController.initialize();
    } catch (error) {
      console.error("Error initializing payment controller:", error);
      this.showToast("Error al cargar métodos de pago", "error");
    }
  }
  updatePaymentModalWithCollector() {
    if (!this.state.selectedCollector) return;

    const elements = {
      name: document.getElementById("selectedCollectorName"),
      email: document.getElementById("selectedCollectorEmail"),
      phone: document.getElementById("selectedCollectorPhone"),
      faculty: document.getElementById("selectedCollectorFaculty"),
    };

    const collector = this.state.selectedCollector;

    if (elements.name) elements.name.textContent = collector.name;
    if (elements.email) elements.email.textContent = collector.email;
    if (elements.phone) elements.phone.textContent = collector.cellPhone;
    if (elements.faculty) elements.faculty.textContent = collector.location;
  }
  updatePaymentModalWithData() {
    if (!this.state.selectedCollector) return;

    const collector = this.state.selectedCollector;
    const amount = this.state.selectedAmount;

    if (this.elements.selectedCollectorName) {
      this.elements.selectedCollectorName.textContent =
        collector.nombreUsuario || collector.name; // CAMBIAR ESTA LÍNEA
    }
    if (this.elements.selectedCollectorEmail) {
      this.elements.selectedCollectorEmail.textContent =
        collector.correo || collector.email; // CAMBIAR ESTA LÍNEA
    }
    if (this.elements.selectedCollectorPhone) {
      this.elements.selectedCollectorPhone.textContent =
        collector.celular || collector.cellPhone; // CAMBIAR ESTA LÍNEA
    }
    if (this.elements.selectedCollectorFaculty) {
      this.elements.selectedCollectorFaculty.textContent =
        collector.facultadID || collector.location; // CAMBIAR ESTA LÍNEA
    }

    if (this.elements.paymentAmount) {
      this.elements.paymentAmount.textContent = amount;
    }
  }
  goBackToCollectors() {
    this.modals.paymentModal.hide();
    setTimeout(() => {
      this.modals.collectorsModal.show();
    }, 300);
  }
  handlePaymentComplete(paymentData) {
    // Guardar datos del pago
    this.state.paymentData = paymentData;

    // Cerrar modal de pago
    this.modals.paymentModal.hide();

    // Mostrar modal de confirmación
    setTimeout(() => {
      this.showConfirmationModal();
    }, 300);
  }

  handlePaymentConfirmation() {
    if (this.paymentController) {
      this.paymentController.confirmPayment();
    }
  }

  showConfirmationModal() {
    this.updateConfirmationModal();

    const confirmationModal = new bootstrap.Modal(
      document.getElementById("confirmationModal")
    );
    confirmationModal.show();
  }

  updateConfirmationModal() {
    const elements = {
      finalDonorName: document.getElementById("finalDonorName"),
      finalAmount: document.getElementById("finalAmount"),
      finalCollector: document.getElementById("finalCollector"),
      finalDate: document.getElementById("finalDate"),
      finalEmail: document.getElementById("finalEmail"),
    };

    if (elements.finalDonorName) {
      elements.finalDonorName.textContent = this.state.donorData.fullName;
    }
    if (elements.finalAmount) {
      elements.finalAmount.textContent = this.state.selectedAmount;
    }
    if (elements.finalCollector) {
      elements.finalCollector.textContent = this.state.selectedCollector.name;
    }
    if (elements.finalDate) {
      elements.finalDate.textContent = new Date().toLocaleDateString("es-PE");
    }
    if (elements.finalEmail) {
      elements.finalEmail.textContent = this.state.donorData.email;
    }
  }
  goBackToTypeSelection() {
    this.modals.donorDataModal.hide();
    setTimeout(() => {
      this.modals.donorTypeModal.show();
    }, 300);
  }

  goBackToDataForm() {
    this.modals.collectorsModal.hide();
    setTimeout(() => {
      this.modals.donorDataModal.show();
    }, 300);
  }

  resetFlow() {
    this.state = {
      selectedAmount: 0,
      donorType: null,
      donorData: {},
      selectedCollector: null,
      collectorsData: [],
      paymentData: null, // AGREGAR ESTA LÍNEA
    };

    // Limpiar controlador de pago
    if (this.paymentController) {
      this.paymentController.cleanup();
      this.paymentController = null;
    }

    this.clearAmountButtonsUI();
    this.clearCustomAmountInput();
    this.clearDonorTypeCards();
    this.clearForm();
    this.hidePaymentButton();
  }

  clearDonorTypeCards() {
    this.elements.donorTypeCards.forEach((card) => {
      card.classList.remove("border-primary", "bg-light");
    });
  }

  clearForm() {
    const form = this.elements.donorForm;
    if (form) {
      form.reset();
      form.querySelectorAll("input").forEach((input) => {
        this.clearFieldError(input);
      });
    }
  }

  showToast(message, type = "info") {
    const toastContainer = this.elements.toastContainer;
    const template = this.elements.toastTemplate;

    if (!template || !toastContainer) {
      console.warn("Toast template or container not found");
      return;
    }

    const toastElement = template.content.cloneNode(true);
    const toast = toastElement.querySelector(".toast");
    const toastMessage = toastElement.querySelector(".toast-message");
    const toastIcon = toastElement.querySelector(".fas");

    toastMessage.textContent = message;

    const config =
      DonationFlowController.TOAST_TYPES[type.toUpperCase()] ||
      DonationFlowController.TOAST_TYPES.INFO;

    toast.classList.add(config.class);
    toastIcon.classList.add(config.icon);

    toastContainer.appendChild(toastElement);

    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();

    toast.addEventListener("hidden.bs.toast", () => {
      toast.remove();
    });
  }

  getDonationData() {
    return {
      amount: this.state.selectedAmount,
      donorType: this.state.donorType,
      donorData: this.state.donorData,
      selectedCollector: {
        // AGREGAR ESTRUCTURA COMPLETA DEL RECOLECTOR
        id:
          this.state.selectedCollector.idUsuario ||
          this.state.selectedCollector.id,
        name:
          this.state.selectedCollector.nombreUsuario ||
          this.state.selectedCollector.name,
        email:
          this.state.selectedCollector.correo ||
          this.state.selectedCollector.email,
        phone:
          this.state.selectedCollector.celular ||
          this.state.selectedCollector.cellPhone,
        faculty:
          this.state.selectedCollector.facultadID ||
          this.state.selectedCollector.location,
        photo:
          this.state.selectedCollector.fotoPerfil ||
          this.state.selectedCollector.photo,
        code: this.state.selectedCollector.codigoUsuario,
        yape: this.state.selectedCollector.Yape,
        bankAccount: this.state.selectedCollector.cuentaBancaria,
        cycle: this.state.selectedCollector.ciclo,
        isActive: this.state.selectedCollector.estadoActivo,
        isAdmin: this.state.selectedCollector.esAdmin,
        lastAccess: this.state.selectedCollector.ultimoAcceso,
        // AGREGAR TODOS LOS CAMPOS DE LA BD
        rawData: this.state.selectedCollector, // MANTENER DATOS ORIGINALES
      },
      collectorsData: this.state.collectorsData,
      paymentData: this.state.paymentData || null,
      timestamp: new Date().toISOString(),
    };
  }

  getState() {
    return { ...this.state };
  }

  isValidAmount() {
    return this.state.selectedAmount > 0;
  }

  isDonorTypeSelected() {
    return this.state.donorType !== null;
  }

  isCollectorSelected() {
    return this.state.selectedCollector !== null;
  }

  hasValidDonorData() {
    return Object.keys(this.state.donorData).length > 0;
  }

  isFlowComplete() {
    return (
      this.isValidAmount() &&
      this.isDonorTypeSelected() &&
      this.hasValidDonorData() &&
      this.isCollectorSelected()
    );
  }
}

// Initialize donation flow when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.donationFlow = new DonationFlowController();
  console.log("Donation Flow Controller initialized");
});
