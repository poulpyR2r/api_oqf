// controllers/placesController.js
const axios = require("axios");

/*******************************************************
 * Fonctions utilitaires pour les dates
 *******************************************************/
function getDateForToday(hour) {
  const now = new Date();
  now.setHours(hour, 0, 0, 0);
  return now.toISOString();
}

function getDateInFuture(days, hour) {
  const future = new Date();
  future.setDate(future.getDate() + days);
  future.setHours(hour, 0, 0, 0);
  return future.toISOString();
}

/*******************************************************
 * Fonction de calcul de la distance (formule de Haversine)
 *******************************************************/
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Rayon de la Terre en mètres
  const toRad = (angle) => (angle * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/*******************************************************
 * Extraction des coordonnées en fonction de la source
 *******************************************************/
function getCoordinates(item, source) {
  switch (source) {
    case "overpass":
      return { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    case "opendata":
      // Pour OpenData Paris, les coordonnées se trouvent dans item.record.fields.tt
      if (item.record && item.record.fields && item.record.fields.tt) {
        return {
          lat: parseFloat(item.record.fields.tt.lat),
          lng: parseFloat(item.record.fields.tt.lon),
        };
      }
      return null;
    case "geoapify":
      // Pour Geoapify, les coordonnées sont dans item.geometry.coordinates sous la forme [lon, lat]
      if (item.geometry && Array.isArray(item.geometry.coordinates)) {
        return {
          lat: parseFloat(item.geometry.coordinates[1]),
          lng: parseFloat(item.geometry.coordinates[0]),
        };
      }
      return null;
    default:
      return null;
  }
}

/*******************************************************
 * Extraction de l'adresse selon la source
 *******************************************************/
function getOverpassAddress(tags) {
  const parts = [];
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
  if (tags["addr:street"]) parts.push(tags["addr:street"]);
  if (tags["addr:city"]) parts.push(tags["addr:city"]);
  return parts.join(", ");
}

function getOpendataAddress(fields) {
  return fields.adresse || "";
}

function getGeoapifyAddress(properties) {
  const parts = [];
  if (properties.address_line1) parts.push(properties.address_line1);
  if (properties.address_line2) parts.push(properties.address_line2);
  return parts.join(", ");
}

/*******************************************************
 * Vérification des doublons (mêmes coordonnées avec tolérance)
 *******************************************************/
function isDuplicate(coord1, coord2, tolerance = 0.0001) {
  return (
    Math.abs(coord1.lat - coord2.lat) < tolerance &&
    Math.abs(coord1.lng - coord2.lng) < tolerance
  );
}

function filterDuplicates(places) {
  const unique = [];
  for (const place of places) {
    if (!place.location) continue;
    const exists = unique.find((item) =>
      isDuplicate(item.location, place.location)
    );
    if (!exists) unique.push(place);
  }
  return unique;
}

/*******************************************************
 * Transformation des données pour chaque catégorie
 *******************************************************/
// Pour les événements (dataset que-faire-a-paris-)
function transformEventPlace({ id, title, address, location, source, raw }) {
  let description =
    "Vivez une expérience inoubliable avec cet événement. Découvrez animations et surprises sur place.";
  let category = "Événement";
  let timeRange = "10h00 - 23h00";
  let image = "/placeholder.svg?height=400&width=600";
  let highlights = [
    "Animation garantie",
    "Lieu atypique",
    "Ambiance festive",
    "Organisation soignée",
  ];

  if (raw && raw.record && raw.record.fields) {
    if (raw.record.fields.descriptif) {
      description = raw.record.fields.descriptif;
    }
    if (raw.record.fields.titre) {
      title = raw.record.fields.titre;
    }
  }

  return {
    id: String(id),
    title: title || "Événement inconnu",
    description,
    category,
    image,
    address: address || "",
    location,
    timeRange,
    startTime: getDateForToday(10),
    endTime: getDateInFuture(30, 23),
    budget: Math.floor(Math.random() * 50) + 10,
    minParticipants: 2,
    maxParticipants: 100,
    rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
    reviewCount: Math.floor(Math.random() * 300),
    highlights,
    source,
  };
}

// Pour restaurants, bars et activités (valeurs par défaut)
function transformPlace({ id, title, address, location, source, raw }) {
  let description =
    "Lieu convivial pour partager un moment entre amis ou en famille.";
  let category = "Restaurant";
  let timeRange = "09h00 - 19h00";
  let image = "/placeholder.svg?height=400&width=600";
  let highlights = [
    "Ambiance chaleureuse",
    "Personnel accueillant",
    "Produits frais",
    "Facile d'accès",
  ];

  if (source === "overpass" && raw && raw.tags) {
    if (raw.tags.cuisine) {
      description = `Cuisine: ${raw.tags.cuisine}`;
    }
    if (raw.tags.opening_hours) {
      timeRange = raw.tags.opening_hours;
    }
  } else if (source === "opendata" && raw && raw.record && raw.record.fields) {
    // Pour restaurants, bars ou activités depuis OpenData on peut récupérer des infos spécifiques selon le dataset
    // Par exemple : nom_restaurant pour restaurants, nom_du_bar pour bars
  } else if (source === "geoapify" && raw && raw.properties) {
    if (raw.properties.description) {
      description = raw.properties.description;
    }
    if (raw.properties.opening_hours) {
      timeRange = raw.properties.opening_hours;
    }
    if (raw.properties.categories && Array.isArray(raw.properties.categories)) {
      // Pour déterminer la catégorie selon le contenu
      const props = raw.properties.categories.map((c) => c.toLowerCase());
      if (props.find((c) => c.includes("bar"))) {
        category = "Bar";
      } else if (props.find((c) => c.includes("restaurant"))) {
        category = "Restaurant";
      } else if (props.find((c) => c.includes("sport"))) {
        category = "Activité";
      }
    }
  }

  return {
    id: String(id),
    title: title || "Lieu inconnu",
    description,
    category,
    image,
    address: address || "",
    location,
    timeRange,
    startTime: getDateForToday(9),
    endTime: getDateInFuture(30, 19),
    budget: Math.floor(Math.random() * 50) + 10,
    minParticipants: 2,
    maxParticipants: 10,
    rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
    reviewCount: Math.floor(Math.random() * 300),
    highlights,
    source,
  };
}

/*******************************************************
 * Configuration par catégorie
 *******************************************************/
const categoryConfig = {
  restaurant: {
    overpass: {
      url: "https://overpass-api.de/api/interpreter",
      query: `[out:json];
area[name="Paris"]->.searchArea;
node["amenity"="restaurant"](area.searchArea);
out body;`,
    },
    opendata: {
      url: "https://opendata.paris.fr/api/v2/catalog/datasets/restaurants-casvp/records?limit=10",
    },
    geoapify: {
      url: "https://api.geoapify.com/v2/places?categories=catering.restaurant&filter=circle:2.3522,48.8566,5000&limit=10&apiKey=aced525a77be4411955204908774682b",
    },
    transform: transformPlace,
    endpoints: ["overpass", "opendata", "geoapify"],
  },
  bar: {
    overpass: {
      url: "https://overpass-api.de/api/interpreter",
      query: `[out:json];
area[name="Paris"]->.searchArea;
node["amenity"="bar"](area.searchArea);
out body;`,
    },
    opendata: {
      url: "https://opendata.paris.fr/api/v2/catalog/datasets/bars-de-paris/records?limit=10",
    },
    geoapify: {
      url: "https://api.geoapify.com/v2/places?categories=catering.bar&filter=circle:2.3522,48.8566,5000&limit=10&apiKey=aced525a77be4411955204908774682b",
    },
    transform: transformPlace,
    endpoints: ["overpass", "opendata", "geoapify"],
  },
  event: {
    opendata: {
      url: "https://opendata.paris.fr/api/v2/catalog/datasets/que-faire-a-paris-/records?limit=10",
    },
    transform: transformEventPlace,
    endpoints: ["opendata"],
  },
  activity: {
    overpass: {
      url: "https://overpass-api.de/api/interpreter",
      query: `[out:json];
area[name="Paris"]->.searchArea;
node["leisure"="sports_centre"](area.searchArea);
out body;`,
    },
    opendata: {
      url: "https://opendata.paris.fr/api/v2/catalog/datasets/activites-paris/records?limit=10",
    },
    geoapify: {
      url: "https://api.geoapify.com/v2/places?categories=sports.leisure&filter=circle:2.3522,48.8566,5000&limit=10&apiKey=aced525a77be4411955204908774682b",
    },
    transform: transformPlace,
    endpoints: ["overpass", "opendata", "geoapify"],
  },
};

/*******************************************************
 * Contrôleur Express
 * Paramètres URL :
 *  - lat (obligatoire)
 *  - lng (obligatoire)
 *  - maxDistance (optionnel, en mètres)
 *  - category (optionnel) : "restaurant", "bar", "event", "activity"
 *******************************************************/
async function getPlacesController(req, res) {
  const { lat, lng, maxDistance, category } = req.query;
  if (!lat || !lng) {
    return res
      .status(400)
      .json({ error: "Les paramètres 'lat' et 'lng' sont obligatoires." });
  }
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const maxDist = maxDistance ? parseFloat(maxDistance) : Infinity;

  // Définir la catégorie par défaut "restaurant" si non fournie
  const cat = category ? category.toLowerCase() : "restaurant";
  const config = categoryConfig[cat];
  if (!config) {
    return res.status(400).json({ error: `Catégorie '${cat}' non supportée.` });
  }

  // Préparation des appels aux API en fonction des endpoints définis dans la config
  let promises = [];
  if (config.endpoints.includes("overpass")) {
    promises.push(
      axios.post(config.overpass.url, config.overpass.query, {
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
  if (config.endpoints.includes("opendata")) {
    promises.push(axios.get(config.opendata.url));
  }
  if (config.endpoints.includes("geoapify")) {
    promises.push(axios.get(config.geoapify.url));
  }

  try {
    const responses = await Promise.all(promises);
    let results = [];
    let index = 0;
    if (config.endpoints.includes("overpass")) {
      const overpassData = responses[index].data;
      index++;
      const transformed = (overpassData.elements || []).map((item) => {
        const location = getCoordinates(item, "overpass");
        const address = getOverpassAddress(item.tags || {});
        return config.transform({
          id: item.id,
          title: item.tags && item.tags.name,
          address,
          location,
          source: "overpass",
          raw: item,
        });
      });
      results = results.concat(transformed);
    }
    if (config.endpoints.includes("opendata")) {
      const opendataData = responses[index].data;
      index++;
      const transformed = (opendataData.records || []).map((item) => {
        const location = getCoordinates(item, "opendata");
        const address = getOpendataAddress(item.record.fields || {});
        return config.transform({
          id: item.record.id,
          title:
            item.record.fields.titre ||
            item.record.fields.nom_restaurant ||
            item.record.fields.nom_du_bar,
          address,
          location,
          source: "opendata",
          raw: item,
        });
      });
      results = results.concat(transformed);
    }
    if (config.endpoints.includes("geoapify")) {
      const geoapifyData = responses[index].data;
      const transformed = (geoapifyData.features || []).map((item) => {
        const location = getCoordinates(item, "geoapify");
        const address = getGeoapifyAddress(item.properties || {});
        return config.transform({
          id: item.properties.place_id,
          title: item.properties.name,
          address,
          location,
          source: "geoapify",
          raw: item,
        });
      });
      results = results.concat(transformed);
    }

    // Filtrage par distance
    results = results.filter((place) => {
      if (!place.location) return false;
      const distance = haversineDistance(
        userLat,
        userLng,
        place.location.lat,
        place.location.lng
      );
      return distance <= maxDist;
    });

    // Élimination des doublons par proximité
    results = filterDuplicates(results);

    return res.json(results);
  } catch (error) {
    console.error("Erreur dans getPlacesController:", error);
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
}

module.exports = { getPlacesController };
