/**
 * trip-card 旅行卡片组件
 * 展示旅行概览信息，包括封面图、目的地、日期、预算进度等
 */
Component({
  properties: {
    /** 旅行数据对象 */
    trip: {
      type: Object,
      value: {
        id: '',
        destination: '',
        coverImage: '',
        startDate: '',
        endDate: '',
        status: 'planning', // planning | ongoing | completed
        totalBudget: 0,
        spentBudget: 0,
        packingProgress: 0,
        peopleCount: 1,
        style: ''
      }
    }
  },

  data: {
    /** 状态标签文字映射 */
    statusMap: {
      planning: '计划中',
      upcoming: '即将出发',
      ongoing: '进行中',
      ended: '已结束',
      completed: '已完成'
    },
    /** 状态颜色映射 */
    statusColorMap: {
      planning: 'var(--info)',
      ongoing: 'var(--brand-primary)',
      completed: 'var(--text-hint)'
    }
  },

  methods: {
    /** 卡片点击事件 */
    handleTap() {
      this.triggerEvent('select', { tripId: this.data.trip.id });
    },

    /** 计算预算使用百分比 */
    getBudgetPercent() {
      const { totalBudget, spentBudget } = this.data.trip;
      if (!totalBudget) return 0;
      return Math.min(Math.round((spentBudget / totalBudget) * 100), 100);
    },

    /** 格式化日期范围 */
    getDateRange() {
      const { startDate, endDate } = this.data.trip;
      if (!startDate) return '';
      if (!endDate) return startDate;
      return `${startDate} ~ ${endDate}`;
    }
  }
});
