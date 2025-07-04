// donation-upload-service.js
import {
  db,
  collection,
  addDoc,
  serverTimestamp,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "./firebase_config.js";

/**
 * Servicio especializado para subir datos de donaciones a Firebase
 * Se encarga exclusivamente de la persistencia de datos y archivos
 */
class DonationUploadService {
  constructor() {
    this.isUploading = false;
    this.uploadCallbacks = {
      onStart: null,
      onProgress: null,
      onSuccess: null,
      onError: null,
    };
  }

  /**
   * Configurar callbacks para el proceso de subida
   * @param {Object} callbacks - Funciones callback para diferentes eventos
   */
  setCallbacks(callbacks) {
    this.uploadCallbacks = { ...this.uploadCallbacks, ...callbacks };
  }

  /**
   * Método principal para subir una donación completa
   * @param {Object} donationData - Datos de la donación
   * @param {File} paymentProofFile - Archivo de comprobante de pago
   * @returns {Promise<string>} - ID de la donación creada
   */
  async uploadDonation(donationData, paymentProofFile = null) {
    if (this.isUploading) {
      throw new Error("Ya hay una subida en progreso");
    }

    this.isUploading = true;

    try {
      // Notificar inicio
      this._triggerCallback("onStart");

      // Paso 1: Subir comprobante de pago si existe
      let paymentProofUrl = null;
      if (paymentProofFile) {
        this._triggerCallback("onProgress", {
          step: "uploading_proof",
          progress: 25,
        });
        paymentProofUrl = await this._uploadPaymentProof(
          paymentProofFile,
          donationData.IDValidacion
        );
      }

      // Paso 2: Preparar datos finales
      this._triggerCallback("onProgress", {
        step: "preparing_data",
        progress: 50,
      });
      const finalDonationData = this._prepareFinalData(
        donationData,
        paymentProofUrl
      );

      // Paso 3: Subir a Firestore
      this._triggerCallback("onProgress", {
        step: "saving_to_database",
        progress: 75,
      });
      const donationId = await this._saveDonationToFirestore(finalDonationData);

      // Paso 4: Completar
      this._triggerCallback("onProgress", { step: "completed", progress: 100 });
      this._triggerCallback("onSuccess", {
        donationId,
        paymentProofUrl,
        message: "Donación subida exitosamente",
      });

      return donationId;
    } catch (error) {
      console.error("Error en uploadDonation:", error);
      this._triggerCallback("onError", {
        error,
        message: this._getErrorMessage(error),
      });
      throw error;
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Subir solo el comprobante de pago
   * @param {File} file - Archivo del comprobante
   * @param {string} validationId - ID de validación para el nombre del archivo
   * @returns {Promise<string>} - URL del archivo subido
   */
  async _uploadPaymentProof(file, validationId) {
    try {
      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const fileExtension = this._getFileExtension(file.name);
      const fileName = `comprobantes/${validationId}_${timestamp}.${fileExtension}`;

      // Crear referencia en Storage
      const storageRef = ref(storage, fileName);

      // Configurar metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          validationId: validationId,
          originalName: file.name,
          uploadDate: new Date().toISOString(),
        },
      };

      // Subir archivo
      const snapshot = await uploadBytes(storageRef, file, metadata);

      // Obtener URL de descarga
      const downloadURL = await getDownloadURL(snapshot.ref);

      console.log("Comprobante subido exitosamente:", downloadURL);
      return downloadURL;
    } catch (error) {
      console.error("Error subiendo comprobante:", error);
      throw new Error(`Error subiendo comprobante: ${error.message}`);
    }
  }

  /**
   * Guardar datos de donación en Firestore
   * @param {Object} donationData - Datos preparados de la donación
   * @returns {Promise<string>} - ID del documento creado
   */
  async _saveDonationToFirestore(donationData) {
    try {
      const docRef = await addDoc(collection(db, "donaciones"), {
        ...donationData,
        fechaCreacion: serverTimestamp(),
        fechaUltimaModificacion: serverTimestamp(),
      });

      console.log("Donación guardada en Firestore con ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("Error guardando en Firestore:", error);
      throw new Error(`Error guardando donación: ${error.message}`);
    }
  }

  /**
   * Preparar datos finales antes de subir
   * @param {Object} originalData - Datos originales
   * @param {string} paymentProofUrl - URL del comprobante subido
   * @returns {Object} - Datos preparados
   */
  _prepareFinalData(originalData, paymentProofUrl) {
    const finalData = {
      ...originalData,
      fechadonacion: serverTimestamp(),
      fechaCreacion: serverTimestamp(),
      fechaUltimaModificacion: serverTimestamp(),
      estadoSubida: "completado",
      versionDatos: "1.0",
    };

    // Agregar información del comprobante si existe
    if (paymentProofUrl) {
      finalData.comprobanteURL = paymentProofUrl;
      finalData.comprobanteSubido = true;
      finalData.fechaSubidaComprobante = serverTimestamp();
    } else {
      finalData.comprobanteSubido = false;
    }

    // Limpiar campos undefined
    Object.keys(finalData).forEach((key) => {
      if (finalData[key] === undefined) {
        delete finalData[key];
      }
    });

    return finalData;
  }

  /**
   * Obtener extensión de archivo
   * @param {string} filename - Nombre del archivo
   * @returns {string} - Extensión del archivo
   */
  _getFileExtension(filename) {
    return filename.split(".").pop().toLowerCase();
  }

  /**
   * Obtener mensaje de error amigable
   * @param {Error} error - Error original
   * @returns {string} - Mensaje amigable
   */
  _getErrorMessage(error) {
    if (error.code) {
      switch (error.code) {
        case "storage/unauthorized":
          return "No tienes permisos para subir archivos";
        case "storage/canceled":
          return "Subida cancelada";
        case "storage/quota-exceeded":
          return "Espacio de almacenamiento agotado";
        case "storage/invalid-format":
          return "Formato de archivo no válido";
        case "storage/object-not-found":
          return "Archivo no encontrado";
        case "permission-denied":
          return "Permisos insuficientes para guardar datos";
        case "unavailable":
          return "Servicio temporalmente no disponible";
        default:
          return `Error del sistema: ${error.code}`;
      }
    }

    if (error.message.includes("network")) {
      return "Error de conexión. Verifica tu internet";
    }

    return error.message || "Error desconocido";
  }

  /**
   * Disparar callback si existe
   * @param {string} callbackName - Nombre del callback
   * @param {*} data - Datos a pasar al callback
   */
  _triggerCallback(callbackName, data = null) {
    if (
      this.uploadCallbacks[callbackName] &&
      typeof this.uploadCallbacks[callbackName] === "function"
    ) {
      try {
        this.uploadCallbacks[callbackName](data);
      } catch (error) {
        console.error(`Error en callback ${callbackName}:`, error);
      }
    }
  }

  /**
   * Verificar si una donación ya existe
   * @param {string} validationId - ID de validación
   * @returns {Promise<boolean>} - True si existe
   */
  async checkDonationExists(validationId) {
    try {
      const q = query(
        collection(db, "donaciones"),
        where("IDValidacion", "==", validationId)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error verificando donación existente:", error);
      return false;
    }
  }

  /**
   * Obtener estado de la subida
   * @returns {boolean} - True si está subiendo
   */
  getUploadStatus() {
    return this.isUploading;
  }

  /**
   * Cancelar subida en progreso (solo Storage)
   */
  cancelUpload() {
    // Nota: Firebase no permite cancelar uploads de Storage una vez iniciados
    // Solo podemos marcar como cancelado en nuestro estado
    this.isUploading = false;
    this._triggerCallback("onError", {
      error: new Error("Upload cancelado por el usuario"),
      message: "Subida cancelada",
    });
  }
}

/**
 * Instancia singleton del servicio de subida
 */
const donationUploadService = new DonationUploadService();

/**
 * Función helper para uso fácil desde otros módulos
 * @param {Object} donationData - Datos de la donación
 * @param {File} paymentProofFile - Archivo de comprobante
 * @param {Object} callbacks - Callbacks opcionales
 * @returns {Promise<string>} - ID de la donación
 */
export async function uploadDonationData(
  donationData,
  paymentProofFile = null,
  callbacks = {}
) {
  // Configurar callbacks si se proporcionan
  if (Object.keys(callbacks).length > 0) {
    donationUploadService.setCallbacks(callbacks);
  }

  return await donationUploadService.uploadDonation(
    donationData,
    paymentProofFile
  );
}

/**
 * Función para verificar si una donación existe
 * @param {string} validationId - ID de validación
 * @returns {Promise<boolean>}
 */
export async function checkIfDonationExists(validationId) {
  return await donationUploadService.checkDonationExists(validationId);
}

/**
 * Función para obtener el estado de subida
 * @returns {boolean}
 */
export function getUploadStatus() {
  return donationUploadService.getUploadStatus();
}

/**
 * Función para cancelar subida
 */
export function cancelCurrentUpload() {
  donationUploadService.cancelUpload();
}

// Exportar también la clase para uso avanzado
export { DonationUploadService };

// Exportar por defecto la función principal
export default uploadDonationData;
