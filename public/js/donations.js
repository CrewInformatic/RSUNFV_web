// donations.js - Sistema de Donaciones
import {
  db,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "./firebase_config.js";

// Variables globales para el flujo de donación
let donationData = {
  amount: 0,
  donorType: "",
  donorInfo: {},
  selectedCollector: null,
  paymentMethod: "",
};

// Inicialización cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  initializeDonationSystem();
  loadTestimonials();
});

// Inicializar el sistema de donaciones
function initializeDonationSystem() {
  // Eventos para los botones de monto
  document.querySelectorAll(".amount-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const amount = parseInt(this.dataset.amount);
      selectAmount(amount);
    });
  });

  // Evento para el botón de donar
  const donateBtn = document.getElementById("startDonationBtn");
  if (donateBtn) {
    donateBtn.addEventListener("click", startDonationFlow);
  }

  // Eventos para los tipos de donante
  document.querySelectorAll(".donor-type-card").forEach((card) => {
    card.addEventListener("click", function () {
      selectDonorType(this.dataset.type);
    });
  });

  // Evento para continuar a datos
  const continueToData = document.getElementById("continueToCollectors");
  if (continueToData) {
    continueToData.addEventListener("click", validateAndContinueToCollectors);
  }

  // Evento para continuar al pago
  const continueToPayment = document.getElementById("continueToPayment");
  if (continueToPayment) {
    continueToPayment.addEventListener("click", proceedToPayment);
  }

  // Evento para confirmar pago
  const confirmPaymentBtn = document.getElementById("confirmPaymentBtn");
  if (confirmPaymentBtn) {
    confirmPaymentBtn.addEventListener("click", confirmPayment);
  }
}

// Seleccionar monto de donación
function selectAmount(amount) {
  donationData.amount = amount;

  // Actualizar UI
  document.querySelectorAll(".amount-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.querySelector(`[data-amount="${amount}"]`).classList.add("active");

  // Limpiar input personalizado
  const customInput = document.getElementById("customAmountInput");
  if (customInput) {
    customInput.value = "";
  }
}

// Manejar monto personalizado
document
  .getElementById("customAmountInput")
  ?.addEventListener("input", function () {
    const customAmount = parseInt(this.value);
    if (customAmount > 0) {
      donationData.amount = customAmount;

      // Desactivar botones predefinidos
      document.querySelectorAll(".amount-btn").forEach((btn) => {
        btn.classList.remove("active");
      });
    }
  });

// Iniciar flujo de donación
function startDonationFlow() {
  if (donationData.amount <= 0) {
    alert("Por favor selecciona un monto de donación");
    return;
  }

  // Mostrar monto seleccionado en el modal
  document.getElementById("selectedAmountDisplay").textContent =
    donationData.amount;

  // Abrir modal de tipo de donante
  const donorTypeModal = new bootstrap.Modal(
    document.getElementById("donorTypeModal")
  );
  donorTypeModal.show();
}

// Seleccionar tipo de donante
function selectDonorType(type) {
  donationData.donorType = type;

  // Actualizar UI
  document.querySelectorAll(".donor-type-card").forEach((card) => {
    card.classList.remove("selected");
  });

  document.querySelector(`[data-type="${type}"]`).classList.add("selected");

  // Continuar automáticamente después de un breve delay
  setTimeout(() => {
    proceedToDataForm();
  }, 500);
}

// Proceder al formulario de datos
function proceedToDataForm() {
  // Cerrar modal anterior
  const donorTypeModal = bootstrap.Modal.getInstance(
    document.getElementById("donorTypeModal")
  );
  donorTypeModal.hide();

  // Configurar formulario según tipo de donante
  if (donationData.donorType === "individual") {
    document.getElementById("individualForm").style.display = "block";
    document.getElementById("companyForm").style.display = "none";
  } else {
    document.getElementById("individualForm").style.display = "none";
    document.getElementById("companyForm").style.display = "block";
  }

  // Abrir modal de datos
  const donorDataModal = new bootstrap.Modal(
    document.getElementById("donorDataModal")
  );
  donorDataModal.show();
}

// Validar y continuar a recolectores
function validateAndContinueToCollectors() {
  const form = document.getElementById("donorForm");
  const formData = new FormData(form);

  // Validaciones básicas
  const requiredFields = form.querySelectorAll("[required]");
  let isValid = true;

  requiredFields.forEach((field) => {
    if (!field.value.trim()) {
      field.classList.add("is-invalid");
      isValid = false;
    } else {
      field.classList.remove("is-invalid");
    }
  });

  if (!isValid) {
    alert("Por favor completa todos los campos obligatorios");
    return;
  }

  // Guardar datos del donante
  donationData.donorInfo = {};
  for (let [key, value] of formData.entries()) {
    donationData.donorInfo[key] = value;
  }

  // Proceder a selección de recolectores
  proceedToCollectors();
}

// Proceder a selección de recolectores
async function proceedToCollectors() {
  try {
    // Cerrar modal anterior
    const donorDataModal = bootstrap.Modal.getInstance(
      document.getElementById("donorDataModal")
    );
    donorDataModal.hide();

    // Mostrar información del donante
    const donorName =
      donationData.donorType === "individual"
        ? `${donationData.donorInfo.firstName} ${donationData.donorInfo.lastName}`
        : donationData.donorInfo.companyName;

    document.getElementById("donorNameDisplay").textContent = donorName;
    document.getElementById("selectedAmount2").textContent =
      donationData.amount;

    // Cargar recolectores
    await loadCollectors();

    // Abrir modal de recolectores
    const collectorsModal = new bootstrap.Modal(
      document.getElementById("collectorsModal")
    );
    collectorsModal.show();
  } catch (error) {
    console.error("Error al cargar recolectores:", error);
    alert("Error al cargar los recolectores. Por favor intenta nuevamente.");
  }
}

// Cargar recolectores desde Firebase
async function loadCollectors() {
  try {
    const collectorsGrid = document.getElementById("collectorsGrid");
    collectorsGrid.innerHTML =
      '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Cargando recolectores...</div>';

    // Consultar usuarios con ROL_004 (recolectores)
    const q = query(collection(db, "users"), where("role", "==", "ROL_004"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      collectorsGrid.innerHTML =
        '<div class="text-center text-muted">No hay recolectores disponibles en este momento.</div>';
      return;
    }

    let collectorsHTML = "";

    querySnapshot.forEach((doc) => {
      const collector = doc.data();
      const collectorId = doc.id;

      collectorsHTML += `
                <div class="collector-card" data-collector-id="${collectorId}">
                    <div class="collector-avatar">
                        <img src="${
                          collector.profileImage ||
                          "https://via.placeholder.com/80/007bff/ffffff?text=" +
                            (collector.firstName?.charAt(0) || "U") +
                            (collector.lastName?.charAt(0) || "S")
                        }" 
                             alt="${collector.firstName} ${collector.lastName}">
                        <div class="collector-rating">
                            <i class="fas fa-star"></i>
                            <span>${collector.rating || "5.0"}</span>
                        </div>
                    </div>
                    <div class="collector-info">
                        <h5>${collector.firstName} ${collector.lastName}</h5>
                        <p class="collector-specialty">${
                          collector.speciality || "Recolector General"
                        }</p>
                        <p class="collector-description">${
                          collector.description ||
                          "Recolector certificado de la organización."
                        }</p>
                        <div class="collector-stats">
                            <div class="stat">
                                <i class="fas fa-heart"></i>
                                <span>${
                                  collector.totalDonations || 0
                                } donaciones</span>
                            </div>
                            <div class="stat">
                                <i class="fas fa-phone"></i>
                                <span>${
                                  collector.phone || "No disponible"
                                }</span>
                            </div>
                        </div>
                        <button class="btn btn-primary select-collector-btn" onclick="selectCollector('${collectorId}', '${
        collector.firstName
      }', '${collector.lastName}')">
                            <i class="fas fa-check me-2"></i>Seleccionar
                        </button>
                    </div>
                </div>
            `;
    });

    collectorsGrid.innerHTML = collectorsHTML;
  } catch (error) {
    console.error("Error al cargar recolectores:", error);
    document.getElementById("collectorsGrid").innerHTML =
      '<div class="text-center text-danger">Error al cargar recolectores. Por favor recarga la página.</div>';
  }
}

// Seleccionar recolector
function selectCollector(collectorId, firstName, lastName) {
  donationData.selectedCollector = {
    id: collectorId,
    name: `${firstName} ${lastName}`,
  };

  // Actualizar UI
  document.querySelectorAll(".collector-card").forEach((card) => {
    card.classList.remove("selected");
  });

  document
    .querySelector(`[data-collector-id="${collectorId}"]`)
    .classList.add("selected");

  // Mostrar botón de continuar
  document.getElementById("continueToPayment").style.display = "block";
}

// Proceder al pago
function proceedToPayment() {
  if (!donationData.selectedCollector) {
    alert("Por favor selecciona un recolector");
    return;
  }

  // Cerrar modal anterior
  const collectorsModal = bootstrap.Modal.getInstance(
    document.getElementById("collectorsModal")
  );
  collectorsModal.hide();

  // Generar instrucciones de pago
  generatePaymentInstructions();

  // Abrir modal de pago
  const paymentModal = new bootstrap.Modal(
    document.getElementById("paymentModal")
  );
  paymentModal.show();
}

// Generar instrucciones de pago
function generatePaymentInstructions() {
  const instructions = document.getElementById("paymentInstructions");

  const paymentHTML = `
        <div class="payment-methods-tabs">
            <ul class="nav nav-tabs" id="paymentTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="yape-tab" data-bs-toggle="tab" data-bs-target="#yape" type="button">
                        <i class="fas fa-mobile-alt me-2"></i>Yape
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="transfer-tab" data-bs-toggle="tab" data-bs-target="#transfer" type="button">
                        <i class="fas fa-university me-2"></i>Transferencia
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="card-tab" data-bs-toggle="tab" data-bs-target="#card" type="button">
                        <i class="fas fa-credit-card me-2"></i>Tarjeta
                    </button>
                </li>
            </ul>
            <div class="tab-content" id="paymentTabsContent">
                <div class="tab-pane fade show active" id="yape" role="tabpanel">
                    <div class="payment-method-content">
                        <div class="text-center mb-3">
                            <img src="https://via.placeholder.com/200x200/1a1a1a/ffffff?text=QR+YAPE" alt="QR Yape" class="qr-code">
                        </div>
                        <div class="payment-details">
                            <h6>Escanea el código QR o transfiere a:</h6>
                            <p><strong>Número:</strong> 987-654-321</p>
                            <p><strong>Nombre:</strong> Fundación Solidaria</p>
                            <p><strong>Monto:</strong> S/ ${donationData.amount}</p>
                        </div>
                    </div>
                </div>
                <div class="tab-pane fade" id="transfer" role="tabpanel">
                    <div class="payment-method-content">
                        <h6>Datos para transferencia bancaria:</h6>
                        <div class="bank-details">
                            <p><strong>Banco:</strong> BCP</p>
                            <p><strong>Número de cuenta:</strong> 1234567890123456</p>
                            <p><strong>CCI:</strong> 00212345678901234567</p>
                            <p><strong>Titular:</strong> Fundación Solidaria</p>
                            <p><strong>Monto:</strong> S/ ${donationData.amount}</p>
                        </div>
                    </div>
                </div>
                <div class="tab-pane fade" id="card" role="tabpanel">
                    <div class="payment-method-content">
                        <p class="text-center">Próximamente disponible</p>
                        <p class="text-muted text-center">Por el momento, utiliza Yape o transferencia bancaria</p>
                    </div>
                </div>
            </div>
        </div>
    `;

  instructions.innerHTML = paymentHTML;
}

// Confirmar pago
async function confirmPayment() {
  try {
    // Guardar donación en Firebase
    const donationRecord = {
      amount: donationData.amount,
      donorType: donationData.donorType,
      donorInfo: donationData.donorInfo,
      collectorId: donationData.selectedCollector.id,
      collectorName: donationData.selectedCollector.name,
      status: "completed",
      createdAt: serverTimestamp(),
      paymentConfirmed: true,
    };

    const docRef = await addDoc(collection(db, "donations"), donationRecord);
    console.log("Donación guardada con ID:", docRef.id);

    // Cerrar modal de pago
    const paymentModal = bootstrap.Modal.getInstance(
      document.getElementById("paymentModal")
    );
    paymentModal.hide();

    // Mostrar confirmación
    showConfirmation();
  } catch (error) {
    console.error("Error al guardar donación:", error);
    alert("Error al procesar la donación. Por favor intenta nuevamente.");
  }
}

// Mostrar confirmación
function showConfirmation() {
  // Llenar datos de confirmación
  const donorName =
    donationData.donorType === "individual"
      ? `${donationData.donorInfo.firstName} ${donationData.donorInfo.lastName}`
      : donationData.donorInfo.companyName;

  document.getElementById("finalDonorName").textContent = donorName;
  document.getElementById("finalAmount").textContent = donationData.amount;
  document.getElementById("finalCollector").textContent =
    donationData.selectedCollector.name;
  document.getElementById("finalEmail").textContent =
    donationData.donorInfo.email;
  document.getElementById("finalDate").textContent =
    new Date().toLocaleDateString("es-PE");

  // Abrir modal de confirmación
  const confirmationModal = new bootstrap.Modal(
    document.getElementById("confirmationModal")
  );
  confirmationModal.show();
}

// Cargar testimonios (placeholder)
function loadTestimonials() {
  // Implementar carga de testimonios si es necesario
}

// Funciones de navegación entre modales
function goBackToType() {
  const donorDataModal = bootstrap.Modal.getInstance(
    document.getElementById("donorDataModal")
  );
  donorDataModal.hide();

  const donorTypeModal = new bootstrap.Modal(
    document.getElementById("donorTypeModal")
  );
  donorTypeModal.show();
}

function goBackToData() {
  const collectorsModal = bootstrap.Modal.getInstance(
    document.getElementById("collectorsModal")
  );
  collectorsModal.hide();

  const donorDataModal = new bootstrap.Modal(
    document.getElementById("donorDataModal")
  );
  donorDataModal.show();
}

function goBackToCollectors() {
  const paymentModal = bootstrap.Modal.getInstance(
    document.getElementById("paymentModal")
  );
  paymentModal.hide();

  const collectorsModal = new bootstrap.Modal(
    document.getElementById("collectorsModal")
  );
  collectorsModal.show();
}

// Resetear flujo de donación
function resetDonationFlow() {
  donationData = {
    amount: 0,
    donorType: "",
    donorInfo: {},
    selectedCollector: null,
    paymentMethod: "",
  };

  // Limpiar formularios
  document.getElementById("donorForm").reset();
  document
    .querySelectorAll(".amount-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document.getElementById("customAmountInput").value = "";
}

// Funciones adicionales
function shareOnSocial() {
  const text = `¡Acabo de hacer una donación de S/ ${donationData.amount} a esta increíble causa! 💝`;
  const url = window.location.href;

  if (navigator.share) {
    navigator.share({
      title: "Mi donación",
      text: text,
      url: url,
    });
  } else {
    // Fallback para navegadores que no soportan Web Share API
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank");
  }
}

// Hacer funciones globales para usar en onclick
window.selectCollector = selectCollector;
window.goBackToType = goBackToType;
window.goBackToData = goBackToData;
window.goBackToCollectors = goBackToCollectors;
window.resetDonationFlow = resetDonationFlow;
window.shareOnSocial = shareOnSocial;
