// email_verification_system.js
import {
  auth,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
} from "./firebase_config.js";

// =============================================
// SISTEMA DE VERIFICACIÓN DE CORREO ELECTRÓNICO
// =============================================

class EmailVerificationSystem {
  constructor() {
    this.modal = null;
    this.currentUser = null;
    this.userName = "";
    this.checkInterval = null;
    this.countdownInterval = null;
    this.isVerificationComplete = false;
    this.autoCheckEnabled = true;
    this.resendCooldown = 0;
    this.init();
  }

  // =============================================
  // INICIALIZACIÓN
  // =============================================

  init() {
    console.log("🔧 Inicializando sistema de verificación de email...");
    this.createVerificationModal();
    this.setupAuthListener();
    this.setupEventListeners();
  }

  // =============================================
  // CREACIÓN DEL MODAL
  // =============================================

  createVerificationModal() {
    // Verificar si ya existe el modal
    if (document.getElementById("emailVerificationModal")) {
      this.modal = document.getElementById("emailVerificationModal");
      return;
    }

    const modalHTML = `
      <div id="emailVerificationModal" class="email-verification-modal">
        <div class="verification-overlay"></div>
        <div class="verification-container">
          
          <!-- Header del Modal -->
          <div class="verification-header">
            <div class="verification-icon" id="headerIcon">📧</div>
            <h2 id="verificationTitle">Verificación de Correo Electrónico</h2>
            <div class="verification-status-badge" id="statusBadge">
              <span id="statusIcon">⏳</span>
              <span id="statusText">Pendiente</span>
            </div>
          </div>

          <!-- Contenido Principal -->
          <div class="verification-content" id="verificationContent">
            
            <!-- Información del Usuario -->
            <div class="user-info" id="userInfo">
              <div class="welcome-message">
                <h3 id="welcomeText">¡Hola Usuario!</h3>
                <p id="userEmail">Correo: usuario@ejemplo.com</p>
              </div>
            </div>

            <!-- Instrucciones -->
            <div class="verification-instructions" id="instructions">
              <div class="instruction-title">
                <span class="instruction-icon">📋</span>
                <h4>Pasos para verificar tu correo:</h4>
              </div>
              <ol class="instruction-list">
                <li>
                  <span class="step-icon">📥</span>
                  <span>Revisa tu bandeja de entrada y carpeta de <strong>spam/promociones</strong></span>
                </li>
                <li>
                  <span class="step-icon">🔍</span>
                  <span>Busca el correo con el asunto de verificación</span>
                </li>
                <li>
                  <span class="step-icon">🖱️</span>
                  <span>Haz clic en el <strong>enlace de verificación</strong></span>
                </li>
                <li>
                  <span class="step-icon">↩️</span>
                  <span>Regresa a esta página para continuar</span>
                </li>
              </ol>
            </div>

            <!-- Mensaje de Estado -->
            <div class="status-message" id="statusMessage">
              <div class="message-content">
                <p>📧 Correo de verificación enviado exitosamente</p>
                <p>Por favor, verifica tu email para continuar</p>
              </div>
            </div>

            <!-- Botones de Acción -->
            <div class="verification-actions">
              <button 
                id="checkStatusBtn" 
                class="action-btn primary"
                title="Verificar si el email ya fue confirmado"
              >
                <span class="btn-icon">🔍</span>
                <span class="btn-text">Verificar Estado</span>
                <span class="btn-loading" style="display: none;">⟳</span>
              </button>
              
              <button 
                id="resendEmailBtn" 
                class="action-btn secondary"
                title="Enviar nuevamente el correo de verificación"
              >
                <span class="btn-icon">📤</span>
                <span class="btn-text">Reenviar Correo</span>
                <span class="btn-loading" style="display: none;">⟳</span>
                <span class="btn-cooldown" style="display: none;">(<span id="cooldownTimer">0</span>s)</span>
              </button>
            </div>

            <!-- Verificación Automática -->
            <div class="auto-verification" id="autoVerification">
              <div class="auto-check-info">
                <span class="auto-icon">🔄</span>
                <span>Verificación automática en: <strong id="autoTimer">30</strong>s</span>
              </div>
              <button id="toggleAutoCheck" class="toggle-auto-btn" title="Activar/Desactivar verificación automática">
                <span id="toggleIcon">⏸️</span>
                <span id="toggleText">Pausar</span>
              </button>
            </div>

            <!-- Ayuda y Consejos -->
            <div class="verification-help">
              <details class="help-details">
                <summary class="help-summary">
                  <span class="help-icon">🤔</span>
                  ¿No encuentras el correo de verificación?
                </summary>
                <div class="help-content">
                  <ul class="help-list">
                    <li>
                      <span class="help-bullet">📧</span>
                      Revisa tu carpeta de <strong>spam</strong>, <strong>promociones</strong> o <strong>correo no deseado</strong>
                    </li>
                    <li>
                      <span class="help-bullet">⏰</span>
                      El correo puede tardar hasta <strong>5 minutos</strong> en llegar
                    </li>
                    <li>
                      <span class="help-bullet">✍️</span>
                      Verifica que tu dirección de correo esté escrita correctamente
                    </li>
                    <li>
                      <span class="help-bullet">📤</span>
                      Puedes usar el botón "Reenviar Correo" si no lo recibes
                    </li>
                    <li>
                      <span class="help-bullet">🔄</span>
                      La página verifica automáticamente cada 30 segundos
                    </li>
                  </ul>
                </div>
              </details>
            </div>

            <!-- Información Importante -->
            <div class="important-notice" id="importantNotice">
              <div class="notice-content">
                <span class="notice-icon">⚠️</span>
                <div class="notice-text">
                  <strong>¿Por qué no puedo cerrar esta ventana?</strong>
                  <p>Para garantizar la seguridad de tu cuenta, debes verificar tu correo electrónico antes de continuar. 
                  Esto nos ayuda a confirmar que la dirección de correo te pertenece y protege tu cuenta de accesos no autorizados.</p>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer con información adicional -->
          <div class="verification-footer">
            <div class="security-info">
              <span class="security-icon">🔒</span>
              <span>Verificación requerida por seguridad</span>
            </div>
          </div>

        </div>
      </div>
    `;

    // Insertar el modal en el body
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    this.modal = document.getElementById("emailVerificationModal");

    console.log("✅ Modal de verificación creado exitosamente");
  }

  // =============================================
  // CONFIGURACIÓN DE EVENTOS
  // =============================================

  setupEventListeners() {
    // Prevenir cierre del modal con ESC o clic fuera
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        this.modal &&
        this.modal.classList.contains("show")
      ) {
        e.preventDefault();
        this.showCannotCloseMessage();
      }
    });

    // Prevenir clic fuera del modal
    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (
          e.target === this.modal ||
          e.target.classList.contains("verification-overlay")
        ) {
          e.preventDefault();
          this.showCannotCloseMessage();
        }
      });
    }

    // Event listeners para botones
    this.setupButtonListeners();
  }

  setupButtonListeners() {
    // Botón verificar estado
    const checkBtn = document.getElementById("checkStatusBtn");
    if (checkBtn) {
      checkBtn.addEventListener("click", () => this.checkVerificationStatus());
    }

    // Botón reenviar email
    const resendBtn = document.getElementById("resendEmailBtn");
    if (resendBtn) {
      resendBtn.addEventListener("click", () => this.resendVerificationEmail());
    }

    // Toggle verificación automática
    const toggleBtn = document.getElementById("toggleAutoCheck");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggleAutoVerification());
    }
  }

  // =============================================
  // CONFIGURACIÓN DE AUTENTICACIÓN
  // =============================================

  setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
      if (user && this.modal && this.modal.classList.contains("show")) {
        this.currentUser = user;
        // Auto-verificar cuando cambie el estado de auth
        setTimeout(() => this.checkVerificationStatus(), 1000);
      }
    });
  }

  // =============================================
  // FUNCIONES PRINCIPALES
  // =============================================

  // Mostrar modal de verificación
  showVerificationModal(user, userName = "") {
    console.log("🚀 Mostrando modal de verificación para:", user.email);

    this.currentUser = user;
    this.userName = userName;
    this.isVerificationComplete = false;

    // Actualizar información del usuario
    this.updateUserInfo(user, userName);

    // Mostrar modal
    this.modal.classList.add("show");

    // Prevenir scroll del body
    document.body.style.overflow = "hidden";

    // Iniciar verificación automática
    this.startAutoVerification();

    // Estado inicial
    this.updateStatusBadge("pending", "⏳", "Pendiente");
    this.showStatusMessage(
      "info",
      "📧 Correo de verificación enviado. Por favor, revisa tu bandeja de entrada."
    );

    console.log("✅ Modal de verificación mostrado");
  }

  // Actualizar información del usuario en el modal
  updateUserInfo(user, userName) {
    const welcomeText = document.getElementById("welcomeText");
    const userEmail = document.getElementById("userEmail");

    if (welcomeText) {
      welcomeText.textContent = userName
        ? `¡Hola ${userName}! 👋`
        : "¡Hola! 👋";
    }

    if (userEmail) {
      userEmail.innerHTML = `<strong>📧 Correo:</strong> ${user.email}`;
    }
  }

  // =============================================
  // VERIFICACIÓN DE ESTADO
  // =============================================

  async checkVerificationStatus() {
    if (!this.currentUser) {
      console.error("❌ No hay usuario autenticado");
      return;
    }

    try {
      console.log("🔍 Verificando estado de verificación...");

      // UI de loading
      this.setButtonLoading("checkStatusBtn", true);
      this.updateStatusBadge("checking", "🔄", "Verificando...");

      // Recargar datos del usuario desde Firebase
      await this.currentUser.reload();

      if (this.currentUser.emailVerified) {
        console.log("✅ ¡Correo verificado exitosamente!");
        this.handleVerificationSuccess();
      } else {
        console.log("❌ Correo aún no verificado");
        this.updateStatusBadge("pending", "⏳", "Pendiente");
        this.showStatusMessage(
          "warning",
          "⚠️ Tu correo aún no ha sido verificado. Por favor, revisa tu bandeja de entrada y haz clic en el enlace de verificación."
        );
      }
    } catch (error) {
      console.error("❌ Error al verificar estado:", error);
      this.updateStatusBadge("error", "❌", "Error");
      this.showStatusMessage(
        "error",
        "❌ Error al verificar el estado. Por favor, intenta nuevamente."
      );
    } finally {
      this.setButtonLoading("checkStatusBtn", false);
    }
  }

  // Manejar verificación exitosa
  handleVerificationSuccess() {
    console.log("🎉 Procesando verificación exitosa...");

    this.isVerificationComplete = true;

    // Detener verificación automática
    this.stopAutoVerification();

    // Actualizar estado visual
    this.updateStatusBadge("success", "✅", "Verificado");
    this.updateModalForSuccess();

    // Auto-cerrar después de mostrar mensaje de éxito
    setTimeout(() => {
      this.completeVerificationProcess();
    }, 3000);
  }

  // Actualizar modal para mostrar éxito
  updateModalForSuccess() {
    const content = document.getElementById("verificationContent");
    if (!content) return;

    content.innerHTML = `
      <div class="verification-success">
        <div class="success-animation">
          <div class="success-icon">🎉</div>
          <div class="success-checkmark">✅</div>
        </div>
        
        <div class="success-message">
          <h3>¡Verificación Exitosa!</h3>
          <p>Tu correo electrónico ha sido verificado correctamente.</p>
          <p class="welcome-text">¡Bienvenido al sistema, ${this.userName}!</p>
        </div>
        
        <div class="success-info">
          <div class="info-item">
            <span class="info-icon">📧</span>
            <span>Email: ${this.currentUser.email}</span>
          </div>
          <div class="info-item">
            <span class="info-icon">⏰</span>
            <span>Verificado: ${new Date().toLocaleString()}</span>
          </div>
        </div>
        
        <div class="success-actions">
          <button id="continueBtn" class="action-btn success">
            <span class="btn-icon">🚀</span>
            <span class="btn-text">Continuar al Sistema</span>
          </button>
        </div>
        
        <div class="auto-redirect">
          <p>Serás redirigido automáticamente en <span id="redirectTimer">3</span> segundos...</p>
        </div>
      </div>
    `;

    // Configurar botón de continuar
    const continueBtn = document.getElementById("continueBtn");
    if (continueBtn) {
      continueBtn.addEventListener("click", () =>
        this.completeVerificationProcess()
      );
    }

    // Countdown para redirección
    this.startRedirectCountdown();
  }

  // Iniciar countdown de redirección
  startRedirectCountdown() {
    let countdown = 3;
    const timerElement = document.getElementById("redirectTimer");

    const countdownInterval = setInterval(() => {
      countdown--;
      if (timerElement) {
        timerElement.textContent = countdown;
      }

      if (countdown <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  // =============================================
  // REENVÍO DE EMAIL
  // =============================================

  async resendVerificationEmail() {
    if (!this.currentUser) {
      console.error("❌ No hay usuario autenticado");
      return;
    }

    // Verificar cooldown
    if (this.resendCooldown > 0) {
      this.showStatusMessage(
        "warning",
        `⏰ Debes esperar ${this.resendCooldown} segundos antes de reenviar el correo.`
      );
      return;
    }

    try {
      console.log("📤 Reenviando correo de verificación...");

      this.setButtonLoading("resendEmailBtn", true);

      await sendEmailVerification(this.currentUser, {
        url: window.location.origin + "/login.html",
        handleCodeInApp: false,
      });

      console.log("✅ Correo reenviado exitosamente");

      this.showStatusMessage(
        "success",
        `✅ Correo reenviado exitosamente a ${this.currentUser.email}. Revisa tu bandeja de entrada y carpeta de spam.`
      );

      // Iniciar cooldown
      this.startResendCooldown();

      // Reiniciar verificación automática
      this.startAutoVerification();
    } catch (error) {
      console.error("❌ Error al reenviar correo:", error);

      let errorMessage = "Error al reenviar correo. Intenta nuevamente.";

      switch (error.code) {
        case "auth/too-many-requests":
          errorMessage =
            "Demasiados intentos. Espera 5 minutos antes de intentar nuevamente.";
          this.startResendCooldown(300); // 5 minutos
          break;
        case "auth/network-request-failed":
          errorMessage = "Error de conexión. Verifica tu conexión a internet.";
          break;
      }

      this.showStatusMessage("error", `❌ ${errorMessage}`);
    } finally {
      this.setButtonLoading("resendEmailBtn", false);
    }
  }

  // Iniciar cooldown para reenvío
  startResendCooldown(seconds = 60) {
    this.resendCooldown = seconds;
    const btn = document.getElementById("resendEmailBtn");
    const cooldownElement = document.getElementById("cooldownTimer");
    const cooldownSpan = document.querySelector(".btn-cooldown");

    if (btn) btn.disabled = true;
    if (cooldownSpan) cooldownSpan.style.display = "inline";

    const cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (cooldownElement) {
        cooldownElement.textContent = this.resendCooldown;
      }

      if (this.resendCooldown <= 0) {
        clearInterval(cooldownInterval);
        if (btn) btn.disabled = false;
        if (cooldownSpan) cooldownSpan.style.display = "none";
      }
    }, 1000);
  }

  // =============================================
  // VERIFICACIÓN AUTOMÁTICA
  // =============================================

  startAutoVerification() {
    this.stopAutoVerification(); // Limpiar cualquier intervalo existente

    if (!this.autoCheckEnabled) return;

    let countdown = 30;
    const timerElement = document.getElementById("autoTimer");

    // Actualizar timer cada segundo
    this.countdownInterval = setInterval(() => {
      countdown--;
      if (timerElement) {
        timerElement.textContent = countdown;
      }

      if (countdown <= 0) {
        // Verificar estado automáticamente
        this.checkVerificationStatus();
        countdown = 60; // Reiniciar countdown
      }
    }, 1000);

    console.log("🔄 Verificación automática iniciada");
  }

  stopAutoVerification() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  toggleAutoVerification() {
    this.autoCheckEnabled = !this.autoCheckEnabled;

    const toggleIcon = document.getElementById("toggleIcon");
    const toggleText = document.getElementById("toggleText");
    const autoVerification = document.getElementById("autoVerification");

    if (this.autoCheckEnabled) {
      this.startAutoVerification();
      if (toggleIcon) toggleIcon.textContent = "⏸️";
      if (toggleText) toggleText.textContent = "Pausar";
      if (autoVerification) autoVerification.classList.remove("paused");
    } else {
      this.stopAutoVerification();
      if (toggleIcon) toggleIcon.textContent = "▶️";
      if (toggleText) toggleText.textContent = "Reanudar";
      if (autoVerification) autoVerification.classList.add("paused");
    }
  }

  // =============================================
  // FUNCIONES DE UI
  // =============================================

  updateStatusBadge(status, icon, text) {
    const statusIcon = document.getElementById("statusIcon");
    const statusText = document.getElementById("statusText");
    const statusBadge = document.getElementById("statusBadge");

    if (statusIcon) statusIcon.textContent = icon;
    if (statusText) statusText.textContent = text;
    if (statusBadge) {
      statusBadge.className = `verification-status-badge status-${status}`;
    }
  }

  showStatusMessage(type, message) {
    const statusMessage = document.getElementById("statusMessage");
    if (!statusMessage) return;

    statusMessage.className = `status-message ${type}`;
    statusMessage.innerHTML = `
      <div class="message-content">
        <p>${message}</p>
      </div>
    `;

    // Auto-ocultar mensajes temporales
    if (type !== "info") {
      setTimeout(() => {
        if (statusMessage && !this.isVerificationComplete) {
          statusMessage.className = "status-message info";
          statusMessage.innerHTML = `
            <div class="message-content">
              <p>📧 Correo de verificación enviado. Por favor, revisa tu bandeja de entrada.</p>
            </div>
          `;
        }
      }, 5000);
    }
  }

  setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    const btnText = button.querySelector(".btn-text");
    const btnLoading = button.querySelector(".btn-loading");

    if (isLoading) {
      button.disabled = true;
      button.classList.add("loading");
      if (btnText) btnText.style.display = "none";
      if (btnLoading) btnLoading.style.display = "inline";
    } else {
      button.disabled = false;
      button.classList.remove("loading");
      if (btnText) btnText.style.display = "inline";
      if (btnLoading) btnLoading.style.display = "none";
    }
  }

  showCannotCloseMessage() {
    // Mostrar animación de "sacudida"
    if (this.modal) {
      this.modal.classList.add("shake");
      setTimeout(() => {
        this.modal.classList.remove("shake");
      }, 500);
    }

    // Mostrar mensaje temporal
    this.showStatusMessage(
      "warning",
      "⚠️ Debes verificar tu correo electrónico antes de continuar. Esto es requerido por seguridad."
    );

    // Highlight del aviso importante
    const importantNotice = document.getElementById("importantNotice");
    if (importantNotice) {
      importantNotice.classList.add("highlight");
      setTimeout(() => {
        importantNotice.classList.remove("highlight");
      }, 5000);
    }
  }

  // =============================================
  // FINALIZACIÓN DEL PROCESO
  // =============================================

  completeVerificationProcess() {
    console.log("🏁 Completando proceso de verificación...");

    // Detener todos los timers
    this.stopAutoVerification();

    // Restaurar scroll del body
    document.body.style.overflow = "auto";

    // Cerrar modal
    this.modal.classList.remove("show");

    // Cerrar sesión para forzar nuevo login con email verificado
    signOut(auth)
      .then(() => {
        console.log("🚪 Sesión cerrada exitosamente");

        // Redirigir según contexto
        if (typeof window.switchTab === "function") {
          window.switchTab("login");
        } else if (window.location.pathname.includes("register")) {
          window.location.href = "/login.html";
        } else {
          window.location.reload();
        }
      })
      .catch((error) => {
        console.error("❌ Error al cerrar sesión:", error);
        // Forzar recarga en caso de error
        window.location.reload();
      });
  }

  // =============================================
  // MÉTODO ESTÁTICO PARA USO EXTERNO
  // =============================================

  static showForUser(user, userName = "") {
    if (!window.emailVerificationSystem) {
      window.emailVerificationSystem = new EmailVerificationSystem();
    }
    window.emailVerificationSystem.showVerificationModal(user, userName);
  }
}

// =============================================
// INICIALIZACIÓN GLOBAL
// =============================================

// Crear instancia global cuando se carga el módulo
document.addEventListener("DOMContentLoaded", () => {
  if (!window.emailVerificationSystem) {
    window.emailVerificationSystem = new EmailVerificationSystem();
    console.log("✅ Sistema de verificación de email inicializado globalmente");
  }
});

// Exportar para uso en módulos
export { EmailVerificationSystem };

console.log(
  "📧 Sistema de verificación de correo electrónico cargado exitosamente"
);
