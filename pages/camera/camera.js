Page({
  data: {
    multiPageMode: false,
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
    const ctx = wx.createCameraContext();
    ctx.takePhoto({
      quality: 'high',
      success: (res) => {
        this.addPage(res.tempImagePath);
      },
      fail: () => {
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
        this.addPage(res.tempFiles[0].tempFilePath);
      }
    });
  },

  addPage(imagePath) {
    const app = getApp();
    const scan = app.globalData.currentScan || { pages: [], multiPageMode: false };
    scan.pages.push({
      tempPath: imagePath,
      filterType: 'enhanced',
      cropPoints: null
    });
    app.globalData.currentScan = scan;

    this.setData({ pageCount: scan.pages.length });

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
