App({
  globalData: {
    currentScan: null
  },

  onLaunch() {
    // 读取扫描历史记录
    const records = wx.getStorageSync('scanRecords') || [];
    this.globalData.scanRecords = records;
  }
});
