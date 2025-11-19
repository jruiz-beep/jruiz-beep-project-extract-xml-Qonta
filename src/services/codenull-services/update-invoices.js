const chalk = require("chalk");
const { getToken } = require("./get-token");
const axios = require("axios").default;

async function updateInvoices() {
  const tokenResponse = await getToken();

  if (!tokenResponse) return;

  const hookId = process.env.CODENULL_HOOK_ID;

  let data = JSON.stringify({
    query: `mutation updateFacturaRecibidaDian($data: FacturaRecibidaDianInput, $hookId: String) {
            customFacturaRecibidaDian(data: $data, options: {customHookId: $hookId}) {
                data
                __typename
            }
            }`,
    variables: { hookId },
    operationName: "updateFacturaRecibidaDian",
  });

  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://mqlplus-app.azurewebsites.net/graphql",
    headers: {
      authorization: `Bearer ${tokenResponse.access_token}`,
      "content-type": "application/json",
    },
    data: data,
  };

  try {
    await axios.request(config);
    console.log(chalk.green("Facturas actualizadas correctamente"));
  } catch (error) {
    console.log(error);
    console.log(chalk.red("Error al actualizar las facturas"));
  }
}

module.exports = { updateInvoices };