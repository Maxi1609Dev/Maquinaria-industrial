const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

app.get("/productos", async (req, res) => {
  const result = await pool.query("SELECT * FROM productos");
  res.json(result.rows);
});

app.post("/productos", async (req, res) => {
  const { nombre, precio } = req.body;

  await pool.query(
    "INSERT INTO productos(nombre, precio) VALUES($1,$2)",
    [nombre, precio]
  );

  res.send("Producto agregado");
});

app.listen(3000, () => {
  console.log("Servidor en puerto 3000");
});