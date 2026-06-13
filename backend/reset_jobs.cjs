const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Job = mongoose.model('BackgroundJob', new mongoose.Schema({}, { strict: false }));
  const jobs = await Job.find({}).lean();
  jobs.forEach(j => console.log(JSON.stringify({ _id: j._id, type: j.type, status: j.status, retryCount: j.retryCount, error: j.error?.message })));
  
  // Reset any non-completed jobs
  const result = await Job.updateMany(
    { status: { $ne: 'completed' } },
    { $set: { status: 'pending', retryCount: 0, error: null, failedAt: null } }
  );
  console.log(`Reset ${result.modifiedCount} job(s) back to pending.`);
  
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
