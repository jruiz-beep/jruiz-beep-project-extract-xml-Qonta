const os = require("node:os");
const { exec } = require("node:child_process");

function closeTerminal() {
  const platform = os.platform();

  if (platform === "win32") {
    // Windows: cierra la consola con el comando 'exit'
    exec("exit", (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al cerrar la terminal: ${error}`);
        return;
      }
      console.log("Consola cerrada en Windows");
    });
  } else if (platform === "darwin") {
    // macOS: usa AppleScript para cerrar la ventana de la terminal
    exec('osascript -e "tell application \\"Terminal\\" to quit"', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al cerrar la terminal: ${error}`);
        return;
      }
      console.log("Consola cerrada en macOS");
    });
  } else if (platform === "linux") {
    // Linux: intenta cerrar la terminal con el comando 'exit'
    exec("exit", (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al cerrar la terminal: ${error}`);
        return;
      }
      console.log("Consola cerrada en Linux");
    });
  } else {
    console.log("Sistema operativo no soportado");
  }
}


module.exports = { closeTerminal };