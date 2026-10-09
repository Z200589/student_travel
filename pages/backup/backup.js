const backup = require('../../services/backup-service')
const themeBehavior = require('../../utils/theme-behavior')
Page({
  behaviors:[themeBehavior],
  data:{raw:'',summary:null,busy:false,error:''},
  onInput(e){ this.setData({raw:e.detail.value,summary:null,error:''}) },
  onExport(){
    try { const raw=backup.create(); this.setData({raw,summary:backup.preview(raw),error:''}) }
    catch(e){ this.setData({error:e.message}) }
  },
  onCopy(){
    if (!this.data.raw) return
    wx.setClipboardData({data:this.data.raw,fail:()=>this.setData({error:'复制失败，请重试'})})
  },
  onShare(){
    if (this.data.busy || !this.data.raw) return
    if (typeof wx.shareFileMessage !== 'function') { this.setData({error:'当前微信不支持文件分享，请复制备份文本'}); return }
    this.setData({busy:true,error:''})
    try {
      backup.validate(this.data.raw)
      const filePath=`${wx.env.USER_DATA_PATH}/voyager-backup.json`
      wx.getFileSystemManager().writeFileSync(filePath,this.data.raw,'utf8')
      wx.shareFileMessage({filePath,fileName:'旅行数据备份.json',fail:()=>this.setData({error:'文件分享未完成，可重试或复制文本'}),complete:()=>this.setData({busy:false})})
    } catch(e){this.setData({busy:false,error:e.message})}
  },
  onPreview(){try{this.setData({summary:backup.preview(this.data.raw),error:''})}catch(e){this.setData({summary:null,error:e.message})}},
  onRestore(){
    if(this.data.busy) return
    try { backup.preview(this.data.raw) } catch(e){this.setData({error:e.message});return}
    const raw=this.data.raw
    this.setData({busy:true})
    wx.showModal({title:'恢复备份',content:'仅支持本机旅行数据为空时恢复。确认将这份备份写入本机？',confirmText:'恢复',success:res=>{
      if(!res.confirm) return
      try{backup.restore(raw);this.setData({error:''});wx.showToast({title:'恢复完成',icon:'success'})}catch(e){this.setData({error:e.message})}
    },complete:()=>this.setData({busy:false})})
  }
})
