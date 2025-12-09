const cloudinary = require('cloudinary').v2;


cloudinary.config({
cloud_name: 'duoasocsd',
secure: true
});

const url = cloudinary.url('waffle_adbjgl')

console.log(url)
