const { saveRecord, saveImageFile, getRecords } = require('../../utils/storage');

Page({
  data: {
    pages: [],
    currentIndex: 0,
    currentImage: '',
    filterType: 'enhanced',
    showCrop: false,
    isMultiPage: false,
    isHistory: false,
    recordId: null
  },

  onLoad(options) {
    if (options.recordId) {
      this.loadHistoryRecord(options.recordId);
    } else {
      this.loadCurrentScan();
    }
  },

  loadHistoryRecord(recordId) {
    const records = getRecords();
    const record = records.find(r => r.id === recordId);
    if (record) {
      this.setData({
        pages: record.pages,
        currentIndex: 0,
        currentImage: record.pages[0].localImagePath,
        filterType: record.pages[0].filterType || 'enhanced',
        isMultiPage: record.pages.length > 1,
        isHistory: true,
        recordId: record.id
      });
    }
  },

  loadCurrentScan() {
    const app = getApp();
    const scan = app.globalData.currentScan;
    if (!scan || !scan.pages || !scan.pages.length) {
      wx.navigateBack();
      return;
    }
    this.setData({
      pages: scan.pages,
      currentIndex: 0,
      currentImage: scan.pages[0].tempPath,
      filterType: scan.pages[0].filterType || 'enhanced',
      isMultiPage: scan.pages.length > 1 || scan.multiPageMode
    });
  },

  onSwitchPage(e) {
    const { index } = e.detail || e.currentTarget.dataset;
    const page = this.data.pages[index];
    if (!page) return;
    this.setData({
      currentIndex: index,
      currentImage: page.tempPath || page.localImagePath,
      filterType: page.filterType || 'enhanced'
    });
  },

  onSelectFilter(e) {
    const { type } = e.detail || e.currentTarget.dataset;
    // 仅更新 UI 状态，实际滤镜处理延后到导出时
    this.setData({ filterType: type });
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
    const page = pages[newIndex];
    this.setData({
      pages,
      currentIndex: newIndex,
      currentImage: page.tempPath || page.localImagePath,
      filterType: page.filterType || 'enhanced',
      isMultiPage: pages.length > 1
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
    const isMulti = this.data.pages.length > 1;
    const itemList = ['保存当前页到相册'];
    if (isMulti) {
      itemList.push('保存全部页到相册');
    }
    if (!this.data.isHistory) {
      itemList.push('继续扫描');
    }

    wx.showActionSheet({
      itemList,
      success: (res) => {
        if (res.tapIndex === 0) this.saveToAlbum();
        else if (res.tapIndex === 1 && isMulti) this.saveAllPagesToAlbum();
        else if ((res.tapIndex === 1 && !isMulti) || res.tapIndex === 2) this.onContinueScan();
      }
    });
  },

  saveToAlbum() {
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        const path = this.data.currentImage;
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: () => {
            this.saveToHistory();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
        });
      },
      fail: () => {
        wx.showToast({ title: '请在设置中开启相册权限', icon: 'none' });
      }
    });
  },

  saveToHistory() {
    const pages = this.data.pages.map(p => ({
      pageId: 'p' + Date.now() + Math.random().toString(36).slice(2),
      localImagePath: saveImageFile(p.tempPath),
      filterType: p.filterType || 'enhanced',
      cropPoints: p.cropPoints || null
    }));
    return saveRecord({ pages });
  },

  saveAllPagesToAlbum() {
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        const { saveAllToAlbum } = require('../../utils/pdf-gen');
        const paths = this.data.pages.map(p => p.tempPath || p.localImagePath);
        saveAllToAlbum(paths).then(() => {
          this.saveToHistory();
          wx.showToast({ title: `已保存${paths.length}页到相册`, icon: 'success' });
        }).catch(() => {
          wx.showToast({ title: '部分页面保存失败', icon: 'none' });
        });
      },
      fail: () => {
        wx.showToast({ title: '请在设置中开启相册权限', icon: 'none' });
      }
    });
  },

  onDeleteFromStrip(e) {
    const { index } = e.detail;
    const pages = this.data.pages;
    if (pages.length <= 1) return;
    pages.splice(index, 1);
    const newIndex = Math.min(this.data.currentIndex, pages.length - 1);
    const page = pages[newIndex];
    this.setData({
      pages,
      currentIndex: newIndex,
      currentImage: page.tempPath || page.localImagePath,
      filterType: page.filterType || 'enhanced',
      isMultiPage: pages.length > 1
    });
  }
});
