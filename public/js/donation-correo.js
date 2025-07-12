// donation-correo.js - EmailManager con subida de archivos temporal
import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  setDoc,
} from "./firebase_config.js";

class EmailManager {
  constructor() {
    this.emailConfig = {
      from: "noreply@ecovoluntarios.com",
      fromName: "EcoVoluntarios UNFV",
      signature:
        "Saludos cordiales,\nEcoVoluntarios UNFV\nUniversidad Nacional Federico Villarreal",
    };

    this.emailJSConfig = {
      serviceID: "service_wb8n9wg",
      templateID: "template_7hm5mmg",
      publicKey: "UMoK0KSvnzx9bpyPf",
    };

    this.emailTemplates = this.getEmailTemplates();
    this.selectedDonations = new Set();
    this.allDonations = [];
    this.emailHistory = [];
    this.isInitialized = false;
    this.attachmentFile = null;
    this.uploadedFileData = null;
  }

  initializeEmailJS() {
    if (typeof emailjs === "undefined") {
      throw new Error("EmailJS no disponible");
    }
    emailjs.init(this.emailJSConfig.publicKey);
  }

  async init() {
    if (this.isInitialized) return;

    try {
      this.initializeEmailJS();
      await this.loadEmailConfig();
      this.setupEventListeners();
      await this.loadDonations();
      await this.loadEmailHistory();
      this.isInitialized = true;
    } catch (error) {
      this.showError(
        "Error al inicializar el sistema de correos: " + error.message
      );
    }
  }

  setupEventListeners() {
    document
      .querySelectorAll('input[name="recipientType"]')
      .forEach((radio) => {
        radio.addEventListener("change", () => this.updateRecipientCount());
      });

    const templateSelect = document.getElementById("emailTemplate");
    if (templateSelect) {
      templateSelect.addEventListener("change", () => this.loadEmailTemplate());
    }

    const pdfInput = document.getElementById("pdfAttachment");
    if (pdfInput) {
      pdfInput.addEventListener("change", (e) =>
        this.handlePdfAttachment(e.target)
      );
    }
  }

  getEmailTemplates() {
    return {
      agradecimiento: {
        subject: "Agradecimiento por tu donación - EcoVoluntarios UNFV",
        content: `Estimado/a {nombre} {apellido},

Queremos expresar nuestro más sincero agradecimiento por tu valiosa donación de S/ {monto} realizada el {fecha}.

Tu generosidad contribuye significativamente a nuestros proyectos ambientales y nos permite seguir trabajando por un futuro más sostenible.

Estado de tu donación: {estado}

¡Gracias por ser parte del cambio!

{signature}`,
      },
      validacion: {
        subject: "Tu donación ha sido validada - EcoVoluntarios UNFV",
        content: `Estimado/a {nombre} {apellido},

Nos complace informarte que tu donación de S/ {monto} realizada el {fecha} ha sido validada exitosamente.

Tu contribución ya forma parte de nuestros proyectos ambientales y estamos muy agradecidos por tu apoyo.

Pronto recibirás más información sobre el impacto de tu donación.

{signature}`,
      },
      recordatorio: {
        subject: "Recordatorio sobre tu donación - EcoVoluntarios UNFV",
        content: `Estimado/a {nombre} {apellido},

Te recordamos que tienes una donación pendiente de S/ {monto} registrada el {fecha}.

Si ya realizaste el pago, por favor comparte tu comprobante para validar tu donación.

Si tienes alguna consulta, no dudes en contactarnos.

{signature}`,
      },
    };
  }

  async loadEmailConfig() {
    try {
      const configDoc = await getDoc(doc(db, "configuracion", "email"));
      if (configDoc.exists()) {
        this.emailConfig = { ...this.emailConfig, ...configDoc.data() };
      }
    } catch (error) {
      // Usar valores por defecto
    }
  }

  async loadDonations() {
    try {
      const donationsRef = collection(db, "donaciones");
      const q = query(donationsRef, orderBy("fechaDonacion", "desc"));
      const querySnapshot = await getDocs(q);

      this.allDonations = [];
      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (
          data.EmailUsuarioDonador &&
          data.EmailUsuarioDonador.trim() !== ""
        ) {
          this.allDonations.push({ id: doc.id, ...data });
        }
      });
    } catch (error) {
      this.showError("Error al cargar las donaciones");
    }
  }

  async loadEmailHistory() {
    try {
      const historyRef = collection(db, "email_history");
      const q = query(historyRef, orderBy("sentAt", "desc"));
      const querySnapshot = await getDocs(q);

      this.emailHistory = [];
      querySnapshot.docs.forEach((doc) => {
        this.emailHistory.push({ id: doc.id, ...doc.data() });
      });

      this.updateEmailHistoryTable();
    } catch (error) {
      // Error silencioso
    }
  }

  loadEmailTemplate() {
    const templateId = document.getElementById("emailTemplate")?.value;
    if (!templateId || templateId === "custom") {
      if (templateId === "custom") {
        document.getElementById("emailSubject").value = "";
        document.getElementById("emailContent").value = "";
      }
      return;
    }

    const template = this.emailTemplates[templateId];
    if (template) {
      document.getElementById("emailSubject").value = template.subject;
      document.getElementById("emailContent").value = template.content.replace(
        "{signature}",
        this.emailConfig.signature
      );
    }
  }

  async getRecipients() {
    const recipientType = document.querySelector(
      'input[name="recipientType"]:checked'
    )?.value;
    let recipients = [];

    try {
      switch (recipientType) {
        case "all":
          recipients = this.getAllDonors();
          break;
        case "validated":
          recipients = this.getValidatedDonors();
          break;
        case "pending":
          recipients = this.getPendingDonors();
          break;
        case "selected":
          recipients = this.getSelectedDonors();
          break;
        default:
          recipients = this.getValidatedDonors();
      }
    } catch (error) {
      this.showError(
        "Error al obtener la lista de destinatarios: " + error.message
      );
    }

    return recipients;
  }

  getAllDonors() {
    return this.processDonations(this.allDonations);
  }

  getValidatedDonors() {
    const validatedDonations = this.allDonations.filter((donation) => {
      return (
        donation.estadoValidacion === true ||
        donation.estadoValidacion === "validado" ||
        donation.estadoValidacion === "validada"
      );
    });
    return this.processDonations(validatedDonations);
  }

  getPendingDonors() {
    const pendingDonations = this.allDonations.filter((donation) => {
      return (
        donation.estadoValidacion === "pendiente" ||
        donation.estadoValidacion === null ||
        donation.estadoValidacion === undefined ||
        donation.estadoValidacion === ""
      );
    });
    return this.processDonations(pendingDonations);
  }

  getSelectedDonors() {
    if (window.donationsManager && window.donationsManager.selectedDonations) {
      this.selectedDonations = new Set(
        window.donationsManager.selectedDonations
      );
    }

    if (this.selectedDonations.size === 0) {
      throw new Error(
        "No hay donaciones seleccionadas. Por favor, selecciona al menos una donación en la tabla principal."
      );
    }

    const selectedDonations = this.allDonations.filter((donation) =>
      this.selectedDonations.has(donation.id)
    );
    return this.processDonations(selectedDonations);
  }

  processDonations(donations) {
    const recipients = [];
    const emailSet = new Set();

    donations.forEach((donation) => {
      const email = donation.EmailUsuarioDonador;
      if (email && email.trim() !== "" && !emailSet.has(email.toLowerCase())) {
        emailSet.add(email.toLowerCase());
        recipients.push(this.formatRecipient(donation));
      }
    });

    return recipients;
  }

  formatRecipient(donation) {
    return {
      id: donation.id,
      email: donation.EmailUsuarioDonador,
      nombre: donation.NombreUsuarioDonador || "Estimado/a",
      apellido: donation.ApellidoUsuarioDonador || "Donador",
      razonSocial: donation.RazonSocialUsuarioDonador,
      tipoUsuario: donation.Tipo_Usuario,
      monto: parseFloat(donation.monto || 0).toFixed(2),
      fecha: this.formatDate(donation.fechaDonacion),
      estado: this.getStatusText(donation.estadoValidacion),
      telefono: donation.TelefonoUsuarioDonador || "",
      dni: donation.DNIUsuarioDonador || "",
    };
  }

  formatDate(dateInput) {
    if (!dateInput) return "N/A";

    let date;
    if (dateInput && dateInput.toDate) {
      date = dateInput.toDate();
    } else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) return "N/A";

    return date.toLocaleDateString("es-PE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  getStatusText(status) {
    if (status === true || status === "validada" || status === "validado")
      return "Validada";
    if (status === false || status === "rechazada" || status === "rechazado")
      return "Rechazada";
    return "Pendiente de validación";
  }

  async updateRecipientCount() {
    try {
      const recipients = await this.getRecipients();
      const countElement = document.getElementById("recipientCount");
      if (countElement) {
        const count = recipients.length;
        countElement.textContent = `${count} destinatario${
          count !== 1 ? "s" : ""
        } seleccionado${count !== 1 ? "s" : ""}`;
        countElement.className = count > 0 ? "text-success" : "text-danger";
      }
    } catch (error) {
      const countElement = document.getElementById("recipientCount");
      if (countElement) {
        countElement.textContent = error.message;
        countElement.className = "text-danger";
      }
    }
  }

  personalizeEmail(template, recipient) {
    let content = template;
    let displayName = "";

    if (recipient.tipoUsuario === "PERSONA NATURAL") {
      displayName = `${recipient.nombre} ${recipient.apellido}`.trim();
    } else {
      displayName =
        recipient.razonSocial ||
        `${recipient.nombre} ${recipient.apellido}`.trim();
    }

    const replacements = {
      "{nombre}":
        recipient.tipoUsuario === "PERSONA NATURAL"
          ? recipient.nombre
          : recipient.razonSocial || recipient.nombre,
      "{apellido}":
        recipient.tipoUsuario === "PERSONA NATURAL" ? recipient.apellido : "",
      "{nombre_completo}": displayName,
      "{monto}": recipient.monto,
      "{fecha}": recipient.fecha,
      "{estado}": recipient.estado,
      "{email}": recipient.email,
      "{telefono}": recipient.telefono,
      "{dni}": recipient.dni,
      "{signature}": this.emailConfig.signature,
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      const regex = new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g");
      content = content.replace(regex, value || "");
    });

    return content.trim();
  }

  async previewEmail() {
    try {
      const recipients = await this.getRecipients();
      if (recipients.length === 0) {
        this.showWarning("No hay destinatarios para mostrar vista previa");
        return;
      }

      const subject = document.getElementById("emailSubject")?.value || "";
      const content = document.getElementById("emailContent")?.value || "";

      if (!subject || !content) {
        this.showWarning("Por favor completa el asunto y contenido del correo");
        return;
      }

      const exampleRecipient = recipients[0];
      const personalizedContent = this.personalizeEmail(
        content,
        exampleRecipient
      );

      document.getElementById("previewRecipient").textContent =
        exampleRecipient.email;
      document.getElementById("previewSubject").textContent = subject;
      document.getElementById("previewContent").textContent =
        personalizedContent;

      const pdfInput = document.getElementById("pdfAttachment");
      const previewAttachment = document.getElementById("previewAttachment");
      const previewAttachmentName = document.getElementById(
        "previewAttachmentName"
      );

      if (this.uploadedFileData) {
        previewAttachment.style.display = "block";
        previewAttachmentName.textContent = this.uploadedFileData.name;
      } else {
        previewAttachment.style.display = "none";
      }

      const modal = new bootstrap.Modal(
        document.getElementById("emailPreviewModal")
      );
      modal.show();
    } catch (error) {
      this.showError("Error al generar vista previa: " + error.message);
    }
  }

  // MÉTODOS DE SUBIDA DE ARCHIVOS
  async uploadFileToTempStorage(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("https://file.io/", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        return {
          url: result.link,
          key: result.key,
          name: file.name,
          size: file.size,
          service: "file.io",
          expiresIn: "14 días o 1 descarga",
        };
      } else {
        throw new Error(result.message || "Error al subir archivo");
      }
    } catch (error) {
      try {
        return await this.uploadToTmpFiles(file);
      } catch (fallbackError) {
        throw new Error(
          "No se pudo subir el archivo a ningún servicio temporal"
        );
      }
    }
  }

  async uploadToTmpFiles(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.status === "success") {
      return {
        url: result.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/"),
        name: file.name,
        size: file.size,
        service: "tmpfiles.org",
        expiresIn: "1 hora",
      };
    } else {
      throw new Error("Error al subir a tmpfiles.org");
    }
  }

  async handlePdfAttachment(input) {
    const file = input.files[0];
    const preview = document.getElementById("pdfPreview");

    if (!file) {
      preview.style.display = "none";
      this.attachmentFile = null;
      this.uploadedFileData = null;
      return;
    }

    if (file.type !== "application/pdf") {
      this.showWarning("Solo se permiten archivos PDF");
      input.value = "";
      preview.style.display = "none";
      this.attachmentFile = null;
      this.uploadedFileData = null;
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      this.showWarning("El archivo es muy grande. Tamaño máximo: 50MB");
      input.value = "";
      preview.style.display = "none";
      this.attachmentFile = null;
      this.uploadedFileData = null;
      return;
    }

    this.attachmentFile = file;
    document.getElementById("pdfFileName").textContent = file.name;
    document.getElementById("pdfFileSize").textContent = this.formatFileSize(
      file.size
    );
    preview.style.display = "block";

    const uploadStatus = document.createElement("div");
    uploadStatus.id = "uploadStatus";
    uploadStatus.className = "mt-2";
    uploadStatus.innerHTML = `
      <div class="alert alert-info d-flex align-items-center">
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Subiendo archivo para envío...</span>
      </div>
    `;

    const existingStatus = document.getElementById("uploadStatus");
    if (existingStatus) existingStatus.remove();
    preview.appendChild(uploadStatus);

    try {
      this.uploadedFileData = await this.uploadFileToTempStorage(file);

      uploadStatus.innerHTML = `
        <div class="alert alert-success d-flex align-items-center">
          <i class="fas fa-check-circle me-2"></i>
          <div>
            <strong>Archivo listo para envío</strong><br>
            <small class="text-muted">Disponible por ${this.uploadedFileData.expiresIn}</small>
          </div>
        </div>
      `;
    } catch (error) {
      uploadStatus.innerHTML = `
        <div class="alert alert-danger d-flex align-items-center">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <div>
            <strong>Error al subir archivo</strong><br>
            <small>${error.message}</small>
          </div>
        </div>
      `;
      this.uploadedFileData = null;
    }
  }

  async sendEmail(to, subject, content, recipient, attachmentData = null) {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        throw new Error("Email inválido");
      }

      // Personalizar contenido con enlace de descarga si hay archivo
      let emailContent = content;

      if (this.uploadedFileData) {
        emailContent += `\n\n---\n📎 ARCHIVO ADJUNTO DISPONIBLE:\n\n`;
        emailContent += `📄 Nombre: ${this.uploadedFileData.name}\n`;
        emailContent += `💾 Tamaño: ${this.formatFileSize(
          this.uploadedFileData.size
        )}\n`;
        emailContent += `🔗 Descargar: ${this.uploadedFileData.url}\n\n`;
        emailContent += `⚠️ IMPORTANTE: Este enlace estará disponible por ${this.uploadedFileData.expiresIn}. Por favor descarga el archivo lo antes posible.\n`;
        emailContent += `📞 Si tienes problemas para descargar, responde a este correo y te ayudaremos.`;
      }

      // PARÁMETROS SIMPLIFICADOS - Solo las variables que están en la plantilla
      const templateParams = {
        to_email: to,
        to_name: `${recipient.nombre} ${recipient.apellido}`.trim(),
        from_name: this.emailConfig.fromName,
        subject: subject,
        message: emailContent,
        donation_amount: `S/ ${recipient.monto}`,
        donation_date: recipient.fecha,
        donation_status: recipient.estado,
      };

      const response = await emailjs.send(
        this.emailJSConfig.serviceID,
        this.emailJSConfig.templateID,
        templateParams
      );

      return {
        messageId: response.text || `emailjs_${Date.now()}`,
        status: "sent",
        to: to,
        timestamp: new Date().toISOString(),
        service: "emailjs",
        response: response,
        hasAttachment: !!this.uploadedFileData,
        downloadLink: this.uploadedFileData?.url || null,
      };
    } catch (error) {
      let errorMessage = error.message;
      if (error.text) {
        errorMessage = `Error de EmailJS: ${error.text}`;
      } else if (error.status) {
        errorMessage = `Error HTTP ${error.status}: ${
          error.text || "Error desconocido"
        }`;
      }
      throw new Error(errorMessage);
    }
  }

  async sendEmailsToRecipients() {
    try {
      if (typeof emailjs === "undefined") {
        this.showError(
          "EmailJS no está disponible. Recarga la página e intenta de nuevo."
        );
        return;
      }

      const subject = document.getElementById("emailSubject")?.value?.trim();
      const content = document.getElementById("emailContent")?.value?.trim();

      if (!subject || !content) {
        this.showWarning("Por favor completa todos los campos requeridos");
        return;
      }

      if (this.attachmentFile && !this.uploadedFileData) {
        this.showError(
          "El archivo PDF aún se está subiendo o falló la subida. Por favor espera o intenta de nuevo."
        );
        return;
      }

      const recipients = await this.getRecipients();
      if (recipients.length === 0) {
        this.showWarning("No hay destinatarios válidos para enviar correos");
        return;
      }

      let attachmentInfo = "";
      if (this.uploadedFileData) {
        attachmentInfo = `\n\n📎 Archivo incluido: ${
          this.uploadedFileData.name
        } (${this.formatFileSize(
          this.uploadedFileData.size
        )})\n🔗 Los destinatarios recibirán un enlace de descarga válido por ${
          this.uploadedFileData.expiresIn
        }`;
      }

      const confirmMessage = `⚠️ ATENCIÓN: Estás a punto de enviar ${
        recipients.length
      } correo${recipients.length !== 1 ? "s" : ""} REAL${
        recipients.length !== 1 ? "ES" : ""
      }.

📧 Destinatarios: ${recipients
        .map((r) => r.email)
        .slice(0, 3)
        .join(", ")}${recipients.length > 3 ? "..." : ""}

✉️ Asunto: "${subject}"${attachmentInfo}

¿Estás seguro de continuar?`;

      if (!confirm(confirmMessage)) return;

      this.showProgress(true);
      this.updateProgress(0, recipients.length);

      const sendBtn = document.getElementById("sendEmailBtn");
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin me-2"></i>Enviando correos reales...';
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      let attachmentData = null;
      if (this.uploadedFileData) {
        attachmentData = {
          name: this.uploadedFileData.name,
          size: this.uploadedFileData.size,
          type: "application/pdf",
          downloadUrl: this.uploadedFileData.url,
          service: this.uploadedFileData.service,
          expiresIn: this.uploadedFileData.expiresIn,
        };
      }

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        try {
          const personalizedContent = this.personalizeEmail(content, recipient);
          await this.sendEmail(
            recipient.email,
            subject,
            personalizedContent,
            recipient,
            attachmentData
          );
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            email: recipient.email,
            error: error.message,
          });
        }

        this.updateProgress(i + 1, recipients.length);
        await this.delay(500);
      }

      await this.saveEmailHistory(
        subject,
        content,
        recipients,
        successCount,
        errorCount,
        attachmentData,
        errors
      );

      this.showProgress(false);
      this.resetSendButton();

      if (successCount > 0) {
        const attachmentMsg = attachmentData
          ? ` con enlace de descarga para "${attachmentData.name}"`
          : "";
        const message = `🎉 ${successCount} correo${
          successCount !== 1 ? "s" : ""
        } enviado${successCount !== 1 ? "s" : ""} exitosamente${attachmentMsg}${
          errorCount > 0 ? `. ⚠️ ${errorCount} fallaron.` : ""
        }`;
        this.showSuccess(message);

        if (attachmentData) {
          setTimeout(() => {
            this.showSuccess(
              `📎 Archivo "${attachmentData.name}" disponible por ${attachmentData.expiresIn} en el enlace enviado.`
            );
          }, 2000);
        }

        await this.loadEmailHistory();
      } else {
        this.showError("❌ No se pudo enviar ningún correo.");
      }

      setTimeout(() => this.closeModal("sendEmailModal"), 3000);
    } catch (error) {
      this.showError(`Error crítico al enviar correos: ${error.message}`);
      this.showProgress(false);
      this.resetSendButton();
    }
  }

  async saveEmailHistory(
    subject,
    content,
    recipients,
    successCount,
    errorCount,
    attachmentData = null,
    errors = []
  ) {
    try {
      const cleanRecipients = recipients.map((recipient) => ({
        id: recipient.id || "",
        email: recipient.email || "",
        nombre: recipient.nombre || "",
        apellido: recipient.apellido || "",
        razonSocial: recipient.razonSocial || "",
        tipoUsuario: recipient.tipoUsuario || "",
        monto: recipient.monto || "0",
        fecha: recipient.fecha || "",
        estado: recipient.estado || "",
        telefono: recipient.telefono || "",
        dni: recipient.dni || "",
      }));

      const cleanErrors = errors.map((error) => ({
        email: error.email || "",
        error: error.error || "Error desconocido",
      }));

      const historyData = {
        subject: subject || "",
        content: content || "",
        recipientCount: recipients.length || 0,
        successCount: successCount || 0,
        errorCount: errorCount || 0,
        sentAt: Timestamp.now(),
        sentBy: auth.currentUser?.uid || "unknown",
        sentByName:
          auth.currentUser?.displayName || auth.currentUser?.email || "Usuario",
        recipients: cleanRecipients.slice(0, 50),
        status: (errorCount || 0) === 0 ? "completed" : "partial",
        errors: cleanErrors.slice(0, 10),
        service: "emailjs",
      };

      if (attachmentData && attachmentData.name) {
        historyData.attachment = {
          name: attachmentData.name || "",
          size: attachmentData.size || 0,
          type: attachmentData.type || "",
          downloadUrl: attachmentData.downloadUrl || "",
          service: attachmentData.service || "",
          expiresIn: attachmentData.expiresIn || "",
        };
      }

      const docRef = await addDoc(collection(db, "email_history"), historyData);
      this.emailHistory.unshift({ id: docRef.id, ...historyData });
      this.updateEmailHistoryTable();
    } catch (error) {
      // Error silencioso
    }
  }

  showProgress(show) {
    const progressDiv = document.getElementById("emailProgress");
    if (progressDiv) {
      progressDiv.style.display = show ? "block" : "none";
    }
  }

  updateProgress(current, total) {
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    if (progressBar && progressText) {
      const percentage = total > 0 ? (current / total) * 100 : 0;
      progressBar.style.width = `${percentage}%`;
      progressText.textContent = `${current} / ${total}`;
    }
  }

  resetSendButton() {
    const sendBtn = document.getElementById("sendEmailBtn");
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML =
        '<i class="fas fa-paper-plane me-2"></i>Enviar Correos';
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  clearPdfAttachment() {
    const input = document.getElementById("pdfAttachment");
    const preview = document.getElementById("pdfPreview");
    const uploadStatus = document.getElementById("uploadStatus");

    if (input) input.value = "";
    if (preview) preview.style.display = "none";
    if (uploadStatus) uploadStatus.remove();

    this.attachmentFile = null;
    this.uploadedFileData = null;
  }

  removePdfAttachment() {
    this.clearPdfAttachment();
  }

  async showModal(modalId) {
    if (!this.isInitialized) {
      await this.init();
    }

    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();

      if (modalId === "sendEmailModal") {
        setTimeout(() => this.updateRecipientCount(), 100);
      }
    }
  }

  closeModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) modal.hide();
    }
  }

  updateEmailHistoryTable() {
    const tbody = document.getElementById("emailHistoryTableBody");
    if (!tbody) return;

    if (this.emailHistory.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted py-4">
            <i class="fas fa-inbox fa-2x mb-2"></i>
            <p>No hay historial de correos enviados</p>
          </td>
        </tr>
      `;
      return;
    }

    const tableRows = this.emailHistory
      .map((item) => {
        let formattedDate = "Fecha no disponible";
        try {
          const date =
            item.sentAt && item.sentAt.toDate
              ? item.sentAt.toDate()
              : new Date(item.sentAt);
          if (date && !isNaN(date.getTime())) {
            formattedDate =
              date.toLocaleDateString("es-PE", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }) +
              " " +
              date.toLocaleTimeString("es-PE", {
                hour: "2-digit",
                minute: "2-digit",
              });
          }
        } catch (error) {
          // Error silencioso
        }

        const statusBadge =
          item.status === "completed"
            ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Completado</span>'
            : '<span class="badge bg-warning"><i class="fas fa-exclamation-triangle me-1"></i>Parcial</span>';

        const truncatedSubject =
          (item.subject || "Sin asunto").length > 50
            ? (item.subject || "Sin asunto").substring(0, 50) + "..."
            : item.subject || "Sin asunto";

        return `
        <tr>
          <td>
            <div class="text-muted">${formattedDate}</div>
            <small class="text-muted">Por: ${
              item.sentByName || "Usuario"
            }</small>
          </td>
          <td>
            <div class="fw-bold" title="${item.subject || "Sin asunto"}">
              ${truncatedSubject}
            </div>
          </td>
          <td class="text-center">
            <div class="d-flex align-items-center justify-content-center gap-1">
              <span class="badge bg-success">${item.successCount || 0}</span>
              ${
                (item.errorCount || 0) > 0
                  ? `<span class="badge bg-danger" title="${item.errorCount} errores">${item.errorCount}</span>`
                  : ""
              }
            </div>
            <small class="text-muted">de ${item.recipientCount || 0}</small>
          </td>
          <td class="text-center">
            ${statusBadge}
          </td>
        </tr>
      `;
      })
      .join("");

    tbody.innerHTML = tableRows;
  }

  updateSelectedDonations(selectedIds) {
    this.selectedDonations = new Set(selectedIds);
    const selectedRadio = document.getElementById("selectedDonors");
    if (selectedRadio && selectedRadio.checked) {
      this.updateRecipientCount();
    }
  }

  showSuccess(message) {
    this.showAlert(message, "success");
  }

  showError(message) {
    this.showAlert(message, "danger");
  }

  showWarning(message) {
    this.showAlert(message, "warning");
  }

  showAlert(message, type) {
    if (window.donationsManager) {
      if (type === "success") window.donationsManager.showSuccess(message);
      else if (type === "danger") window.donationsManager.showError(message);
      else if (type === "warning") window.donationsManager.showWarning(message);
      return;
    }

    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText =
      "top: 20px; right: 20px; z-index: 9999; min-width: 300px; max-width: 500px;";
    alertDiv.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-${
          type === "success"
            ? "check-circle"
            : type === "danger"
            ? "exclamation-triangle"
            : "info-circle"
        } me-2"></i>
        <div class="flex-grow-1">${message}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
      if (alertDiv.parentNode) alertDiv.remove();
    }, 5000);
  }
}

// Funciones globales
window.openSendEmailModal = async function () {
  try {
    if (!window.emailManager) {
      window.emailManager = new EmailManager();
    }

    if (window.donationsManager && window.donationsManager.selectedDonations) {
      window.emailManager.updateSelectedDonations(
        Array.from(window.donationsManager.selectedDonations)
      );
    }

    await window.emailManager.showModal("sendEmailModal");
  } catch (error) {
    alert("Error al abrir el modal de correos: " + error.message);
  }
};

window.previewEmail = function () {
  if (window.emailManager) {
    window.emailManager.previewEmail();
  }
};

window.loadEmailTemplate = function () {
  if (window.emailManager) {
    window.emailManager.loadEmailTemplate();
  }
};

window.sendEmailsToRecipients = function () {
  if (window.emailManager) {
    window.emailManager.sendEmailsToRecipients();
  } else {
    alert("Error: El sistema de correos no está inicializado");
  }
};

window.handlePdfAttachment = function (input) {
  if (window.emailManager) {
    window.emailManager.handlePdfAttachment(input);
  }
};

window.clearPdfAttachment = function () {
  if (window.emailManager) {
    window.emailManager.clearPdfAttachment();
  }
};

window.removePdfAttachment = function () {
  if (window.emailManager) {
    window.emailManager.removePdfAttachment();
  }
};

window.refreshEmailHistory = function () {
  if (window.emailManager) {
    window.emailManager.loadEmailHistory();
  }
};

document.addEventListener("DOMContentLoaded", function () {
  if (window.donationsManager) {
    window.donationsManager.updateEmailSelections = function () {
      if (window.emailManager) {
        window.emailManager.updateSelectedDonations(
          Array.from(this.selectedDonations)
        );
      }
    };
  }
});

export { EmailManager };
