const cloudinary = require('cloudinary').v2;


cloudinary.config({
cloud_name: 'duoasocsd',
secure: true
});

const url = cloudinary.url('cenoura_janjdf')

console.log(url)
