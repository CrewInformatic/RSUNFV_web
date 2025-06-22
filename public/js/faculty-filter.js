// Mapeo completo de las facultades de la UNFV con todas sus carreras
const facultadEscuelas = {
  F001: [
    // Facultad de Ingeniería Electrónica e Informática
    { value: "E002", text: "Ingeniería Electrónica" },
    { value: "E001", text: "Ingeniería Informática" },
    { value: "E003", text: "Ingeniería Mecatrónica" },
    { value: "E004", text: "Ingeniería de Telecomunicaciones" },
  ],
};

// Función principal para filtrar escuelas según la facultad seleccionada
function filterEscuelas() {
  const facultadSelect = document.getElementById("facultadID");
  const escuelaSelect = document.getElementById("escuelaID");
  const facultadValue = facultadSelect.value;

  // Limpiar el select de escuelas
  escuelaSelect.innerHTML = '<option value="">Selecciona tu escuela</option>';

  if (facultadValue && facultadEscuelas[facultadValue]) {
    // Agregar las escuelas correspondientes a la facultad seleccionada
    facultadEscuelas[facultadValue].forEach((escuela) => {
      const option = document.createElement("option");
      option.value = escuela.value;
      option.textContent = escuela.text;
      escuelaSelect.appendChild(option);
    });

    escuelaSelect.disabled = false;
  } else {
    // Si no hay facultad seleccionada, deshabilitar el select de escuelas
    escuelaSelect.innerHTML =
      '<option value="">Primero selecciona una facultad</option>';
    escuelaSelect.disabled = true;
  }
}

// Función para manejar la selección de escuela (opcional)
function updateEscuelaDisplay() {
  const escuelaSelect = document.getElementById("escuelaID");
  const selectedValue = escuelaSelect.value;
  const selectedText = escuelaSelect.options[escuelaSelect.selectedIndex].text;

  if (selectedValue) {
    console.log("Escuela seleccionada:", selectedText, "ID:", selectedValue);
    // Aquí puedes agregar más lógica si necesitas hacer algo con la escuela seleccionada
  }
}

// Función para manejar la selección de facultad (opcional)
function updateFacultadDisplay() {
  const facultadSelect = document.getElementById("facultadID");
  const selectedValue = facultadSelect.value;
  const selectedText =
    facultadSelect.options[facultadSelect.selectedIndex].text;

  if (selectedValue) {
    console.log("Facultad seleccionada:", selectedText, "ID:", selectedValue);
    // Aquí puedes agregar más lógica si necesitas hacer algo con la facultad seleccionada
  }
}

// Inicializar el formulario cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  const escuelaSelect = document.getElementById("escuelaID");
  escuelaSelect.disabled = true;
});

// Función utilitaria para obtener el nombre de la facultad por ID
function getFacultadName(facultadId) {
  const facultadSelect = document.getElementById("facultadID");
  const option = facultadSelect.querySelector(`option[value="${facultadId}"]`);
  return option ? option.textContent : null;
}

// Función utilitaria para obtener el nombre de la escuela por ID
function getEscuelaName(escuelaId) {
  const escuelaSelect = document.getElementById("escuelaID");
  const option = escuelaSelect.querySelector(`option[value="${escuelaId}"]`);
  return option ? option.textContent : null;
}
