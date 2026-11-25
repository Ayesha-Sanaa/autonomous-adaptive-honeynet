// Run with DRY = true first. It only prints. Set DRY = false to apply.
const DRY = true;
const col = db.getSiblingDB("honeynet").adaptive_decisions;
print("decisions without phase:", col.countDocuments({ phase: { $exists: false } }));
if (!DRY) {
  col.updateMany({ phase: { $exists: false } }, { $set: { phase: "final", seq: null, latency_ms: null } });
}
const dups = col.aggregate([
  { $match: { phase: "final", session: { $ne: null } } },
  { $sort: { timestamp: 1 } },
  { $group: { _id: "$session", ids: { $push: "$_id" }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
]).toArray();
print("sessions with more than one final decision:", dups.length);
dups.forEach((g) => {
  print(g._id, "has", g.n);
  if (!DRY) col.deleteMany({ _id: { $in: g.ids.slice(1) } });
});
printjson(col.findOne({ phase: "live", session: { $exists: false } }));