Page({
  data: {
    showViewfinder: true,
    multiPageMode: false
  },

  onLoad() {
    const app = getApp();
    const scan = app.globalData.currentScan;
    if (scan && scan.pages.length > 0) {
      this.setData({ multiPageMode: true });
    }
  },

  onTakePhoto() {
    const ctx = wx.createCameraContext();
    ctx.takePhoto({
      quality: 'high',
      success: (res) => {
        this.processCapture(res.tempImagePath);
      },
      fail: (err) => {
        wx.showToast({ title: '拍照失败，请重试', icon: 'none' });
      }
    });
  },

  onAlbumImport() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this.processCapture(res.tempFiles[0].tempFilePath);
      }
    });
  },

  processCapture(imagePath) {
    const app = getApp();
    const scan = app.globalData.currentScan;
    scan.pages.push({ tempPath: imagePath, filterType: 'enhanced', cropPoints: null });
    app.globalData.currentScan = scan;

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
  },

  goToEdit() {
    wx.navigateTo({ url: '/pages/edit/edit' });
  },

  onClose() {
    wx.navigateBack();
  }
});
