const { processImage } = require('../../utils/pipeline');

Page({
  data: {
    multiPageMode: false,
    processing: false,
    pageCount: 0
  },

  onLoad() {
    const app = getApp();
    const scan = app.globalData.currentScan;
    if (scan && scan.pages && scan.pages.length > 0) {
      this.setData({
        multiPageMode: true,
        pageCount: scan.pages.length
      });
    }
  },

  onTakePhoto() {
    if (this.data.processing) return;
    const ctx = wx.createCameraContext();
    ctx.takePhoto({
      quality: 'high',
      success: (res) => {
        this.processCapture(res.tempImagePath);
      },
      fail: () => {
        wx.showToast({ title: '拍照失败，请重试', icon: 'none' });
      }
    });
  },

  onAlbumImport() {
    if (this.data.processing) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this.processCapture(res.tempFiles[0].tempFilePath);
      }
    });
  },

  async processCapture(imagePath) {
    this.setData({ processing: true });
    wx.showLoading({ title: '处理中...' });

    try {
      const result = await processImage(imagePath, { filterType: 'enhanced' });
      const app = getApp();
      const scan = app.globalData.currentScan || { pages: [], multiPageMode: false };
      scan.pages.push({
        tempPath: result.processedPath,
        filterType: 'enhanced',
        cropPoints: result.corners
      });
      app.globalData.currentScan = scan;

      wx.hideLoading();
      this.setData({
        processing: false,
        pageCount: scan.pages.length
      });

      wx.showActionSheet({
        itemList: ['继续扫描', '完成'],
        success: (res) => {
          if (res.tapIndex === 0) {
            app.globalData.currentScan.multiPageMode = true;
            this.setData({ multiPageMode: true });
          } else {
            this.goToEdit();
          }
        },
        fail: () => {
          this.goToEdit();
        }
      });
    } catch (err) {
      wx.hideLoading();
      this.setData({ processing: false });
      wx.showToast({ title: '图片处理失败', icon: 'none' });
    }
  },

  goToEdit() {
    wx.navigateTo({ url: '/pages/edit/edit' });
  },

  onClose() {
    wx.navigateBack();
  }
});
