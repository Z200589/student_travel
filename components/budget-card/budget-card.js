Component({
  properties: {
    expense: { type: Object, value: {} },
    categories: { type: Object, value: {} }
  },
  methods: {
    onDelete() {
      this.triggerEvent('delete', { id: this.data.expense.id })
    }
  }
})
