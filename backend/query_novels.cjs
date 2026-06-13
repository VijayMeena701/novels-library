const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Novel = mongoose.model('Novel', new mongoose.Schema({}, { strict: false }));
  const novels = await Novel.find({}).lean();
  novels.forEach(n => console.log(JSON.stringify({ _id: n._id, title: n.title, sourceUrl: n.sourceUrl })));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
