/**
 * PaymentController - Maneja todo el flujo de pagos del Modal 4
 * Ahora usa los datos reales del recolector seleccionado
 */
class PaymentController {
  constructor(options = {}) {
    this.donationData = options.donationData || {};
    this.collectorData = options.collectorData || {}; // Datos del recolector seleccionado
    this.onPaymentComplete = options.onPaymentComplete || (() => {});
    this.onGoBack = options.onGoBack || (() => {});

    this.state = {
      selectedPaymentMethod: null,
      paymentMethods: [],
      uploadedFile: null,
      isLoading: false,
      isPaymentConfirmed: false,
    };

    this.elements = {};
    this.init();
  }

  /**
   * Inicializa el controlador de pagos
   */
  async initialize() {
    this.cacheElements();
    this.setupEventListeners();
    await this.loadPaymentMethods();
    this.updatePaymentAmount();
  }

  /**
   * Cache de elementos DOM
   */
  cacheElements() {
    this.elements = {
      // Contenedores principales
      paymentMethodsContainer: document.getElementById(
        "paymentMethodsContainer"
      ),
      paymentDetailsSection: document.getElementById("paymentDetailsSection"),
      uploadSection: document.getElementById("uploadSection"),

      // Detalles de pago por método
      yapeDetails: document.getElementById("yapeDetails"),
      plinDetails: document.getElementById("plinDetails"),
      bankDetails: document.getElementById("bankDetails"),
      cciDetails: document.getElementById("cciDetails"),

      // Subida de archivos
      fileDropZone: document.getElementById("fileDropZone"),
      paymentProofInput: document.getElementById("paymentProofInput"),
      filePreview: document.getElementById("filePreview"),

      // Botones
      confirmPaymentBtn: document.getElementById("confirmPaymentBtn"),
      goBackToCollectors: document.getElementById("goBackToCollectors"),

      // Displays
      paymentAmount: document.getElementById("paymentAmount"),
    };
  }

  /**
   * Configura todos los event listeners
   */
  setupEventListeners() {
    // Drag and drop para archivos
    this.setupFileUpload();

    // Botones de navegación
    if (this.elements.goBackToCollectors) {
      this.elements.goBackToCollectors.addEventListener("click", () => {
        this.onGoBack();
      });
    }

    // Botón de confirmación de pago
    if (this.elements.confirmPaymentBtn) {
      this.elements.confirmPaymentBtn.addEventListener("click", () => {
        this.handlePaymentConfirmation();
      });
    }
  }

  /**
   * Carga los métodos de pago disponibles basados en el recolector seleccionado
   */
  async loadPaymentMethods() {
    try {
      this.showLoadingPaymentMethods();

      // Obtener métodos disponibles del recolector
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

  /**
   * Construye los métodos de pago basados en los datos del recolector
   */
  buildPaymentMethodsFromCollector() {
    const methods = [];

    console.log("Datos del recolector para pagos:", this.collectorData);

    if (!this.collectorData || Object.keys(this.collectorData).length === 0) {
      console.error("collectorData está vacío o no definido");
      return methods;
    }

    // Verificar Yape - usar 'Yape' (con mayúscula)
    if (this.collectorData.Yape) {
      methods.push({
        id: "yape",
        name: "Yape",
        icon: "fas fa-mobile-alt",
        color: "text-purple",
        details: {
          phone: this.collectorData.Yape,
          name: `${this.collectorData.nombreUsuario || ""} ${
            this.collectorData.apellidoUsuario || ""
          }`.trim(),
          instructions:
            "Realiza la transferencia por el monto exacto y sube el comprobante",
        },
      });
    }

    // Verificar Cuenta Bancaria - usar 'cuentaBancaria'
    if (this.collectorData.cuentaBancaria) {
      methods.push({
        id: "bank",
        name: "Transferencia Bancaria",
        icon: "fas fa-university",
        color: "text-primary",
        details: {
          bank: "Banco no especificado",
          accountNumber: this.collectorData.cuentaBancaria,
          accountType: "Cuenta Corriente",
          holder: `${this.collectorData.nombreUsuario || ""} ${
            this.collectorData.apellidoUsuario || ""
          }`.trim(),
          instructions:
            "Realiza la transferencia por el monto exacto y sube el comprobante",
        },
      });
    }

    console.log("Métodos de pago construidos:", methods);
    return methods;
  }

  /**
   * Muestra estado de carga de métodos de pago
   */
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

  /**
   * Muestra mensaje cuando no hay métodos de pago disponibles
   */
  showNoPaymentMethodsAvailable() {
    if (this.elements.paymentMethodsContainer) {
      this.elements.paymentMethodsContainer.innerHTML = `
      <div class="text-center py-4">
        <i class="fas fa-info-circle fa-2x text-info mb-3"></i>
        <h6>No hay métodos de pago disponibles</h6>
        <p class="text-muted mb-3">
          El recolector <strong>${
            this.collectorData.nombreUsuario || "seleccionado"
          }</strong> no tiene métodos de pago configurados.
        </p>
        <p class="text-muted">
          <small>Por favor contacta al recolector para coordinar el pago de otra manera.</small>
        </p>
      </div>
    `;
    }
  }

  /**
   * Muestra error al cargar métodos de pago
   */
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

  /**
   * Renderiza los métodos de pago
   */
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

    this.elements.paymentMethodsContainer.innerHTML = `
      <div class="row">
        ${methodsHTML}
      </div>
    `;

    // Agregar event listeners a las tarjetas
    this.setupPaymentMethodSelection();
  }

  /**
   * Obtiene el identificador visible del método de pago
   */
  getMethodIdentifier(method) {
    switch (method.id) {
      case "yape":
      case "plin":
        return `${method.details.phone}`;
      case "bank":
        return `${method.details.bank}`;
      case "cci":
        return `CCI: ${method.details.cci.slice(-4)}`;
      default:
        return "Disponible";
    }
  }

  /**
   * Configura la selección de métodos de pago
   */
  setupPaymentMethodSelection() {
    const methodCards = document.querySelectorAll(".payment-method-card");

    methodCards.forEach((card) => {
      card.addEventListener("click", () => {
        const methodId = card.dataset.methodId;
        this.selectPaymentMethod(methodId);
      });

      // Efectos hover
      card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-2px)";
        card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      });

      card.addEventListener("mouseleave", () => {
        if (!card.classList.contains("selected")) {
          card.style.transform = "translateY(0)";
          card.style.boxShadow = "";
        }
      });
    });
  }

  /**
   * Selecciona un método de pago
   */
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
    this.showPaymentDetails(methodId);
    this.showUploadSection();

    console.log("Método de pago seleccionado:", methodId);
  }

  /**
   * Muestra los detalles del método de pago seleccionado
   */
  showPaymentDetails(methodId) {
    // Ocultar todos los detalles
    this.hideAllPaymentDetails();

    // Mostrar sección de detalles
    if (this.elements.paymentDetailsSection) {
      this.elements.paymentDetailsSection.classList.remove("d-none");
    }

    const method = this.state.paymentMethods.find((m) => m.id === methodId);
    if (!method) return;

    const detailsElement = this.elements[`${methodId}Details`];
    if (detailsElement) {
      detailsElement.innerHTML = this.generatePaymentDetailsHTML(method);
      detailsElement.classList.remove("d-none");
    }
  }

  /**
   * Oculta todos los detalles de pago
   */
  hideAllPaymentDetails() {
    ["yapeDetails", "plinDetails", "bankDetails", "cciDetails"].forEach(
      (elementKey) => {
        if (this.elements[elementKey]) {
          this.elements[elementKey].classList.add("d-none");
        }
      }
    );
  }

  /**
   * Genera HTML para los detalles de pago
   */
  generatePaymentDetailsHTML(method) {
    const amount = this.donationData.amount || 0;

    switch (method.id) {
      case "yape":
      case "plin":
        return `
          <div class="alert alert-info">
            <div class="row">
              <div class="col-md-6">
                <h6 class="fw-bold mb-2">
                  <i class="${method.icon} ${method.color} me-2"></i>
                  Datos para ${method.name}
                </h6>
                <p class="mb-1"><strong>Número:</strong> ${method.details.phone}</p>
                <p class="mb-1"><strong>Nombre:</strong> ${method.details.name}</p>
                <p class="mb-1"><strong>Monto:</strong> S/ ${amount}</p>
              </div>
              <div class="col-md-6">
                <div class="text-center">
                  <div class="bg-white p-3 rounded">
                    <div style="width: 120px; height: 120px; background: #f8f9fa; border: 2px dashed #dee2e6; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                      <small class="text-muted">Código QR</small>
                    </div>
                    <small class="text-muted d-block mt-2">Escanea para pagar</small>
                  </div>
                </div>
              </div>
            </div>
            <hr>
            <small class="text-muted">
              <i class="fas fa-info-circle me-1"></i>
              ${method.details.instructions}
            </small>
          </div>
        `;

      case "bank":
        return `
          <div class="alert alert-info">
            <h6 class="fw-bold mb-3">
              <i class="${method.icon} ${method.color} me-2"></i>
              Datos para Transferencia Bancaria
            </h6>
            <div class="row">
              <div class="col-md-6">
                <p class="mb-2"><strong>Banco:</strong> ${method.details.bank}</p>
                <p class="mb-2"><strong>Número de Cuenta:</strong> ${method.details.accountNumber}</p>
                <p class="mb-2"><strong>Tipo de Cuenta:</strong> ${method.details.accountType}</p>
              </div>
              <div class="col-md-6">
                <p class="mb-2"><strong>Titular:</strong> ${method.details.holder}</p>
                <p class="mb-2"><strong>Monto:</strong> S/ ${amount}</p>
              </div>
            </div>
            <hr>
            <small class="text-muted">
              <i class="fas fa-info-circle me-1"></i>
              ${method.details.instructions}
            </small>
          </div>
        `;

      case "cci":
        return `
          <div class="alert alert-info">
            <h6 class="fw-bold mb-3">
              <i class="${method.icon} ${method.color} me-2"></i>
              Datos para Transferencia CCI
            </h6>
            <div class="row">
              <div class="col-md-6">
                <p class="mb-2"><strong>CCI:</strong> ${method.details.cci}</p>
                <p class="mb-2"><strong>Banco:</strong> ${method.details.bank}</p>
              </div>
              <div class="col-md-6">
                <p class="mb-2"><strong>Titular:</strong> ${method.details.holder}</p>
                <p class="mb-2"><strong>Monto:</strong> S/ ${amount}</p>
              </div>
            </div>
            <hr>
            <small class="text-muted">
              <i class="fas fa-info-circle me-1"></i>
              ${method.details.instructions}
            </small>
          </div>
        `;

      default:
        return '<div class="alert alert-warning">Método de pago no disponible</div>';
    }
  }

  /**
   * Muestra la sección de subida de archivos
   */
  showUploadSection() {
    if (this.elements.uploadSection) {
      this.elements.uploadSection.classList.remove("d-none");
    }
  }

  /**
   * Configura la funcionalidad de subida de archivos
   */
  setupFileUpload() {
    const dropZone = this.elements.fileDropZone;
    const fileInput = this.elements.paymentProofInput;

    if (!dropZone || !fileInput) return;

    // Click en zona de drop
    dropZone.addEventListener("click", () => {
      fileInput.click();
    });

    // Selección de archivo
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

  /**
   * Maneja la selección de archivos
   */
  handleFileSelection(file) {
    // Validar archivo
    if (!this.validateFile(file)) {
      return;
    }

    this.state.uploadedFile = file;
    this.showFilePreview(file);
    this.enableConfirmButton();
  }

  /**
   * Valida el archivo subido
   */
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

  /**
   * Muestra vista previa del archivo
   */
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
                  onclick="window.paymentController?.clearFileUpload()"
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

  /**
   * Limpia la subida de archivos
   */
  clearFileUpload = () => {
    this.state.uploadedFile = null;
    if (this.elements.filePreview) {
      this.elements.filePreview.innerHTML = "";
    }
    if (this.elements.paymentProofInput) {
      this.elements.paymentProofInput.value = "";
    }
    this.disableConfirmButton();
  };

  /**
   * Formatea el tamaño del archivo
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
  async initializePaymentController() {
    try {
      const { PaymentController } = await import("./payment-controller.js");

      this.paymentController = new PaymentController({
        donationData: this.getDonationData(),
        collectorData: this.state.selectedCollector,
        onPaymentComplete: (paymentData) =>
          this.handlePaymentComplete(paymentData),
        onGoBack: () => this.goBackToCollectors(),
      });

      // Hacer accesible globalmente para el botón de eliminar archivo
      window.paymentController = this.paymentController;

      await this.paymentController.initialize();
    } catch (error) {
      console.error("Error initializing payment controller:", error);
      this.showToast("Error al cargar métodos de pago", "error");
    }
  }
  /**
   * Habilita el botón de confirmación
   */
  enableConfirmButton() {
    if (this.elements.confirmPaymentBtn) {
      this.elements.confirmPaymentBtn.disabled = false;
      this.elements.confirmPaymentBtn.classList.remove("disabled");
    }
  }

  /**
   * Deshabilita el botón de confirmación
   */
  disableConfirmButton() {
    if (this.elements.confirmPaymentBtn) {
      this.elements.confirmPaymentBtn.disabled = true;
      this.elements.confirmPaymentBtn.classList.add("disabled");
    }
  }

  /**
   * Actualiza el monto de pago en el modal
   */
  updatePaymentAmount() {
    if (this.elements.paymentAmount) {
      this.elements.paymentAmount.textContent = this.donationData.amount || 0;
    }
  }

  /**
   * Maneja la confirmación del pago
   */
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

      // Llamar callback de pago completado
      this.onPaymentComplete(paymentData);
    } catch (error) {
      console.error("Error processing payment:", error);
      this.showToast("Error al procesar el pago. Intenta nuevamente.", "error");
    } finally {
      this.setLoadingState(false);
    }
  }

  /**
   * Procesa el pago
   */
  async processPayment() {
    // Simular procesamiento del pago
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      paymentId: this.generatePaymentId(),
      method: this.state.selectedPaymentMethod,
      amount: this.donationData.amount,
      file: this.state.uploadedFile,
      collectorId: this.collectorData.id,
      collectorName: this.collectorData.name,
      timestamp: new Date().toISOString(),
      status: "pending_verification",
    };
  }

  /**
   * Genera un ID único para el pago
   */
  generatePaymentId() {
    return "PAY-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Establece el estado de carga
   */
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

  /**
   * Muestra notificaciones toast
   */
  showToast(message, type = "info") {
    // Crear evento personalizado para comunicarse con el controlador principal
    const event = new CustomEvent("paymentToast", {
      detail: { message, type },
    });
    window.dispatchEvent(event);
  }

  /**
   * Método público para confirmar pago (llamado desde el controlador principal)
   */
  confirmPayment() {
    this.handlePaymentConfirmation();
  }

  /**
   * Obtiene el estado actual del controlador
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Obtiene los datos del pago
   */
  getPaymentData() {
    return {
      method: this.state.selectedPaymentMethod,
      amount: this.donationData.amount,
      file: this.state.uploadedFile,
      collectorId: this.collectorData.id,
      collectorName: this.collectorData.name,
      isConfirmed: this.state.isPaymentConfirmed,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Actualiza los datos del recolector
   */
  updateCollectorData(newCollectorData) {
    this.collectorData = newCollectorData;
    console.log("Datos del recolector actualizados:", this.collectorData);

    // Recargar métodos de pago
    this.loadPaymentMethods();
  }

  /**
   * Limpia el controlador
   */
  cleanup() {
    this.state = {
      selectedPaymentMethod: null,
      paymentMethods: [],
      uploadedFile: null,
      isLoading: false,
      isPaymentConfirmed: false,
    };
  }

  /**
   * Inicialización del controlador
   */
  init() {
    console.log("PaymentController initialized");
    console.log("Collector data:", this.collectorData);

    // Escuchar eventos de toast del controlador principal
    window.addEventListener("paymentToast", (e) => {
      // Reenviar el evento al controlador principal
      const mainController = window.donationFlow;
      if (mainController && mainController.showToast) {
        mainController.showToast(e.detail.message, e.detail.type);
      }
    });
  }
}

// Exportar la clase
export { PaymentController };
