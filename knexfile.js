require("dotenv").config();

module.exports = {
  development: {
    client: "postgresql",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "qf_lms",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres"
    },
    migrations: {
      directory: "./src/db/migrations",
      tableName: "knex_migrations"
    },
    seeds: {
      directory: "./src/db/seeds"
    },
    pool: { min: 2, max: 10 }
  },

  production: {
    client: "postgresql",
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: "./src/db/migrations",
      tableName: "knex_migrations"
    },
    seeds: {
      directory: "./src/db/seeds"
    },
    pool: { min: 2, max: 20 }
  }
};
