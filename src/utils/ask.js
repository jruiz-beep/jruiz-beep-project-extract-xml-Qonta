const readline = require("readline");
const { stdin: input, stdout: output } = require("process");

const rl = readline.createInterface({ input, output });

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (reply) => resolve(reply));
  });
}

module.exports = { ask, rl };