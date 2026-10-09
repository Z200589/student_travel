const echarts = require('../ec-canvas/echarts')
const chartService = require('../../services/expense-chart-service')
const budget = require('../../services/budget-service')
Component({
  properties: { expenses: { type: Array, value: [] }, dark: { type: Boolean, value: false } },
  data: { hasData: false, summary: { categories: [], daily: [], total: '0.00' }, ec: { lazyLoad: true, disableTouch: false }, error: '' },
  observers: { 'expenses, dark': function () { this.updateData() } },
  lifetimes: {
    ready() { this._ready = true; this.updateData() },
    detached() { this._ready = false; this.disposeCharts() }
  },
  methods: {
    updateData() {
      try {
        const summary = chartService.summarize(this.data.expenses || [], budget.getCategories())
        this._options = chartService.options(summary, this.data.dark)
        this.setData({ summary, hasData: summary.totalCents > 0, error: '' }, () => {
          if (!this._ready) return
          if (!summary.totalCents) this.disposeCharts()
          else { this.drawChart('category'); this.drawChart('daily') }
        })
      } catch (error) { this.disposeCharts(); this.setData({ error: error.message, hasData: false }) }
    },
    drawChart(kind) {
      if (!this._ready || !this.data.hasData) return
      const key = '_' + kind
      if (this[key]) { this[key].setOption(this._options[kind], true); return }
      if (this[key + 'Pending']) return
      const component = this.selectComponent('#' + kind)
      if (!component) return
      this[key + 'Pending'] = true
      const generation = this._generation || 0
      component.init((canvas, width, height, dpr) => {
        if (!this._ready || !this.data.hasData || generation !== (this._generation || 0)) return null
        this[key + 'Pending'] = false
        try {
          const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
          canvas.setChart(chart); chart.setOption(this._options[kind], true); this[key] = chart
          return chart
        } catch (_) { this.setData({ error: '图表暂未绘制成功，金额明细仍可查看' }); return null }
      })
    },
    disposeCharts() {
      this._generation = (this._generation || 0) + 1
      for (const kind of ['category','daily']) {
        if (this['_' + kind]) this['_' + kind].dispose()
        this['_' + kind] = null; this['_' + kind + 'Pending'] = false
      }
    }
  }
})
