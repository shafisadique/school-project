// Add to cron job (daily)
const expiredOrders = await Subscription.find({
  status: 'pending',
  createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});

for (let sub of expiredOrders) {
  await Subscription.findByIdAndDelete(sub._id);
  console.log('Cleaned up pending sub:', sub._id);
}