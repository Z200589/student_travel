// One persisted ledger for all views; fresh installs start empty.
const { setStorage } = require('../utils/storage-utils')
const { readCollection } = require('../utils/collection-storage')


function loadExpenses() {
  return readCollection('expenses')
}
function saveExpenses(expenses) {
  if (!setStorage('expenses', expenses)) throw new Error('账单保存失败，请重试')
}
function spentForTrip(tripId, expenses = loadExpenses()) {
  return expenses.filter(e => e.tripId === tripId)
    .reduce((cents, e) => cents + Math.round(Number(e.amount) * 100), 0) / 100
}
module.exports = { loadExpenses, saveExpenses, spentForTrip }
