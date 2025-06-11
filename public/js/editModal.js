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
            
            <div class="image-upload-wrapper">
              <input type="file" id="editEventImages" accept="image/*" class="file-input" style="display: none;">
              <div class="image-upload-section" id="editImageUploadSection">
                <div class="upload-icon">
                  <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <div class="upload-text">
                  <p class="upload-main-text">Haz clic aquí o arrastra una imagen</p>
                  <small class="upload-sub-text">Solo se permite una imagen (máx. 10MB)</small>
                  <small class="upload-formats">Formatos: JPG, PNG, GIF, WEBP</small>
                </div>
                <button type="button" class="btn-select-file">
                  <i class="fas fa-folder-open"></i>
                  Seleccionar Archivo
                </button>
              </div>
            </div>
            
            <div id="editImagePreviewContainer" class="image-preview-container"></div>
          </div>
        </form>
        
        <div id="editUploadProgress" class="upload-progress" style="display: none;"></div>
      </div>
      
      <div class="modal-footer">
        <button type="button" class="btn-cancel" onclick="closeEditModal()">
          <i class="fas fa-times"></i>
          Cancelar
        </button>
        <button type="button" class="btn-save" onclick="saveEventChanges('${eventId}')">
          <i class="fas fa-save"></i>
          Guardar Cambios
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

    // Llenar el formulario con los datos
    document.getElementById("editEventTitle").value = eventData.titulo || "";
    document.getElementById("editEventDescription").value =
      eventData.descripcion || "";
    document.getElementById("editEventType").value =
      eventData.tipo || "general";

    // Convertir fecha de string a formato de input
    if (eventData.fechaInicio) {
      // Si ya es string, usarla directamente
      const fechaStr =
        typeof eventData.fechaInicio === "string"
          ? eventData.fechaInicio
          : eventData.fechaInicio.toDate().toISOString().split("T")[0];

      document.getElementById("editEventDate").value = fechaStr;
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
        <div class="current-image-wrapper">
          <img src="${imageUrl}" alt="Imagen actual del evento" class="current-event-image">
          <div class="current-image-overlay">
          </div>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="no-current-image">
        <i class="fas fa-image-slash"></i>
        <p>No hay imagen actual</p>
      </div>
    `;
  }
}

/**
 * Configurar manejo de imágenes en el modal de edición
 */

function setupImageHandling() {
  const imageInput = document.getElementById("editEventImages");
  const uploadSection = document.getElementById("editImageUploadSection");
  const selectButton = uploadSection?.querySelector(".btn-select-file");

  if (imageInput) {
    imageInput.addEventListener("change", function (e) {
      handleEditImageSelection(e.target.files);
    });
  }

  if (uploadSection) {
    // Evento click para toda la sección de upload - CORREGIDO
    uploadSection.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (imageInput) {
        imageInput.click();
      }
    });

    setupEditDragAndDrop(uploadSection, imageInput);
  }

  // Evento específico para el botón - CORREGIDO
  if (selectButton && imageInput) {
    selectButton.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (imageInput) {
        imageInput.click();
      }
    });
  }
}

/**
 * Manejar selección de imágenes en edición
 */
function handleEditImageSelection(files) {
  if (isProcessingEditFiles) {
    return;
  }

  if (files.length === 0) return;

  isProcessingEditFiles = true;

  const firstFile = files[0];

  // Validar tipo de archivo
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (!validTypes.includes(firstFile.type)) {
    alert(
      `${firstFile.name} no es un formato de imagen válido. Use: JPG, PNG, GIF o WEBP`
    );
    isProcessingEditFiles = false;
    return;
  }

  // Validar tamaño
  if (firstFile.size > 10 * 1024 * 1024) {
    alert(`${firstFile.name} es demasiado grande (máximo 10MB)`);
    isProcessingEditFiles = false;
    return;
  }

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
        <div class="preview-header">
          <h4 class="preview-title">
            <i class="fas fa-eye"></i>
            Nueva Imagen Seleccionada
          </h4>
          <button type="button" class="btn-remove-preview" onclick="removeEditImagePreview()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="preview-content">
          <div class="preview-image-container">
            <img src="${
              e.target.result
            }" alt="Nueva imagen" class="preview-image">
          </div>
          <div class="preview-info">
            <div class="file-info">
              <span class="file-name">
                <i class="fas fa-file-image"></i>
                ${file.name}
              </span>
              <span class="file-size">
                <i class="fas fa-weight-hanging"></i>
                ${(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <div class="file-status">
              <i class="fas fa-check-circle"></i>
              Listo para subir
            </div>
          </div>
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
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadSection.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadSection.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadSection.addEventListener(eventName, unhighlight, false);
  });

  function highlight(e) {
    uploadSection.classList.add("drag-over");
  }

  function unhighlight(e) {
    uploadSection.classList.remove("drag-over");
  }

  uploadSection.addEventListener("drop", handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      // Crear un nuevo objeto DataTransfer para asignar al input
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(files[0]);
      fileInput.files = dataTransfer.files;

      handleEditImageSelection(files);
    }
  }
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
    return;
  }

  isUpdatingEvent = true;

  const saveBtn = document.querySelector(".btn-save");
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
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
    now.setHours(0, 0, 0, 0); // Resetear hora para comparar solo fechas
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate < now) {
      throw new Error("La fecha del evento debe ser futura");
    }

    // Preparar datos para actualización
    const updateData = {
      titulo: eventData.titulo,
      descripcion: eventData.descripcion,
      tipo: eventData.tipo,
      fechaInicio: eventData.fechaInicio,
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
      showEditUploadProgress();

      const uploadResult = await uploadImageToCloudinary(currentEditFiles[0]);
      updateData.foto = uploadResult.url;

      hideEditUploadProgress();
    }

    // Actualizar en Firestore
    await updateDoc(doc(db, "eventos", eventId), updateData);

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
      <div class="upload-progress-content">
        <div class="progress-header">
          <i class="fas fa-cloud-upload-alt"></i>
          <span>Subiendo imagen...</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar animated"></div>
        </div>
        <small class="progress-text">Por favor espera mientras se sube la imagen</small>
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
