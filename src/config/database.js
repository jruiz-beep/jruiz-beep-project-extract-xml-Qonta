const { PrismaClient } = require("@prisma/client");

const connection = new PrismaClient();

module.exports = { connection };
