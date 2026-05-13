Page({
  data: {
    pages: [],
    currentIndex: 0,
    currentImage: '',
    filterType: 'enhanced',
    showCrop: false,
    isMultiPage: false,
    isHistory: false
  },

  onLoad(options) {
    if (options.recordId) {
      this.loadHistoryRecord(options.recordId);
    } else {
      this.loadCurrentScan();
    }
  },

  loadHistoryRecord(recordId) {
    const records = wx.getStorageSync('scanRecords') || [];
    const record = records.find(r => r.id === recordId);
    if (record) {
      this.setData({
        pages: record.pages,
        currentImage: record.pages[0].localImagePath,
        filterType: record.pages[0].filterType || 'enhanced',
        isHistory: true
      });
    }
  },

  loadCurrentScan() {
    const app = getApp();
    const scan = app.globalData.currentScan;
    if (!scan || !scan.pages.length) {
      wx.navigateBack();
      return;
    }
    this.setData({
      pages: scan.pages,
      currentIndex: 0,
      currentImage: scan.pages[0].tempPath,
      isMultiPage: scan.pages.length > 1 || scan.multiPageMode
    });
  },

  onSwitchPage(e) {
    const { index } = e.currentTarget.dataset;
    const page = this.data.pages[index];
    this.setData({
      currentIndex: index,
      currentImage: page.tempPath || page.localImagePath,
      filterType: page.filterType || 'enhanced'
    });
  },

  onSelectFilter(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({ filterType: type });
    // 更新当前页的滤镜状态
    const pages = this.data.pages;
    pages[this.data.currentIndex].filterType = type;
    this.setData({ pages });
  },

  onToggleCrop() {
    this.setData({ showCrop: !this.data.showCrop });
  },

  onCropChange(e) {
    const pages = this.data.pages;
    pages[this.data.currentIndex].cropPoints = e.detail.points;
    this.setData({ pages });
  },

  onDeletePage() {
    const { currentIndex, pages } = this.data;
    if (pages.length <= 1) {
      wx.navigateBack();
      return;
    }
    pages.splice(currentIndex, 1);
    const newIndex = Math.min(currentIndex, pages.length - 1);
    this.setData({
      pages,
      currentIndex: newIndex,
      currentImage: pages[newIndex].tempPath || pages[newIndex].localImagePath
    });
  },

  onContinueScan() {
    const app = getApp();
    app.globalData.currentScan = {
      pages: this.data.pages,
      multiPageMode: true
    };
    wx.navigateTo({ url: '/pages/camera/camera' });
  },

  onSave() {
    const that = this;
    wx.showActionSheet({
      itemList: ['保存图片到相册', '导出为PDF', ...(this.data.isHistory ? [] : ['继续扫描'])],
      success(res) {
        if (res.tapIndex === 0) {
          that.saveToAlbum();
        } else if (res.tapIndex === 1) {
          that.exportPDF();
        } else if (res.tapIndex === 2) {
          that.onContinueScan();
        }
      }
    });
  },

  saveToAlbum() {
    // 需要先申请权限
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        const path = this.data.currentImage;
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
        });
      },
      fail: () => {
        wx.showToast({ title: '请在设置中开启相册权限', icon: 'none' });
      }
    });
  },

  exportPDF() {
    wx.showToast({ title: 'PDF 导出功能开发中', icon: 'none' });
  }
});
