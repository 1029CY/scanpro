Page({
  data: {
    pageCount: 0
  },

  onLoad() {
    const app = getApp();
    const scan = app.globalData.currentScan;
    if (scan && scan.pages && scan.pages.length > 0) {
      this.setData({ pageCount: scan.pages.length });
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
        wx.showModal({
          title: '拍照失败',
          content: 'PC模拟器不支持摄像头，请使用手机预览，或点击「相册」导入图片测试。',
          showCancel: false
        });
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

    // 直接进入编辑页，不弹选择框
    wx.navigateTo({ url: '/pages/edit/edit' });
  },

  onClose() {
    wx.navigateBack();
  }
});
