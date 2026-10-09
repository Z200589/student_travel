const trips = require('../../services/trip-service')
const poster = require('../../services/poster-service')
const themeBehavior = require('../../utils/theme-behavior')
Page({
  behaviors: [themeBehavior],
  data: { pages: [], index: 0, palette: null, imagePath: '', rendering: false, saving: false, showBudget: false, error: '', token: 0 },
  onLoad(options) {
    try {
      this.trip = trips.getTripById(options.tripId || '')
      this.setData({ pages: poster.buildPages(this.trip) }); this.generate()
    } catch (error) { this.setData({ error: error.message }) }
  },
  onUnload() { clearTimeout(this._timer); this._unloaded = true },
  onChoosePage(e) { if (!this.data.saving) { this.setData({ index: Number(e.detail.value) }); this.generate() } },
  onBudget(e) { if (!this.data.saving) { this.setData({ showBudget: !!e.detail.value }); this.generate() } },
  generate() {
    if (!this.trip || !this.data.pages.length || this.data.saving) return
    clearTimeout(this._timer)
    const token = this.data.token + 1
    this.setData({ palette: null, imagePath: '', rendering: true, error: '', token }, () => {
      if (!this._unloaded) this.setData({ palette: poster.paletteFor(this.trip, this.data.pages[this.data.index], this.data.showBudget) })
    })
    this._timer = setTimeout(() => {
      if (!this._unloaded && this.data.rendering && this.data.token === token) this.setData({ rendering: false, error: '生成时间较长，请点击重新生成' })
    }, 20000)
  },
  onImageOK(e) {
    if (this._unloaded || Number(e.currentTarget.dataset.token) !== this.data.token) return
    clearTimeout(this._timer)
    if (!e.detail.path) return this.onImageError(e)
    this.setData({ imagePath: e.detail.path, rendering: false, error: '' })
  },
  onImageError(e) {
    if (this._unloaded || Number(e.currentTarget.dataset.token) !== this.data.token) return
    clearTimeout(this._timer); this.setData({ rendering: false, imagePath: '', error: '海报生成失败，请重新生成' })
  },
  onPreview() { if (this.data.imagePath) wx.previewImage({ current: this.data.imagePath, urls: [this.data.imagePath] }) },
  onSave() {
    if (!this.data.imagePath || this.data.rendering || this.data.saving) return
    this.setData({ saving: true })
    wx.saveImageToPhotosAlbum({ filePath: this.data.imagePath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: error => wx.showModal({ title: '保存未完成', content: /auth|deny|denied/i.test(error.errMsg || '') ? '请在微信的小程序设置中允许保存到相册，然后重试。' : '图片未能保存，你可以点击预览后长按图片保存。', showCancel: false }),
      complete: () => { if (!this._unloaded) this.setData({ saving: false }) }
    })
  }
})
