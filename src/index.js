const path = require("path");
const fs = require("fs");

const chalk = require("chalk");
const { ask, rl } = require("./utils/ask");
const { createInvoices } = require("./services/create-invoices");
const { mapXmlToJSON } = require("./utils/map-xml");
const { closeTerminal } = require("./utils/close-terminal");
const {
  updateInvoices,
} = require("./services/codenull-services/update-invoices");

async function main() {
  try {

    let filesPath;
    let exists = false;

    do {
      filesPath = await ask("Ingrese la ruta de los archivos: ");

      // Resolviendo la ruta a una ruta absoluta
      const absolutePath = path.resolve(filesPath);

      exists = fs.existsSync(absolutePath);
      if (!exists)
        console.log(
          chalk.red("La ruta ingresada no existe. Intente de nuevo.")
        );
      else filesPath = absolutePath; // Actualizamos la ruta con la ruta absoluta
    } while (!exists);

    const files = fs.readdirSync(filesPath);
    const xmlFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".xml"
    );

    let invoices = [];

    xmlFiles.forEach((file) => {
      const xml = fs.readFileSync(path.resolve(filesPath, file), "utf8"); // Resolviendo la ruta al archivo XML
      const invoice = mapXmlToJSON(xml);
      invoices.push(invoice);
    });

    fs.writeFileSync("./invoices.json", JSON.stringify(invoices, null, 2));

    await createInvoices(invoices);
    console.log(chalk.green("Facturas creadas correctamente"));
    await updateInvoices();
  } catch (error) {
    console.log(error)
    console.log(chalk.red("Ocurrió un error al crear las facturas"));
  } finally {
    rl.close();
    closeTerminal();
  }
}

main();
