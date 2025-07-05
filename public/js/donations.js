class DonationFlowController {
  constructor() {
    this.state = {
      selectedAmount: 0,
      donorType: null,
      donorData: {},
      selectedCollector: null,
      collectorsData: [],
      selectedPaymentMethod: null,
      paymentMethods: [],
      uploadedFile: null,
      isLoading: false,
      isPaymentConfirmed: false,
    };
    this.modals = {};
    this.elements = {};
    this.init();
  }

  static get DONOR_TYPES() {
    return { INDIVIDUAL: "individual", COMPANY: "company" };
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

  init() {
    this.cacheElements();
    this.initializeModals();
    this.setupEventListeners();
  }

  cacheElements() {
    const selectors = {
      // Botones y inputs principales
      amountButtons: ".amount-btn",
      customAmountInput: "#customAmountInput",
      startDonationBtn: "#startDonationBtn",
      donorTypeCards: ".donor-type-card",
      // Formularios
      donorForm: "#donorForm",
      individualForm: "#individualForm",
      companyForm: "#companyForm",
      // Navegación
      goBackToType: "#goBackToType",
      continueToCollectors: "#continueToCollectors",
      goBackToData: "#goBackToData",
      goBackToCollectors: "#goBackToCollectors",
      // Displays
      selectedAmountDisplay: "#selectedAmountDisplay",
      selectedAmount2: "#selectedAmount2",
      donorNameDisplay: "#donorNameDisplay",
      paymentAmount: "#paymentAmount",
      // Recolectores
      collectorsGrid: "#collectorsGrid",
      selectedCollectorName: "#selectedCollectorName",
      selectedCollectorEmail: "#selectedCollectorEmail",
      selectedCollectorPhone: "#selectedCollectorPhone",
      selectedCollectorFaculty: "#selectedCollectorFaculty",
      // Pago
      paymentMethodsContainer: "#paymentMethodsContainer",
      uploadSection: "#uploadSection",
      fileDropZone: "#fileDropZone",
      paymentProofInput: "#paymentProofInput",
      filePreview: "#filePreview",
      confirmPaymentBtn: "#confirmPaymentBtn",
      // Toast
      toastContainer: "#toast-container",
      toastTemplate: "#toast-template",
    };

    this.elements = Object.fromEntries(
      Object.entries(selectors).map(([key, selector]) => [
        key,
        selector.startsWith(".")
          ? document.querySelectorAll(selector)
          : document.getElementById(selector.substring(1)),
      ])
    );
  }

  initializeModals() {
    [
      "donorTypeModal",
      "donorDataModal",
      "collectorsModal",
      "paymentModal",
      "confirmationModal",
    ].forEach((modalId) => {
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        this.modals[modalId] = new bootstrap.Modal(modalElement);

        // CAMBIO: Solo resetear cuando se cierra con X o click fuera
        modalElement.addEventListener("hidden.bs.modal", (e) => {
          // Solo resetear si se cerró manualmente (no por navegación programática)
          if (!modalElement.dataset.programmaticClose) {
            this.resetFlow();
          }
          // Limpiar el flag después del evento
          delete modalElement.dataset.programmaticClose;
        });
      }
    });
  }
  resetFlow() {
    console.log("Resetting donation flow...");

    // Resetear estado
    this.state = {
      selectedAmount: 0,
      donorType: null,
      donorData: {},
      selectedCollector: null,
      collectorsData: [],
      selectedPaymentMethod: null,
      paymentMethods: [],
      uploadedFile: null,
      isLoading: false,
      isPaymentConfirmed: false,
    };

    // Limpiar UI de montos
    this.clearAmountButtonsUI();
    this.clearCustomAmountInput();

    // Limpiar formularios
    this.clearForm();
    this.clearDonorTypeCards();

    // Limpiar selección de recolectores
    this.clearCollectorSelection();

    // Limpiar archivos subidos
    this.clearFileUpload();

    // Limpiar información de pago
    this.clearPaymentInfo();

    // Resetear displays
    this.resetDisplays();

    console.log("Flow reset complete");
  }

  hideModalProgrammatically(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      modalElement.dataset.programmaticClose = "true";
      this.modals[modalId].hide();
    }
  }

  clearPaymentInfo() {
    // Limpiar selección de método de pago
    document.querySelectorAll(".payment-method-card").forEach((card) => {
      card.classList.remove("selected", "border-primary", "bg-light");
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "";
    });

    // Limpiar información básica de pago
    const basicPaymentInfo = document.getElementById("basicPaymentInfo");
    if (basicPaymentInfo) {
      basicPaymentInfo.remove();
    }

    // Ocultar sección de subida
    if (this.elements.uploadSection) {
      this.elements.uploadSection.classList.add("d-none");
    }

    // Deshabilitar botón de confirmación
    this.disableConfirmButton();
  }

  // 11. AGREGAR MÉTODO resetDisplays()
  resetDisplays() {
    // Resetear displays de monto
    [
      this.elements.selectedAmountDisplay,
      this.elements.selectedAmount2,
      this.elements.paymentAmount,
    ].forEach((display) => {
      if (display) display.textContent = "0";
    });

    // Resetear display de nombre
    if (this.elements.donorNameDisplay) {
      this.elements.donorNameDisplay.textContent = "";
    }

    // Resetear información del recolector
    if (this.elements.selectedCollectorName) {
      this.elements.selectedCollectorName.textContent = "";
    }
    if (this.elements.selectedCollectorEmail) {
      this.elements.selectedCollectorEmail.textContent = "";
    }
    if (this.elements.selectedCollectorPhone) {
      this.elements.selectedCollectorPhone.textContent = "";
    }
    if (this.elements.selectedCollectorFaculty) {
      this.elements.selectedCollectorFaculty.textContent = "";
    }
  }

  showModalSafely(modalId) {
    setTimeout(() => {
      this.modals[modalId].show();
    }, 300);
  }
  setupEventListeners() {
    // Amount selection
    this.elements.amountButtons?.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const amount = parseInt(button.dataset.amount, 10);
        this.setSelectedAmount(amount);
        this.updateAmountButtonsUI(button);
        this.clearCustomAmountInput();
      });
    });

    this.elements.customAmountInput?.addEventListener("input", (e) => {
      const amount = parseInt(e.target.value, 10) || 0;
      if (amount > 0) {
        this.setSelectedAmount(amount);
        this.clearAmountButtonsUI();
      } else {
        this.state.selectedAmount = 0;
      }
    });

    this.elements.startDonationBtn?.addEventListener("click", () => {
      if (this.state.selectedAmount === 0) {
        this.showToast("Por favor selecciona un monto para donar", "warning");
        return;
      }
      this.updateAmountDisplay();
      this.modals.donorTypeModal.show();
    });

    // Donor type selection
    this.elements.donorTypeCards?.forEach((card) => {
      card.addEventListener("click", () => {
        const type = card.dataset.type;
        this.setDonorType(type);
        this.updateDonorTypeCardsUI(card);
        setTimeout(() => this.proceedToDataCollection(), 500);
      });
    });

    // Form navigation
    const navHandlers = {
      goBackToType: () => this.goBackToTypeSelection(),
      continueToCollectors: () => this.handleContinueToCollectors(),
      goBackToData: () => this.goBackToDataForm(),
      goBackToCollectors: () => this.goBackToCollectors(),
      confirmPaymentBtn: () => this.handlePaymentConfirmation(),
    };

    Object.entries(navHandlers).forEach(([key, handler]) => {
      this.elements[key]?.addEventListener("click", handler);
    });

    // Form validation
    this.setupFormValidation();
    this.setupCollectorSelection();
    this.setupFileUpload();
  }
  goBackToDataForm() {
    this.hideModalProgrammatically("collectorsModal");
    this.showModalSafely("donorDataModal");
  }
  goBackToTypeSelection() {
    this.hideModalProgrammatically("donorDataModal");
    this.clearDonorTypeCards();
    this.clearForm();
    this.showModalSafely("donorTypeModal");
  }
  setupFormValidation() {
    const form = this.elements.donorForm;
    if (!form) return;

    form.querySelectorAll("input[required]").forEach((input) => {
      input.addEventListener("blur", () => this.validateField(input));
      input.addEventListener("input", () => this.clearFieldError(input));
    });

    // Field formatting
    const formatters = {
      dni: (value) => value.replace(/\D/g, "").substring(0, 8),
      ruc: (value) => value.replace(/\D/g, "").substring(0, 11),
      phone: (value) => value.replace(/\D/g, "").substring(0, 9),
    };

    Object.entries(formatters).forEach(([name, formatter]) => {
      const input = form.querySelector(`input[name="${name}"]`);
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

  setupFileUpload() {
    const dropZone = this.elements.fileDropZone;
    const fileInput = this.elements.paymentProofInput;
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) this.handleFileSelection(file);
    });

    ["dragover", "dragleave", "drop"].forEach((event) => {
      dropZone.addEventListener(event, (e) => {
        e.preventDefault();
        if (event === "dragover") {
          dropZone.classList.add("border-primary", "bg-light");
        } else if (event === "dragleave") {
          dropZone.classList.remove("border-primary", "bg-light");
        } else if (event === "drop") {
          dropZone.classList.remove("border-primary", "bg-light");
          const file = e.dataTransfer.files[0];
          if (file) this.handleFileSelection(file);
        }
      });
    });
  }

  // State Management
  setSelectedAmount(amount) {
    this.state.selectedAmount = amount;
    console.log(`Amount selected: S/ ${amount}`);
  }

  setDonorType(type) {
    this.state.donorType = type;
    console.log(`Donor type selected: ${type}`);
  }

  // UI Updates
  updateAmountButtonsUI(selectedButton) {
    this.clearAmountButtonsUI();
    selectedButton.classList.add("active");
  }

  clearAmountButtonsUI() {
    this.elements.amountButtons?.forEach((btn) =>
      btn.classList.remove("active")
    );
  }

  clearCustomAmountInput() {
    if (this.elements.customAmountInput) {
      this.elements.customAmountInput.value = "";
    }
  }

  updateAmountDisplay() {
    [
      this.elements.selectedAmountDisplay,
      this.elements.selectedAmount2,
    ].forEach((display) => {
      if (display) display.textContent = this.state.selectedAmount;
    });
  }

  updateDonorTypeCardsUI(selectedCard) {
    this.elements.donorTypeCards?.forEach((card) => {
      card.classList.remove("border-primary", "bg-light");
    });
    selectedCard.classList.add("border-primary", "bg-light");
  }

  // Flow Navigation
  proceedToDataCollection() {
    this.hideModalProgrammatically("donorTypeModal");
    this.toggleDonorForms();
    this.updateModalTitle();
    this.showModalSafely("donorDataModal");
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

    form
      .querySelectorAll("input")
      .forEach((input) => input.removeAttribute("required"));

    const requiredFields = DonationFlowController.REQUIRED_FIELDS[type] || [];
    requiredFields.forEach((fieldName) => {
      const field = form.querySelector(`input[name="${fieldName}"]`);
      if (field) field.setAttribute("required", "required");
    });

    const termsCheck = document.getElementById("termsCheck");
    if (termsCheck) termsCheck.setAttribute("required", "required");
  }

  handleContinueToCollectors() {
    if (this.validateDonorForm()) {
      this.collectDonorData();
      this.proceedToCollectorSelection();
    }
  }

  // Form Validation
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
    if (input.hasAttribute("required") && !value) {
      return { isValid: false, message: "Este campo es obligatorio" };
    }

    if (!value) return { isValid: true, message: "" };

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
    if (errorDiv) errorDiv.remove();
  }

  // Data Collection
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

  // Collector Selection
  proceedToCollectorSelection() {
    this.hideModalProgrammatically("donorDataModal");
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
    container.innerHTML = `
      <div class="col-12 text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando recolectores...</span>
        </div>
        <p class="mt-2 text-muted">Buscando recolectores disponibles...</p>
      </div>
    `;
  }

  showNoCollectorsState(container) {
    container.innerHTML = `
      <div class="col-12 text-center py-4">
        <i class="fas fa-users fa-3x text-muted mb-3"></i>
        <h5>No hay recolectores disponibles</h5>
        <p class="text-muted">No se encontraron recolectores en este momento. Por favor intenta más tarde.</p>
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
        <p class="text-muted">Hubo un problema al cargar los recolectores. Por favor intenta nuevamente.</p>
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
    const cardElement = document.createElement("div");
    cardElement.innerHTML = `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card collector-card h-100 shadow-sm" data-collector-id="${
          collector.idUsuario || collector.id
        }">
          <div class="card-body text-center p-3">
            <div class="position-relative mb-3">
              <img class="collector-photo rounded-circle border border-2 border-light shadow-sm" 
                   width="80" height="80" 
                   src="${collector.fotoPerfil || collector.photo}"
                   alt="Foto de ${collector.nombreUsuario || collector.name}">
              <div class="position-absolute bottom-0 end-0">
                <span class="badge bg-success rounded-pill">
                  <i class="fas fa-check fa-xs"></i>
                </span>
              </div>
            </div>
            <h6 class="card-title mb-2 fw-bold">${
              collector.nombreUsuario || collector.name
            }</h6>
            <div class="row g-1 mb-3">
              <div class="col-6">
                <small class="text-warning d-block">
                  <i class="fas fa-star"></i> ${collector.rating || "5.0"}
                </small>
              </div>
              <div class="col-6">
                <small class="text-danger d-block">
                  <i class="fas fa-heart"></i> ${collector.donations || "0"}
                </small>
              </div>
            </div>
            <div class="mb-2">
              <small class="text-muted d-block">
                <i class="fas fa-clock me-1"></i> ${
                  collector.experience || "Nuevo"
                }
              </small>
            </div>
            <div class="mb-3">
              <small class="text-muted d-block">
                <i class="fas fa-map-marker-alt me-1"></i> ${
                  collector.facultadID || collector.location
                }
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

    const card = cardElement.querySelector(".collector-card");
    card.addEventListener("click", () => this.selectCollector(collector, card));

    return cardElement.firstElementChild;
  }

  selectCollector(collector, cardElement) {
    this.clearCollectorSelection();
    this.markCollectorAsSelected(cardElement);
    this.state.selectedCollector = collector;

    console.log("Recolector seleccionado:", {
      id: collector.idUsuario || collector.id,
      name: collector.nombreUsuario || collector.name,
      email: collector.correo || collector.email,
      phone: collector.celular || collector.cellPhone,
    });

    this.showToast(
      `Recolector ${collector.nombreUsuario || collector.name} seleccionado`,
      "success"
    );
    setTimeout(() => this.proceedToPayment(), 1000);
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

  // Payment Flow
  proceedToPayment() {
    this.hideModalProgrammatically("collectorsModal");
    setTimeout(() => {
      this.modals.paymentModal.show();
      this.initializePaymentFlow();
    }, 300);
  }

  async initializePaymentFlow() {
    await this.loadPaymentMethods();
    await this.updateCollectorInfo();
    this.updatePaymentAmount();
  }

  async updateCollectorInfo() {
    const collector = this.state.selectedCollector;
    if (!collector) return;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Actualizar información del recolector en la sección de datos
    if (this.elements.selectedCollectorName) {
      this.elements.selectedCollectorName.textContent =
        collector.nombreUsuario || collector.name || "No especificado";
    }

    if (this.elements.selectedCollectorEmail) {
      this.elements.selectedCollectorEmail.textContent =
        collector.correo || collector.email || "No especificado";
    }

    if (this.elements.selectedCollectorPhone) {
      this.elements.selectedCollectorPhone.textContent =
        collector.celular ||
        collector.phone ||
        collector.cellPhone ||
        "No especificado";
    }

    if (this.elements.selectedCollectorFaculty) {
      this.elements.selectedCollectorFaculty.textContent =
        collector.facultadID ||
        collector.faculty ||
        collector.location ||
        "No especificado";
    }

    // Actualizar título del modal
    const modalTitle = document.querySelector("#paymentModal .modal-title");
    if (modalTitle) {
      modalTitle.innerHTML = `<i class="fas fa-credit-card me-2"></i>Pago a ${
        collector.nombreUsuario || collector.name || "Recolector"
      }`;
    }
  }

  findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  async loadPaymentMethods() {
    try {
      this.showLoadingPaymentMethods();
      const methods = this.buildPaymentMethodsFromCollector();

      if (methods.length === 0) {
        this.showNoPaymentMethodsAvailable();
        return;
      }

      this.state.paymentMethods = methods;
      this.renderPaymentMethods(methods);
    } catch (error) {
      console.error("Error loading payment methods:", error);
      this.showPaymentMethodsError();
    }
  }

  buildPaymentMethodsFromCollector() {
    const methods = [];
    const collector = this.state.selectedCollector;
    if (!collector) return methods;

    const name =
      `${collector.nombreUsuario || ""} ${
        collector.apellidoUsuario || ""
      }`.trim() || "Recolector";

    if (collector.Yape) {
      methods.push({
        id: "yape",
        name: "Yape",
        icon: "fas fa-mobile-alt",
        color: "text-purple",
        details: {
          phone: collector.Yape,
          name: collector.name,
          instructions:
            "Realiza la transferencia por el monto exacto y sube el comprobante",
        },
      });
    }

    if (collector.cuentaBancaria) {
      methods.push({
        id: "bank",
        name: "Transferencia Bancaria",
        icon: "fas fa-university",
        color: "text-primary",
        details: {
          bank: collector.banco || "Banco no especificado",
          accountNumber: collector.cuentaBancaria || collector.name,
          accountType: collector.tipoCuenta || "Cuenta Corriente",
          holder: collector.name,
          instructions:
            "Realiza la transferencia por el monto exacto y sube el comprobante",
        },
      });
    }

    return methods;
  }

  showLoadingPaymentMethods() {
    if (this.elements.paymentMethodsContainer) {
      this.elements.paymentMethodsContainer.innerHTML = `
        <div class="text-center py-4">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="mt-2 text-muted">Cargando métodos de pago del recolector...</p>
        </div>
      `;
    }
  }

  showNoPaymentMethodsAvailable() {
    if (this.elements.paymentMethodsContainer) {
      this.elements.paymentMethodsContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-info-circle fa-2x text-info mb-3"></i>
          <h6>No hay métodos de pago disponibles</h6>
          <p class="text-muted mb-3">
            El recolector <strong>${
              this.state.selectedCollector.nombreUsuario || "seleccionado"
            }</strong> 
            no tiene métodos de pago configurados.
          </p>
          <p class="text-muted">
            <small>Por favor contacta al recolector para coordinar el pago de otra manera.</small>
          </p>
        </div>
      `;
    }
  }

  showPaymentMethodsError() {
    if (this.elements.paymentMethodsContainer) {
      this.elements.paymentMethodsContainer.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-exclamation-triangle fa-2x text-warning mb-3"></i>
          <h6>Error al cargar métodos de pago</h6>
          <p class="text-muted mb-3">No se pudieron cargar los métodos de pago del recolector.</p>
          <button class="btn btn-outline-primary" onclick="location.reload()">
            <i class="fas fa-refresh me-2"></i>Reintentar
          </button>
        </div>
      `;
    }
  }

  renderPaymentMethods(methods) {
    if (!this.elements.paymentMethodsContainer) return;

    const methodsHTML = methods
      .map(
        (method) => `
      <div class="col-md-6 mb-3">
        <div class="card payment-method-card h-100 shadow-sm" 
             data-method-id="${method.id}" 
             style="cursor: pointer; transition: all 0.3s ease;">
          <div class="card-body text-center p-4">
            <div class="mb-3">
              <i class="${method.icon} fa-2x ${method.color}"></i>
            </div>
            <h6 class="card-title fw-bold">${method.name}</h6>
            <small class="text-muted">Disponible las 24 horas</small>
            <div class="mt-2">
              <small class="badge bg-light text-dark">
                ${this.getMethodIdentifier(method)}
              </small>
            </div>
          </div>
        </div>
      </div>
    `
      )
      .join("");

    this.elements.paymentMethodsContainer.innerHTML = `<div class="row">${methodsHTML}</div>`;
    this.setupPaymentMethodSelection();
  }

  getMethodIdentifier(method) {
    return method.id === "yape"
      ? method.details.phone
      : method.details.accountNumber;
  }

  setupPaymentMethodSelection() {
    document.querySelectorAll(".payment-method-card").forEach((card) => {
      card.addEventListener("click", () => {
        const methodId = card.dataset.methodId;
        this.selectPaymentMethod(methodId);
      });

      ["mouseenter", "mouseleave"].forEach((event) => {
        card.addEventListener(event, () => {
          if (event === "mouseenter") {
            card.style.transform = "translateY(-2px)";
            card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
          } else if (!card.classList.contains("selected")) {
            card.style.transform = "translateY(0)";
            card.style.boxShadow = "";
          }
        });
      });
    });
  }

  // Seleccionar método de pago
  selectPaymentMethod(methodId) {
    // Limpiar selección anterior
    document.querySelectorAll(".payment-method-card").forEach((card) => {
      card.classList.remove("selected", "border-primary", "bg-light");
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "";
    });

    // Marcar como seleccionado
    const selectedCard = document.querySelector(
      `[data-method-id="${methodId}"]`
    );
    if (selectedCard) {
      selectedCard.classList.add("selected", "border-primary", "bg-light");
      selectedCard.style.transform = "translateY(-2px)";
      selectedCard.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    }

    this.state.selectedPaymentMethod = methodId;
    this.showUploadSection();
    this.showBasicPaymentInfo(methodId);
  }

  // Mostrar información básica del pago
  showBasicPaymentInfo(methodId) {
    const method = this.state.paymentMethods.find((m) => m.id === methodId);
    if (!method) return;

    let infoContainer = document.getElementById("basicPaymentInfo");
    if (!infoContainer) {
      const uploadSection = this.elements.uploadSection;
      if (uploadSection) {
        infoContainer = document.createElement("div");
        infoContainer.id = "basicPaymentInfo";
        infoContainer.className = "mb-3";
        uploadSection.insertBefore(infoContainer, uploadSection.firstChild);
      }
    }

    if (infoContainer) {
      const amount = this.state.selectedAmount;
      const collector = this.state.selectedCollector;

      if (method.id === "yape") {
        infoContainer.innerHTML = `
        <div class="alert alert-info">
          <div class="row">
            <div class="col-md-6">
              <strong><i class="fas fa-mobile-alt me-1"></i>Yape:</strong> ${method.details.phone}
            </div>
            <div class="col-md-6">
              <strong><i class="fas fa-coins me-1"></i>Monto:</strong> S/ ${amount}
            </div>
          </div>
          <div class="row mt-2">
            <div class="col-12">
              <strong><i class="fas fa-user me-1"></i>Titular:</strong> ${method.details.name}
            </div>
          </div>
        </div>
      `;
      } else if (method.id === "bank") {
        infoContainer.innerHTML = `
        <div class="alert alert-info">
          <div class="row">
            <div class="col-md-6">
              <strong><i class="fas fa-university me-1"></i>Banco:</strong> ${method.details.bank}
            </div>
            <div class="col-md-6">
              <strong><i class="fas fa-coins me-1"></i>Monto:</strong> S/ ${amount}
            </div>
          </div>
          <div class="row mt-2">
            <div class="col-md-6">
              <strong><i class="fas fa-credit-card me-1"></i>Cuenta:</strong> ${method.details.accountNumber}
            </div>
            <div class="col-md-6">
              <strong><i class="fas fa-user me-1"></i>Titular:</strong> ${method.details.holder}
            </div>
          </div>
        </div>
      `;
      }
    }
  }
  // Mostrar sección de subida
  showUploadSection() {
    if (this.elements.uploadSection) {
      this.elements.uploadSection.classList.remove("d-none");
    }
  }

  // Configurar subida de archivos
  setupFileUpload() {
    const dropZone = this.elements.fileDropZone;
    const fileInput = this.elements.paymentProofInput;

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileSelection(file);
      }
    });

    // Drag and drop
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("border-primary", "bg-light");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("border-primary", "bg-light");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-primary", "bg-light");
      const file = e.dataTransfer.files[0];
      if (file) {
        this.handleFileSelection(file);
      }
    });
  }

  // Manejar selección de archivos
  handleFileSelection(file) {
    if (!this.validateFile(file)) {
      return;
    }

    this.state.uploadedFile = file;
    this.showFilePreview(file);
    this.enableConfirmButton();
  }

  // Validar archivo
  validateFile(file) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      this.showToast("Por favor sube solo imágenes JPG, PNG o WebP", "error");
      return false;
    }

    if (file.size > maxSize) {
      this.showToast("El archivo es muy grande. Máximo 5MB", "error");
      return false;
    }

    return true;
  }

  // Mostrar vista previa
  showFilePreview(file) {
    const preview = this.elements.filePreview;
    if (!preview) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
      <div class="text-center">
        <div class="position-relative d-inline-block">
          <img src="${e.target.result}" 
               alt="Vista previa" 
               class="img-thumbnail"
               style="max-width: 200px; max-height: 200px;">
          <button type="button" 
                  class="btn btn-sm btn-danger position-absolute top-0 end-0 rounded-circle"
                  onclick="window.donationFlow.clearFileUpload()"
                  style="transform: translate(50%, -50%);">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="mt-2">
          <small class="text-muted">
            <i class="fas fa-file-image me-1"></i>
            ${file.name} (${this.formatFileSize(file.size)})
          </small>
        </div>
      </div>
    `;
    };
    reader.readAsDataURL(file);
  }

  // Limpiar subida de archivos
  clearFileUpload() {
    this.state.uploadedFile = null;

    if (this.elements.filePreview) {
      this.elements.filePreview.innerHTML = "";
    }

    if (this.elements.paymentProofInput) {
      this.elements.paymentProofInput.value = "";
    }

    this.disableConfirmButton();
  }

  // Formatear tamaño de archivo
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Habilitar botón de confirmación
  enableConfirmButton() {
    if (this.elements.confirmPaymentBtn) {
      this.elements.confirmPaymentBtn.disabled = false;
      this.elements.confirmPaymentBtn.classList.remove("disabled");
    }
  }

  // Deshabilitar botón de confirmación
  disableConfirmButton() {
    if (this.elements.confirmPaymentBtn) {
      this.elements.confirmPaymentBtn.disabled = true;
      this.elements.confirmPaymentBtn.classList.add("disabled");
    }
  }

  // Actualizar monto de pago
  updatePaymentAmount() {
    if (this.elements.paymentAmount) {
      this.elements.paymentAmount.textContent = this.state.selectedAmount;
    }
  }

  // Manejar confirmación de pago
  async handlePaymentConfirmation() {
    if (!this.state.selectedPaymentMethod) {
      this.showToast("Por favor selecciona un método de pago", "warning");
      return;
    }

    if (!this.state.uploadedFile) {
      this.showToast("Por favor sube el comprobante de pago", "warning");
      return;
    }

    try {
      this.setLoadingState(true);

      const paymentData = await this.processPayment();

      this.state.isPaymentConfirmed = true;
      this.showToast("¡Pago confirmado exitosamente!", "success");

      // Proceder al modal de confirmación
      setTimeout(() => {
        this.proceedToConfirmation();
      }, 1500);

      console.log("Pago procesado:", paymentData);
    } catch (error) {
      console.error("Error processing payment:", error);
      this.showToast("Error al procesar el pago. Intenta nuevamente.", "error");
    } finally {
      this.setLoadingState(false);
    }
  }

  // Procesar pago
  async processPayment() {
    // Simular procesamiento
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      paymentId: this.generatePaymentId(),
      method: this.state.selectedPaymentMethod,
      amount: this.state.selectedAmount,
      file: this.state.uploadedFile,
      collector: this.state.selectedCollector,
      donor: this.state.donorData,
      timestamp: new Date().toISOString(),
      status: "pending_verification",
    };
  }

  // Generar ID de pago
  generatePaymentId() {
    return "PAY-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }
  proceedToConfirmation() {
    this.hideModalProgrammatically("paymentModal");
    setTimeout(() => {
      this.modals.confirmationModal.show();
      this.populateConfirmationData();
    }, 300);
  }
  populateConfirmationData() {
    // Nombre del donante
    const finalDonorName = document.getElementById("finalDonorName");
    if (finalDonorName) {
      finalDonorName.textContent =
        this.state.donorData.fullName || "No especificado";
    }

    // Monto
    const finalAmount = document.getElementById("finalAmount");
    if (finalAmount) {
      finalAmount.textContent = this.state.selectedAmount;
    }

    // Recolector
    const finalCollector = document.getElementById("finalCollector");
    if (finalCollector) {
      finalCollector.textContent =
        this.state.selectedCollector?.nombreUsuario ||
        this.state.selectedCollector?.name ||
        "No especificado";
    }

    // Email
    const finalEmail = document.getElementById("finalEmail");
    if (finalEmail) {
      finalEmail.textContent = this.state.donorData.email || "No especificado";
    }

    // Fecha actual
    const finalDate = document.getElementById("finalDate");
    if (finalDate) {
      const now = new Date();
      const dateString = now.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      finalDate.textContent = dateString;
    }

    // Configurar botones del modal
    this.setupConfirmationModalButtons();
  }

  // Configurar botones del modal de confirmación
  setupConfirmationModalButtons() {
    const resetBtn = document.getElementById("resetDonationFlow");
    const shareBtn = document.getElementById("shareOnSocial");

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.hideModalProgrammatically("confirmationModal");
        this.resetFlow();
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        this.shareOnSocial();
      });
    }
  }

  // Compartir en redes sociales (función simple)
  shareOnSocial() {
    const message = `¡Acabo de hacer una donación de S/ ${this.state.selectedAmount} a través de la plataforma! 🎉❤️`;

    if (navigator.share) {
      navigator.share({
        title: "Mi Donación",
        text: message,
        url: window.location.href,
      });
    } else {
      // Fallback para navegadores que no soportan Web Share API
      const shareText = encodeURIComponent(message);
      const shareUrl = `https://twitter.com/intent/tweet?text=${shareText}`;
      window.open(shareUrl, "_blank");
    }
  }
  // Establecer estado de carga
  setLoadingState(isLoading) {
    this.state.isLoading = isLoading;

    if (this.elements.confirmPaymentBtn) {
      if (isLoading) {
        this.elements.confirmPaymentBtn.innerHTML = `
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        Procesando...
      `;
        this.elements.confirmPaymentBtn.disabled = true;
      } else {
        this.elements.confirmPaymentBtn.innerHTML = `
        <i class="fas fa-check me-2"></i>
        Confirmar Pago Realizado
      `;
        this.elements.confirmPaymentBtn.disabled = false;
      }
    }
  }

  // Volver a recolectores
  goBackToCollectors() {
    this.hideModalProgrammatically("paymentModal");
    this.showModalSafely("collectorsModal");
  }
  clearDonorTypeCards() {
    this.elements.donorTypeCards?.forEach((card) => {
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
  // Toast notification method
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
  // Utility methods for checking state
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

  getState() {
    return { ...this.state };
  }
}
// Initialize donation flow when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.donationFlow = new DonationFlowController();
  console.log("Donation Flow Controller initialized");
});
