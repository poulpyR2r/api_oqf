// index.js
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Importation des routes
const placesRoutes = require("./routes/places.routes");

app.use("/places", placesRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
