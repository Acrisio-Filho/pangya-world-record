const RecordPolicy = Object.freeze({
  compare: (a, b) => Number(a.score) - Number(b.score) || Number(b.pang || 0) - Number(a.pang || 0),
  isPublished: record => record.status === "approved" && Number(record.community) === 1,
});
