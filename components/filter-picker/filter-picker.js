Component({
  properties: {
    current: {
      type: String,
      value: 'enhanced'
    }
  },

  data: {
    filters: [
      { type: 'original', label: '原色' },
      { type: 'enhanced', label: '增强' },
      { type: 'bw', label: '黑白' },
      { type: 'grayscale', label: '灰度' }
    ]
  },

  methods: {
    onSelect(e) {
      const { type } = e.currentTarget.dataset;
      this.triggerEvent('select', { type });
    }
  }
});
