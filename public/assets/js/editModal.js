/**
 * Modal de edición de eventos editModal.js
 */

import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =============================================
// CONFIGURACIÓN DE CLOUDINARY
// =============================================
const CLOUDINARY_CONFIG = {
  cloudName: "dupkeaqnz",
  uploadPreset: "u5jbjfxu",
  apiKey: "572426943132833",
};

// =============================================
// VARIABLES GLOBALES DE CONTROL
// =============================================
let currentEditFiles = [];
let isEditingEvent = false;
let isProcessingEditFiles = false;
let isUpdatingEvent = false;

// =============================================
// FUNCIÓN PARA OBTENER FIREBASE DB
// =============================================
function getFirebaseDB() {
  if (window.firebaseDB) {
    return window.firebaseDB;
  }
  console.error("❌ Firebase DB no está inicializado");
  return null;
}

/**
 * Crear y mostrar modal de edición
 */
export function showEditModal(eventId) {
  console.log("🔧 Abriendo modal de edición para evento:", eventId);

  // Verificar si ya existe un modal y eliminarlo
  const existingModal = document.getElementById("editEventModal");
  if (existingModal) {
    existingModal.remove();
  }

  // Crear el modal
  const modal = createEditModal(eventId);

  // Agregar al DOM
  document.body.appendChild(modal);

  // Mostrar el modal
  modal.style.display = "flex";

  // Cargar datos del evento desde Firestore
  loadEventData(eventId);
}

/**
 * Crear estructura del modal
 */
function createEditModal(eventId) {
  const modal = document.createElement("div");
  modal.id = "editEventModal";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>✏️ Editar Evento</h2>
        <button class="close-btn" onclick="closeEditModal()">&times;</button>
      </div>
      
      <div class="modal-body">
        <form id="editEventForm">
          <div class="form-group">
            <label for="editEventTitle">Título del Evento: *</label>
            <input type="text" id="editEventTitle" name="titulo" required>
          </div>
          
          <div class="form-group">
            <label for="editEventDescription">Descripción: *</label>
            <textarea id="editEventDescription" name="descripcion" rows="4" required></textarea>
          </div>
          
          <div class="form-group">
            <label for="editEventType">Tipo de Evento:</label>
            <select id="editEventType" name="tipo">
              <option value="general">General</option>
              <option value="limpieza">Limpieza</option>
              <option value="educacion">Educación</option>
              <option value="construccion">Construcción</option>
              <option value="social">Social</option>
              <option value="salud">Salud</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="editEventDate">Fecha: *</label>
            <input type="date" id="editEventDate" name="fechaInicio" required>
          </div>
          
          <div class="form-group">
            <label for="editEventStartTime">Hora de Inicio:</label>
            <input type="time" id="editEventStartTime" name="horaInicio">
          </div>
          
          <div class="form-group">
            <label for="editEventEndTime">Hora de Fin:</label>
            <input type="time" id="editEventEndTime" name="horaFin">
          </div>
          
          <div class="form-group">
            <label for="editEventLocation">Ubicación:</label>
            <input type="text" id="editEventLocation" name="ubicacion">
          </div>
          
          <div class="form-group">
            <label for="editMaxVolunteers">Máximo de Voluntarios:</label>
            <input type="number" id="editMaxVolunteers" name="maxVoluntarios" min="1">
          </div>
          
          <div class="form-group">
            <label for="editRequirements">Requisitos:</label>
            <textarea id="editRequirements" name="requisitos" rows="3"></textarea>
          </div>
          
          <div class="form-group">
            <label for="editMaterials">Materiales:</label>
            <textarea id="editMaterials" name="materiales" rows="3"></textarea>
          </div>
          
          <div class="form-group">
            <label>Imagen del Evento:</label>
            <div class="current-image-container" id="currentImageContainer"></div>
            <div class="image-upload-section" id="editImageUploadSection">
              <input type="file" id="editEventImages" accept="image/*" class="file-input">
              <div class="upload-text">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Arrastra una nueva imagen aquí o haz clic para seleccionar</p>
                <small>Solo se permitirá una imagen (máx. 10MB)</small>
              </div>
            </div>
            <div id="editImagePreviewContainer" class="image-preview-container"></div>
          </div>
        </form>
        
        <div id="editUploadProgress" class="upload-progress" style="display: none;"></div>
      </div>
      
      <div class="modal-footer">
        <button type="button" class="btn-cancel" onclick="closeEditModal()">
          Cancelar
        </button>
        <button type="button" class="btn-save" onclick="saveEventChanges('${eventId}')">
          💾 Guardar Cambios
        </button>
      </div>
    </div>
  `;

  return modal;
}

/**
 * Obtener sesión almacenada
 */
function getStoredSession() {
  try {
    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      return JSON.parse(storedSession);
    }
    return null;
  } catch (error) {
    console.error("❌ Error al obtener sesión:", error);
    sessionStorage.removeItem("userSession");
    return null;
  }
}

/**
 * Cargar datos del evento desde Firestore
 */
async function loadEventData(eventId) {
  console.log(`📥 Cargando datos del evento ${eventId} desde Firestore`);

  try {
    // Obtener la instancia de Firebase DB
    const db = getFirebaseDB();
    if (!db) {
      throw new Error("Firebase no está inicializado correctamente");
    }

    const eventDoc = await getDoc(doc(db, "eventos", eventId));

    if (!eventDoc.exists()) {
      throw new Error("El evento no existe");
    }

    const eventData = eventDoc.data();
    console.log("📋 Datos del evento cargados:", eventData);

    // Llenar el formulario con los datos
    document.getElementById("editEventTitle").value = eventData.titulo || "";
    document.getElementById("editEventDescription").value =
      eventData.descripcion || "";
    document.getElementById("editEventType").value =
      eventData.tipo || "general";

    // Convertir fecha de Firestore a formato de input
    if (eventData.fechaInicio) {
      const fecha = eventData.fechaInicio.toDate();
      document.getElementById("editEventDate").value = fecha
        .toISOString()
        .split("T")[0];
    }

    document.getElementById("editEventStartTime").value =
      eventData.horaInicio || "";
    document.getElementById("editEventEndTime").value = eventData.horaFin || "";
    document.getElementById("editEventLocation").value =
      eventData.ubicacion || "";
    document.getElementById("editMaxVolunteers").value =
      eventData.maxVoluntarios || "";
    document.getElementById("editRequirements").value =
      eventData.requisitos || "";
    document.getElementById("editMaterials").value = eventData.materiales || "";

    // Mostrar imagen actual si existe
    showCurrentImage(eventData.foto);

    // Configurar manejo de imágenes
    setupImageHandling();
  } catch (error) {
    console.error("❌ Error al cargar datos del evento:", error);
    alert(`Error al cargar el evento: ${error.message}`);
    closeEditModal();
  }
}

/**
 * Mostrar imagen actual del evento
 */
function showCurrentImage(imageUrl) {
  const container = document.getElementById("currentImageContainer");
  if (!container) return;

  if (imageUrl) {
    container.innerHTML = `
      <div class="current-image">
        <img src="${imageUrl}" alt="Imagen actual del evento" class="current-event-image">
        <p class="text-muted mt-1">Imagen actual del evento</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <p class="text-muted">No hay imagen actual</p>
    `;
  }
}

/**
 * Configurar manejo de imágenes en el modal de edición
 */
function setupImageHandling() {
  const imageInput = document.getElementById("editEventImages");
  const uploadSection = document.getElementById("editImageUploadSection");

  if (imageInput) {
    imageInput.addEventListener("change", function (e) {
      handleEditImageSelection(e.target.files);
    });
  }

  if (uploadSection) {
    setupEditDragAndDrop(uploadSection, imageInput);
  }
}

/**
 * Manejar selección de imágenes en edición
 */
function handleEditImageSelection(files) {
  if (isProcessingEditFiles) {
    console.log("⚠️ Ya procesando archivos, ignorando...");
    return;
  }

  if (files.length === 0) return;

  isProcessingEditFiles = true;

  const firstFile = files[0];

  if (!firstFile.type.startsWith("image/")) {
    alert(`${firstFile.name} no es una imagen válida`);
    isProcessingEditFiles = false;
    return;
  }

  if (firstFile.size > 10 * 1024 * 1024) {
    alert(`${firstFile.name} es demasiado grande (máximo 10MB)`);
    isProcessingEditFiles = false;
    return;
  }

  console.log(`✅ Nueva imagen seleccionada: ${firstFile.name}`);

  showEditImagePreview(firstFile);
  currentEditFiles = [firstFile];

  isProcessingEditFiles = false;
}

/**
 * Mostrar vista previa de nueva imagen
 */
function showEditImagePreview(file) {
  const container = document.getElementById("editImagePreviewContainer");
  if (!container) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    container.innerHTML = `
      <div class="new-image-preview">
        <div class="preview-image-container">
          <img src="${
            e.target.result
          }" alt="Nueva imagen" class="preview-image">
          <button type="button" class="btn btn-sm btn-danger remove-edit-image-btn" onclick="removeEditImagePreview()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="preview-info">
          <small class="text-success">Nueva imagen: ${file.name}</small>
          <small class="text-muted d-block">${(file.size / 1024 / 1024).toFixed(
            2
          )} MB</small>
        </div>
      </div>
    `;
  };
  reader.readAsDataURL(file);
}

/**
 * Configurar drag and drop para edición
 */
function setupEditDragAndDrop(uploadSection, fileInput) {
  uploadSection.addEventListener("dragover", function (e) {
    e.preventDefault();
    uploadSection.classList.add("dragover");
  });

  uploadSection.addEventListener("dragleave", function (e) {
    e.preventDefault();
    uploadSection.classList.remove("dragover");
  });

  uploadSection.addEventListener("drop", function (e) {
    e.preventDefault();
    uploadSection.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      fileInput.files = dt.files;
      handleEditImageSelection(dt.files);
    }
  });
}

/**
 * Remover vista previa de nueva imagen
 */
window.removeEditImagePreview = function () {
  currentEditFiles = [];

  const fileInput = document.getElementById("editEventImages");
  if (fileInput) {
    fileInput.value = "";
  }

  const container = document.getElementById("editImagePreviewContainer");
  if (container) {
    container.innerHTML = "";
  }
};

/**
 * Subir imagen a Cloudinary (reutilizado del create-event.js)
 */
async function uploadImageToCloudinary(file) {
  if (
    !file ||
    !file.type.startsWith("image/") ||
    file.size > 10 * 1024 * 1024
  ) {
    throw new Error("Archivo inválido");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  formData.append("cloud_name", CLOUDINARY_CONFIG.cloudName);
  formData.append("timestamp", Date.now().toString());

  try {
    console.log(`📤 Subiendo nueva imagen: ${file.name}...`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Imagen subida exitosamente: ${data.secure_url}`);

    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error(`❌ Error uploading ${file.name}:`, error);
    throw error;
  }
}

/**
 * Cerrar modal de edición
 */
window.closeEditModal = function () {
  const modal = document.getElementById("editEventModal");
  if (modal) {
    modal.style.display = "none";
    setTimeout(() => {
      modal.remove();
    }, 300);
  }

  // Limpiar variables
  currentEditFiles = [];
  isEditingEvent = false;
  isProcessingEditFiles = false;
  isUpdatingEvent = false;
};

/**
 * Guardar cambios del evento
 */
window.saveEventChanges = async function (eventId) {
  if (isUpdatingEvent || isEditingEvent) {
    console.warn("⚠️ Ya se está actualizando el evento");
    return;
  }

  isUpdatingEvent = true;
  console.log(`💾 Guardando cambios del evento ${eventId}`);

  const saveBtn = document.querySelector(".btn-save");
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Guardando...';
  saveBtn.disabled = true;

  try {
    const session = getStoredSession();
    if (!session) {
      throw new Error("Sesión no válida");
    }

    // Obtener la instancia de Firebase DB
    const db = getFirebaseDB();
    if (!db) {
      throw new Error("Firebase no está inicializado correctamente");
    }

    // Obtener datos del formulario
    const form = document.getElementById("editEventForm");
    const formData = new FormData(form);

    const eventData = {
      titulo: formData.get("titulo").trim(),
      descripcion: formData.get("descripcion").trim(),
      tipo: formData.get("tipo") || "general",
      fechaInicio: formData.get("fechaInicio"),
      horaInicio: formData.get("horaInicio") || "",
      horaFin: formData.get("horaFin") || "",
      ubicacion: formData.get("ubicacion").trim() || "",
      maxVoluntarios: formData.get("maxVoluntarios")
        ? parseInt(formData.get("maxVoluntarios"))
        : null,
      requisitos: formData.get("requisitos").trim() || "",
      materiales: formData.get("materiales").trim() || "",
    };

    // Validar campos requeridos
    if (!eventData.titulo || !eventData.descripcion || !eventData.fechaInicio) {
      throw new Error(
        "Por favor completa todos los campos obligatorios (título, descripción y fecha)"
      );
    }

    // Validar fecha futura
    const eventDate = new Date(eventData.fechaInicio);
    const now = new Date();
    if (eventDate <= now) {
      throw new Error("La fecha del evento debe ser futura");
    }

    // Preparar datos para actualización
    const updateData = {
      titulo: eventData.titulo,
      descripcion: eventData.descripcion,
      tipo: eventData.tipo,
      fechaInicio: Timestamp.fromDate(new Date(eventData.fechaInicio)),
      horaInicio: eventData.horaInicio,
      horaFin: eventData.horaFin,
      ubicacion: eventData.ubicacion,
      maxVoluntarios: eventData.maxVoluntarios,
      requisitos: eventData.requisitos,
      materiales: eventData.materiales,
      updatedAt: serverTimestamp(),
    };

    // Subir nueva imagen si se seleccionó una
    if (currentEditFiles.length > 0) {
      console.log("📤 Subiendo nueva imagen...");
      showEditUploadProgress();

      const uploadResult = await uploadImageToCloudinary(currentEditFiles[0]);
      updateData.foto = uploadResult.url;

      hideEditUploadProgress();
      console.log("✅ Nueva imagen subida correctamente");
    }

    // Actualizar en Firestore
    console.log("💾 Actualizando evento en Firestore...");
    await updateDoc(doc(db, "eventos", eventId), updateData);

    console.log("✅ Evento actualizado correctamente");
    alert(`✅ Evento "${eventData.titulo}" actualizado correctamente`);

    // Cerrar modal
    closeEditModal();

    // Recargar eventos si la función existe
    if (typeof window.loadUpcomingEvents === "function") {
      await window.loadUpcomingEvents();
    }
  } catch (error) {
    console.error("❌ Error al actualizar evento:", error);
    alert(`Error al actualizar evento: ${error.message}`);
    hideEditUploadProgress();
  } finally {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
    isUpdatingEvent = false;
  }
};

/**
 * Mostrar progreso de subida de imagen
 */
function showEditUploadProgress() {
  const progressDiv = document.getElementById("editUploadProgress");
  if (progressDiv) {
    progressDiv.style.display = "block";
    progressDiv.innerHTML = `
      <div class="alert alert-info">
        <div class="d-flex align-items-center">
          <i class="fas fa-cloud-upload-alt me-2"></i>
          <div class="flex-grow-1">
            <div>Subiendo nueva imagen...</div>
            <div class="progress mt-2">
              <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Ocultar progreso de subida
 */
function hideEditUploadProgress() {
  const progressDiv = document.getElementById("editUploadProgress");
  if (progressDiv) {
    progressDiv.style.display = "none";
  }
}
