const chalk = require('chalk');

const axios = require('axios').default;

async function getToken() {
  const url = `${process.env.CODENULL_API_URL}api/auth/token`;
  const data = {
    client_id: process.env.CODENULL_CLIENT_ID,
    client_secret: process.env.CODENULL_CLIENT_SECRET,
  };

  const config = {
    method: "post",
    url,
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.log(chalk.red("No se pudo obtener el token"));
    return null;
  }
};

module.exports = { getToken };