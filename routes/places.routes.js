// routes/placesRoutes.js
const express = require("express");
const { getPlacesController } = require("../controllers/placesController");
const router = express.Router();

router.get("/", getPlacesController);

module.exports = router;
