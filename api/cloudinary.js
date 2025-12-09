// cloudinary.js
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "TCC",
  api_key: process.env.CLOUDINARY_API_KEY || "985328141423669",
  api_secret: process.env.CLOUDINARY_API_SECRET || "tAgarOVziO9sWsh-WZE74POsXrg",
  secure: true
});

module.exports = cloudinary;
