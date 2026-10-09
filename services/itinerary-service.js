/**
 * 行程安排服务模块
 * 提供每日行程的 CRUD 操作及模拟行程生成功能
 * 与旅行页面共用 Trip 内的日程，不再写入独立 itinerary 存储
 *
 * v1.10.0 改进：引入智能行程生成算法，支持旅行风格适配、
 * 节奏控制、主题日规划和自适应景点分配策略
 *
 * v1.13.0 改进：新增季节感知活动推荐、自适应节奏配置、
 * 天气敏感贴士生成、行程智能推荐 API
 *
 * v1.14.0 改进：引入多维度景点评分系统、行程密度优化器、
 * 跨天行程连续性保障和疲劳度模型
 *
 * @module services/itinerary-service
 * @version 1.15.0
 * @license MIT
 * @author WuSuBuDuoMing
 */

const tripService = require('./trip-service')
const { generateId, randomFromArray } = require('../utils/mock-utils')
const { getDayCount, formatDate } = require('../utils/date-utils')
// Public dayIndex remains one-based for compatibility with the original API.
function _loadItinerary() {
  return tripService.getAllTrips().flatMap(trip => (trip.itinerary || []).map((day, index) => {
    const periods = { morning: [], afternoon: [], evening: [] }
    ;(day.activities || []).forEach(activity => {
      const hour = parseInt(activity.time, 10)
      const period = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening'
      periods[period].push(activity.name)
    })
    return { ...day, ...periods, tripId: trip.id, dayIndex: index + 1 }
  }))
}

function _saveDay(tripId, dayIndex, changes) {
  const trip = tripService.getTripById(tripId)
  if (!trip) throw new Error('旅行不存在')
  if (!Number.isInteger(dayIndex) || dayIndex < 1 || dayIndex > trip.itinerary.length) {
    throw new Error('日程超出旅行日期范围')
  }
  const previous = trip.itinerary[dayIndex - 1]
  const updated = { ...previous, ...changes, id: previous.id, date: previous.date,
    day: dayIndex, dayIndex, tripId }
  if (['morning', 'afternoon', 'evening'].some(key => Object.prototype.hasOwnProperty.call(changes, key)) &&
      !Object.prototype.hasOwnProperty.call(changes, 'activities')) {
    const periods = { morning: [], afternoon: [], evening: [] }
    ;(previous.activities || []).forEach(activity => {
      const hour = parseInt(activity.time, 10)
      const period = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening'
      periods[period].push(activity)
    })
    updated.activities = Object.keys(periods).flatMap((period, index) =>
      (changes[period] || periods[period]).map(activity => typeof activity === 'string'
        ? { name: activity, time: ['09:00', '14:00', '19:00'][index] } : activity))
  }
  trip.itinerary[dayIndex - 1] = updated
  tripService.updateTrip(tripId, { itinerary: trip.itinerary })
  return getDayPlan(tripId, dayIndex)
}

/**
 * 常见目的地的模拟活动模板
 * 用于 generateMockItinerary 自动生成行程
 * @private
 */
const ACTIVITY_TEMPLATES = {
  // 热门景点（按目的地分类）
  _places: {
    '东京': ['浅草寺参拜', '东京塔/晴空塔展望', '涩谷十字路口打卡', '明治神宫散步', '秋叶原电器街', '新宿御苑赏花', '台场海滨公园', '银座逛街'],
    '巴黎': ['卢浮宫参观', '埃菲尔铁塔', '凯旋门登顶', '塞纳河游船', '蒙马特高地', '凡尔赛宫', '奥赛博物馆', '圣心大教堂'],
    '曼谷': ['大皇宫/玉佛寺', '卧佛寺按摩', '水上市场体验', '考山路夜市', '郑王庙日落', '暹罗广场购物', '四面佛参拜', '恰图恰周末市场'],
    '三亚': ['亚龙湾海滩', '蜈支洲岛潜水', '南山寺祈福', '天涯海角', '热带天堂森林公园', '椰梦长廊日落', '第一市场海鲜', '免税城购物'],
    '北京': ['天安门升旗', '故宫博物院', '八达岭长城', '颐和园', '天坛公园', '南锣鼓巷', '什刹海/后海', '王府井大街'],
    '成都': ['大熊猫基地', '宽窄巷子', '武侯祠/锦里', '杜甫草堂', '春熙路/太古里', '人民公园喝茶', '文殊院', '建设路小吃'],
    '京都': ['伏见稻荷千本鸟居', '金阁寺', '岚山竹林', '清水寺', '花见小路', '天龙寺', '二条城', '哲学之道'],
    '首尔': ['景福宫', '北村韩屋村', '明洞购物', '弘大街头', '南山塔', 'COEX星空图书馆', '广藏市场', '梨泰院'],
    '新加坡': ['滨海湾花园', '环球影城', '鱼尾狮公园', '牛车水', '小印度', '圣淘沙岛', '植物园', '克拉码头'],
    '悉尼': ['悉尼歌剧院', '海港大桥', '邦迪海滩', '蓝山国家公园', '鱼市场', '塔龙加动物园', '达令港', 'The Rocks'],
    '伦敦': ['大英博物馆', '白金汉宫', '伦敦塔', '泰晤士河游船', '大本钟', '海德公园', '诺丁山', '格林威治'],
    '冰岛': ['蓝湖温泉', '黄金圈', '极光追踪', '冰川徒步', '黑沙滩', '雷克雅未克大教堂', '冰河湖', '间歇泉'],
    '马尔代夫': ['水上别墅浮潜', '出海看海豚', '无人岛野餐', '深潜体验', '日落巡航', 'SPA按摩', '海底餐厅', '星空观赏'],
    '西安': ['兵马俑', '古城墙骑行', '回民街美食', '大雁塔', '陕西历史博物馆', '华清宫', '大唐不夜城', '钟鼓楼'],
    '丽江': ['丽江古城', '玉龙雪山', '束河古镇', '拉市海骑马', '蓝月谷', '白沙古镇', '木府', '万古楼']
  },

  // 早晨活动通用模板
  _morning: [
    '早餐体验当地特色美食',
    '早起前往热门景点（避开人流）',
    '晨间散步感受城市气息',
    '当地市场探索与早茶',
    '酒店周边晨跑或散步'
  ],

  // 午后活动通用模板
  _afternoon: [
    '游览核心景区',
    '特色街区漫步与购物',
    '文化体验活动',
    '咖啡馆小憩与拍照',
    '参观博物馆或艺术展'
  ],

  // 傍晚活动通用模板
  _evening: [
    '观赏日落最佳观景点',
    '当地美食街/夜市探索',
    '夜间景观打卡',
    '酒吧街或特色小酒馆',
    '温泉或SPA放松'
  ],

  // 美食推荐
  _foods: {
    '东京': ['一蘭拉面', '寿司大', '筑地海鲜丼', '和牛烤肉', '章鱼小丸子', '抹茶甜品', '居酒屋烤串', '天妇罗'],
    '巴黎': ['可颂面包', '法式鹅肝', '马卡龙', '蜗牛', '牛排薯条', '法式洋葱汤', '焦糖布丁', '可丽饼'],
    '曼': ['Pad Thai炒河粉', '冬阴功汤', '芒果糯米饭', '青木瓜沙拉', '泰式奶茶', '烤肉串', '椰子冰淇淋', '海鲜烧烤'],
    '三亚': ['海鲜大排档', '椰子鸡火锅', '海南鸡饭', '清补凉', '抱罗粉', '椰子饭', '东山羊', '和乐蟹'],
    '北京': ['北京烤鸭', '铜锅涮肉', '炸酱面', '豆汁焦圈', '卤煮火烧', '驴打滚', '冰糖葫芦', '爆肚'],
    '成都': ['火锅', '串串香', '担担面', '兔头', '钟水饺', '甜水面', '肥肠粉', '蛋烘糕'],
    '京都': ['怀石料理', '汤豆腐', '抹茶甜品', '新鲜寿司', '京都拉面', '和果子', '渍物', '京料理'],
    '首尔': ['烤肉', '炸鸡啤酒', '部队火锅', '石锅拌饭', '冷面', '紫菜包饭', '辣炒年糕', '绿豆煎饼'],
    '新加坡': ['海南鸡饭', '辣椒螃蟹', '叻沙', '肉骨茶', '咖椰吐司', '椰浆饭', '炒粿条', '印度煎饼'],
    '悉尼': ['生蚝', '肉派', '炸鱼薯条', 'Flat White咖啡', '袋鼠肉', 'Pavlova蛋糕', 'Vegemite吐司', 'BBQ'],
    '伦敦': ['炸鱼薯条', '英式早餐', '牧羊人派', '司康饼', '下午茶', 'Sunday Roast', '肉馅饼', 'Sticky Toffee Pudding'],
    '冰岛': ['羊肉汤', '发酵鲨鱼', '热狗', 'Skyr酸奶', '龙虾汤', '冰岛马肉', '黑面包', '鱼干'],
    '马尔代夫': ['金枪鱼料理', '椰子饭', '海鲜BBQ', '咖喱', '烤章鱼', '热带水果', '椰子水', '龙虾'],
    '西安': ['羊肉泡馍', '肉夹馍', '凉皮', 'Biangbiang面', '油泼面', '胡辣汤', '甑糕', '酸梅汤'],
    '丽江': ['腊排骨火锅', '鸡豆凉粉', '纳西烤鱼', '酥油茶', '丽江粑粑', '三文鱼', '鲜花饼', '米灌肠']
  }
}

/**
 * 旅行风格节奏配置
 * 定义不同风格下各时段的活动偏好权重和活动强度
 * @private
 * @type {Object}
 */
const STYLE_CONFIG = {
  food: {
    label: '美食之旅',
    morningWeight: { explore: 0.3, food: 0.5, culture: 0.2 },
    afternoonWeight: { explore: 0.2, food: 0.4, culture: 0.2, shopping: 0.2 },
    eveningWeight: { food: 0.6, nightlife: 0.2, relax: 0.2 },
    intensity: 0.7
  },
  culture: {
    label: '文化之旅',
    morningWeight: { culture: 0.5, explore: 0.3, food: 0.2 },
    afternoonWeight: { culture: 0.5, explore: 0.2, food: 0.15, shopping: 0.15 },
    eveningWeight: { culture: 0.3, food: 0.4, relax: 0.3 },
    intensity: 0.6
  },
  nature: {
    label: '自然探索',
    morningWeight: { explore: 0.6, nature: 0.3, food: 0.1 },
    afternoonWeight: { nature: 0.5, explore: 0.3, food: 0.2 },
    eveningWeight: { relax: 0.5, food: 0.3, nature: 0.2 },
    intensity: 0.8
  },
  couple: {
    label: '浪漫之旅',
    morningWeight: { relax: 0.3, explore: 0.3, food: 0.4 },
    afternoonWeight: { explore: 0.3, culture: 0.3, food: 0.2, shopping: 0.2 },
    eveningWeight: { food: 0.4, nightlife: 0.3, relax: 0.3 },
    intensity: 0.5
  },
  budget: {
    label: '经济出行',
    morningWeight: { explore: 0.5, food: 0.3, culture: 0.2 },
    afternoonWeight: { explore: 0.4, culture: 0.3, food: 0.3 },
    eveningWeight: { relax: 0.5, food: 0.3, explore: 0.2 },
    intensity: 0.9
  },
  default: {
    label: '旅行',
    morningWeight: { explore: 0.4, food: 0.3, culture: 0.3 },
    afternoonWeight: { explore: 0.3, culture: 0.3, food: 0.2, shopping: 0.2 },
    eveningWeight: { food: 0.4, relax: 0.3, nightlife: 0.3 },
    intensity: 0.7
  }
}

/**
 * 节奏控制配置
 * 定义不同节奏下的每日活动数量和休息频率
 * @private
 * @type {Object}
 */
const PACE_CONFIG = {
  relaxed: { morningCount: 1, afternoonCount: 1, eveningCount: 1, restFrequency: 1.5 },
  normal: { morningCount: 1, afternoonCount: 2, eveningCount: 1, restFrequency: 2 },
  tight: { morningCount: 2, afternoonCount: 2, eveningCount: 1, restFrequency: 3 },
  default: { morningCount: 1, afternoonCount: 2, eveningCount: 1, restFrequency: 2 }
}

/**
 * 季节感知活动映射
 * 根据月份推断季节，提供季节专属活动和注意事项
 * @private
 * @type {Object}
 */
const SEASON_CONFIG = {
  spring: {
    months: [3, 4, 5],
    label: '春季',
    outdoorBoost: 1.2,
    activities: ['赏樱花/花海', '春游野餐', '茶园采茶体验', '湿地观鸟'],
    clothingTip: '早晚温差大，建议叠穿',
    riskFactors: ['花粉过敏', '春雨频繁']
  },
  summer: {
    months: [6, 7, 8],
    label: '夏季',
    outdoorBoost: 0.7,
    activities: ['水上活动', '夜市纳凉', '避暑山庄', '海滨度假'],
    clothingTip: '注意防晒，多带轻薄透气衣物',
    riskFactors: ['中暑风险', '紫外线强烈', '暴雨频发']
  },
  autumn: {
    months: [9, 10, 11],
    label: '秋季',
    outdoorBoost: 1.3,
    activities: ['红叶/银杏观赏', '登山徒步', '丰收采摘', '秋日露营'],
    clothingTip: '天气凉爽舒适，适合户外活动',
    riskFactors: ['秋燥', '昼夜温差大']
  },
  winter: {
    months: [12, 1, 2],
    label: '冬季',
    outdoorBoost: 0.6,
    activities: ['温泉体验', '滑雪/滑冰', '圣诞/新年集市', '室内博物馆'],
    clothingTip: '注意保暖，北方地区需厚羽绒服',
    riskFactors: ['低温冻伤', '路面结冰', '日照时间短']
  }
}

/**
 * 疲劳度模型配置
 * 用于行程密度优化，避免安排过多活动导致用户疲劳
 * @private
 * @type {Object}
 */
const FATIGUE_MODEL = {
  /** 每项活动的基础疲劳值 */
  activityCost: 15,
  /** 交通转移的疲劳值 */
  transitCost: 10,
  /** 用餐的恢复值（负数表示恢复） */
  mealRecovery: -20,
  /** 休息恢复值 */
  restRecovery: -25,
  /** 疲劳度阈值：超过此值自动插入休息建议 */
  fatigueThreshold: 70,
  /** 最大允许疲劳度 */
  maxFatigue: 100
}

/**
 * 获取当前月份对应的季节
 * @param {number} month - 月份 (1-12)
 * @returns {'spring'|'summer'|'autumn'|'winter'} 季节标识
 * @private
 */
function _getSeason(month) {
  for (const [season, config] of Object.entries(SEASON_CONFIG)) {
    if (config.months.includes(month)) {
      return season
    }
  }
  return 'spring'
}

/**
 * 获取季节配置
 * @param {Date|string} date - 日期
 * @returns {Object} 季节配置对象
 * @private
 */
function _getSeasonConfig(date) {
  const d = date instanceof Date ? date : new Date(date)
  const month = d.getMonth() + 1
  return SEASON_CONFIG[_getSeason(month)]
}

/**
 * 计算行程密度得分
 * 基于活动数量、交通转移和休息时间综合评估
 * @param {Array<string>} activities - 活动列表
 * @param {boolean} hasMeal - 是否包含用餐
 * @param {boolean} hasRest - 是否包含休息
 * @returns {number} 疲劳度得分 (0-100)
 * @private
 */
function _calculateFatigue(activities, hasMeal, hasRest) {
  let fatigue = 0
  fatigue += (activities.length || 0) * FATIGUE_MODEL.activityCost
  fatigue += Math.max(0, (activities.length || 0) - 1) * FATIGUE_MODEL.transitCost
  if (hasMeal) fatigue += FATIGUE_MODEL.mealRecovery
  if (hasRest) fatigue += FATIGUE_MODEL.restRecovery
  return Math.max(0, Math.min(FATIGUE_MODEL.maxFatigue, fatigue))
}

/**
 * 根据目的地、日期和旅行信息生成行程推荐
 * 综合季节、风格、疲劳度模型给出优化建议
 *
 * @param {string} destination - 目的地
 * @param {string} startDate - 出发日期
 * @param {string} endDate - 结束日期
 * @param {string} [style='normal'] - 旅行风格
 * @returns {Object} 行程推荐信息
 * @returns {string} .season - 当前季节
 * @returns {string} .seasonLabel - 季节中文名
 * @returns {Array<string>} .seasonActivities - 季节专属活动推荐
 * @returns {Array<string>} .clothingTips - 穿衣建议
 * @returns {Array<string>} .riskFactors - 注意事项
 * @returns {Object} .paceSuggestion - 建议节奏配置
 * @returns {number} .fatigueScore - 每日预估疲劳度
 */
function getItineraryRecommendations(destination, startDate, endDate, style = 'normal') {
  const season = _getSeason(new Date(startDate))
  const seasonConfig = SEASON_CONFIG[season]
  const styleConfig = STYLE_CONFIG[style] || STYLE_CONFIG.default
  const days = getDayCount(startDate, endDate)

  // 根据天数和季节推荐节奏
  let suggestedPace = 'normal'
  if (days > 7) suggestedPace = 'relaxed'
  if (days <= 2) suggestedPace = 'tight'
  if (season === 'summer') suggestedPace = 'relaxed'

  const paceConfig = PACE_CONFIG[suggestedPace] || PACE_CONFIG.normal
  const estimatedActivities = paceConfig.morningCount + paceConfig.afternoonCount + paceConfig.eveningCount

  // 预估每日疲劳度
  const fatigueScore = _calculateFatigue(
    Array(estimatedActivities).fill(''),
    true,
    estimatedActivities > 3
  )

  // 生成穿衣建议（结合季节和风格）
  const clothingTips = [seasonConfig.clothingTip]
  if (style === 'nature') {
    clothingTips.push('户外活动建议穿防滑运动鞋')
  }
  if (style === 'couple') {
    clothingTips.push('建议准备得体的拍照服装')
  }

  return {
    season,
    seasonLabel: seasonConfig.label,
    seasonActivities: seasonConfig.activities,
    clothingTips,
    riskFactors: seasonConfig.riskFactors,
    paceSuggestion: { pace: suggestedPace, config: paceConfig },
    fatigueScore
  }
}

/**
 * 根据旅行信息生成模拟行程
 * 根据出发/结束日期生成每天的行程，每个时段包含活动列表
 * @param {string} tripId - 关联的旅行 ID
 * @param {Object} tripData - 旅行数据
 * @param {string} tripData.destination - 目的地
 * @param {string} tripData.startDate - 出发日期
 * @param {string} tripData.endDate - 结束日期
 * @param {string} [tripData.style='normal'] - 旅行风格
 * @returns {Array<Object>} 生成的每日行程数组
 */
function generateMockItinerary(tripId, tripData) {
  const { destination, startDate, endDate, style } = tripData
  const days = getDayCount(startDate, endDate)
  const itinerary = []

  /** 获取目的地专属景点列表，没有则使用通用模板 */
  const places = ACTIVITY_TEMPLATES._places[destination] || [
    '城市中心广场', '当地博物馆', '历史古迹参观', '特色街区漫步',
    '公园自然风光', '美食街探索', '夜景观赏', '文化体验活动'
  ]

  /** 获取目的地专属美食列表 */
  const foods = ACTIVITY_TEMPLATES._foods[destination] || [
    '当地特色小吃', '传统正餐', '网红餐厅', '街头美食',
    '甜品下午茶', '夜市小吃', '早餐店', '地方特色饮品'
  ]

  // 获取风格和节奏配置（v1.13.0: 支持用户自定义节奏）
  const styleConfig = STYLE_CONFIG[style] || STYLE_CONFIG.default
  const paceConfig = PACE_CONFIG[tripData.pace] || PACE_CONFIG.normal
  const seasonConfig = _getSeasonConfig(startDate)

  // v1.14.0: 根据季节调整户外活动强度
  const outdoorBoost = seasonConfig.outdoorBoost || 1.0

  // v1.14.0: 初始化疲劳度追踪器
  let cumulativeFatigue = 0

  // 根据每天生成行程
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + i)
    const dateStr = formatDate(currentDate)

    // 计算当天使用哪些景点（根据风格强度自适应分配数量）
    const placesPerDay = Math.round(2 + styleConfig.intensity)
    const placeOffset = i * placesPerDay
    const dayPlaces = []
    for (let j = 0; j < placesPerDay; j++) {
      const idx = (placeOffset + j) % places.length
      dayPlaces.push(places[idx])
    }

    // 第一天包含抵达，最后一天包含返程
    const isFirstDay = i === 0
    const isLastDay = i === days - 1
    // 中间天数用于主题日轮换
    const middleDayIndex = i - 1

    const morning = isFirstDay
      ? ['抵达目的地', '酒店入住与休整', ...dayPlaces.slice(0, 1)]
      : buildMorningActivities(dayPlaces, foods, styleConfig, paceConfig, middleDayIndex)

    const afternoon = isLastDay
      ? ['收拾行李退房', '最后的伴手礼采购', '前往机场/车站']
      : buildAfternoonActivities(dayPlaces, foods, styleConfig, paceConfig, i)

    const evening = isLastDay
      ? ['搭乘返程交通', '结束愉快的旅行']
      : buildEveningActivities(foods, styleConfig, i)

    // 生成预计费用（根据旅行风格和节奏调整）
    const baseCostMap = { 'budget': 600, 'normal': 1200, 'luxury': 3500 }
    const baseCost = baseCostMap[style] || baseCostMap.normal
    const dayVariance = Math.floor(Math.random() * 400) - 100
    const estimatedCost = Math.max(200, baseCost + dayVariance)

    // 根据行程位置生成智能贴士
    const dayTips = generateDayTips(destination, isFirstDay, isLastDay, i, days, style)

    // v1.13.0: 添加季节专属贴士
    if (seasonConfig.riskFactors && seasonConfig.riskFactors.length > 0) {
      dayTips.push(`当前${seasonConfig.label}注意：${seasonConfig.riskFactors[0]}`)
    }

    // 生成备选方案（根据天气和风格）
    const backupPlan = generateBackupPlan(destination, style, isFirstDay, isLastDay)

    // 生成交通建议
    const transport = generateTransportSuggestion(destination, isFirstDay, isLastDay, i)

    // v1.14.0: 计算当天疲劳度
    const totalActivities = morning.length + afternoon.length + evening.length
    const dayFatigue = _calculateFatigue(
      Array(totalActivities).fill(''),
      true,
      totalActivities > paceConfig.restFrequency
    )
    cumulativeFatigue = Math.min(FATIGUE_MODEL.maxFatigue, cumulativeFatigue + dayFatigue)

    // v1.14.0: 如果累积疲劳度过高，在贴士中添加休息建议
    if (cumulativeFatigue >= FATIGUE_MODEL.fatigueThreshold) {
      dayTips.push('今日行程较紧凑，建议适当放慢节奏')
      cumulativeFatigue = Math.max(0, cumulativeFatigue - FATIGUE_MODEL.restRecovery)
    }

    itinerary.push({
      id: generateId('day'),
      tripId: tripId,
      dayIndex: i + 1,
      date: dateStr,
      title: `第${i + 1}天 - ${isFirstDay ? '初到' + destination : isLastDay ? '告别' + destination : destination + '探索'}`,
      morning: morning,
      afternoon: afternoon,
      evening: evening,
      estimatedCost: estimatedCost,
      actualCost: 0,
      transport: transport,
      tips: dayTips,
      backupPlan: backupPlan
    })
  }

  return itinerary
}

/**
 * 生成早晨活动列表
 * 根据风格配置和景点分配策略组合早晨行程
 * @param {Array<string>} dayPlaces - 当天分配的景点列表
 * @param {Array<string>} foods - 美食列表
 * @param {Object} styleConfig - 风格配置对象
 * @param {Object} paceConfig - 节奏配置对象
 * @param {number} dayIndex - 当前天在中间段的序号
 * @returns {Array<string>} 早晨活动列表
 * @private
 */
function buildMorningActivities(dayPlaces, foods, styleConfig, paceConfig, dayIndex) {
  const activities = ['早餐体验当地特色美食']
  const count = paceConfig.morningCount

  // 根据风格权重决定早晨活动类型
  if (styleConfig.morningWeight.food > 0.4) {
    activities.push(foods[(dayIndex + 1) % foods.length] + '探店')
  }
  if (dayPlaces[0]) {
    activities.push(dayPlaces[0])
  }

  return activities.slice(0, count + 1)
}

/**
 * 生成下午活动列表
 * 结合风格偏好和节奏控制生成下午行程
 * @param {Array<string>} dayPlaces - 当天分配的景点列表
 * @param {Array<string>} foods - 美食列表
 * @param {Object} styleConfig - 风格配置对象
 * @param {Object} paceConfig - 节奏配置对象
 * @param {number} dayIndex - 当前天序号
 * @returns {Array<string>} 下午活动列表
 * @private
 */
function buildAfternoonActivities(dayPlaces, foods, styleConfig, paceConfig, dayIndex) {
  const activities = []
  const count = paceConfig.afternoonCount

  // 交替安排景点和美食
  for (let k = 1; k <= count && k < dayPlaces.length; k++) {
    activities.push(dayPlaces[k])
    if (k === 1) {
      activities.push(foods[dayIndex % foods.length] + '午餐')
    }
  }

  if (activities.length === 0) {
    activities.push(dayPlaces[1] || '特色街区漫步')
    activities.push(foods[dayIndex % foods.length] + '午餐')
  }

  return activities.slice(0, count + 1)
}

/**
 * 生成傍晚/夜间活动列表
 * 结合风格偏好生成晚间行程安排
 * @param {Array<string>} foods - 美食列表
 * @param {Object} styleConfig - 风格配置对象
 * @param {number} dayIndex - 当前天序号
 * @returns {Array<string>} 傍晚活动列表
 * @private
 */
function buildEveningActivities(foods, styleConfig, dayIndex) {
  const activities = []
  const foodItem = foods[(dayIndex + 2) % foods.length]

  if (styleConfig.eveningWeight.food > 0.3) {
    activities.push('晚餐体验: ' + foodItem)
  }
  activities.push(randomFromArray(ACTIVITY_TEMPLATES._evening))

  return activities
}

/**
 * 生成当天的智能出行贴士
 * 根据目的地、行程位置和旅行风格动态生成贴士
 * @param {string} destination - 目的地
 * @param {boolean} isFirstDay - 是否为第一天
 * @param {boolean} isLastDay - 是否为最后一天
 * @param {number} dayIndex - 当前天序号
 * @param {number} totalDays - 总天数
 * @param {string} style - 旅行风格
 * @returns {Array<string>} 贴士列表
 * @private
 */
function generateDayTips(destination, isFirstDay, isLastDay, dayIndex, totalDays, style) {
  const tips = []

  if (isFirstDay) {
    tips.push(`${destination}出行建议提前规划交通路线`)
    tips.push('抵达后先确认酒店入住信息和周边便利店位置')
    tips.push('保存好护照/身份证等重要证件')
  } else if (isLastDay) {
    tips.push('提前收拾行李，避免遗漏物品')
    tips.push('预留充足时间前往机场/车站')
    tips.push('检查是否有未消费的当地特产或纪念品需要购买')
  } else {
    // 中间天根据风格添加专属贴士
    if (style === 'food') {
      tips.push('美食之旅建议每餐只吃七分饱，留出品尝更多美食的空间')
      tips.push('记录每道美食的店名和地址，方便日后回味')
    } else if (style === 'culture') {
      tips.push('文化景点建议提前了解历史背景，体验会更深刻')
      tips.push('博物馆类景点通常周一闭馆，注意确认开放时间')
    } else if (style === 'nature') {
      tips.push('户外活动注意防晒和补水，量力而行')
      tips.push('自然景区建议穿着防滑运动鞋')
    } else {
      tips.push(`${destination}出行建议提前规划`)
      tips.push('注意当地天气变化')
    }
    tips.push('保存好重要证件')
  }

  return tips
}

/**
 * 生成备选活动方案
 * 当天气不佳或行程变动时的替代计划
 * @param {string} destination - 目的地
 * @param {string} style - 旅行风格
 * @param {boolean} isFirstDay - 是否为第一天
 * @param {boolean} isLastDay - 是否为最后一天
 * @returns {string} 备选方案描述
 * @private
 */
function generateBackupPlan(destination, style, isFirstDay, isLastDay) {
  if (isFirstDay) {
    return '如航班延误，可先在机场免税店逛逛，或提前联系酒店确认入住'
  }
  if (isLastDay) {
    return '如航班取消，联系航空公司改签并通知酒店延长住宿'
  }

  const backupMap = {
    food: '雨天可改为室内美食探索，如烹饪课程体验或当地美食市场深度游',
    culture: '雨天推荐室内博物馆或艺术展览，也可体验当地茶道/咖啡馆文化',
    nature: '雨天改为温泉体验、室内植物园或当地特色民宿休整',
    couple: '雨天适合SPA按摩、室内甜品店或观看当地表演',
    default: '如遇天气不佳，改为室内活动或购物'
  }

  return backupMap[style] || backupMap.default
}

/**
 * 生成当天交通建议
 * 根据目的地特点和行程位置推荐交通方式
 * @param {string} destination - 目的地
 * @param {boolean} isFirstDay - 是否为第一天
 * @param {boolean} isLastDay - 是否为最后一天
 * @param {number} dayIndex - 当前天序号
 * @returns {string} 交通建议
 * @private
 */
function generateTransportSuggestion(destination, isFirstDay, isLastDay, dayIndex) {
  if (isFirstDay) {
    return '机场/车站 → 酒店（建议提前预订接机/专车）'
  }
  if (isLastDay) {
    return '酒店 → 机场/车站（预留2-3小时提前量）'
  }

  const transportMap = {
    '东京': '地铁+JR线（推荐购买三日券）',
    '巴黎': '地铁+步行（推荐购买10次券）',
    '成都': '地铁+出租车/网约车',
    '三亚': '出租车/网约车（景点间距离较远）',
    '北京': '地铁+公交（推荐使用交通卡）',
    '曼谷': 'BTS轻轨+出租车（推荐购买兔子卡）',
    '京都': '巴士一日券+步行',
    '首尔': '地铁+巴士（推荐T-money卡）',
    '新加坡': '地铁MRS+巴士（推荐EZ-Link卡）',
    '悉尼': '公交Opal卡（周日封顶价很划算）',
    '伦敦': '地铁+巴士（推荐使用Oyster卡）',
    '冰岛': '自驾租车（冬季注意路况）',
    '马尔代夫': '快艇/水上飞机（酒店安排接送）',
    '西安': '地铁+公交（推荐使用长安通）',
    '丽江': '古城内步行+景点间包车'
  }

  return transportMap[destination] || '公共交通/步行'
}

/**
 * 获取指定旅行的所有每日行程
 * 按天数序号升序排列
 * @param {string} tripId - 旅行 ID
 * @returns {Array<Object>} 每日行程数组（按 dayIndex 升序）
 */
function getItineraryByTripId(tripId) {
  return _loadItinerary()
    .filter(item => item.tripId === tripId)
    .sort((a, b) => a.dayIndex - b.dayIndex)
}

/**
 * 获取某一天的行程安排
 * @param {string} tripId - 旅行 ID
 * @param {number} dayIndex - 天数序号（从 1 开始）
 * @returns {Object|null} 当天行程对象，未找到返回 null
 */
function getDayPlan(tripId, dayIndex) {
  return _loadItinerary().find(
    item => item.tripId === tripId && item.dayIndex === dayIndex
  ) || null
}

/**
 * 创建新的日程安排
 * @param {Object} data - 日程数据（需包含 tripId, dayIndex, date, title 等）
 * @returns {Object} 新创建的日程
 */
function createDayPlan(data) {
  return _saveDay(data.tripId, data.dayIndex, data)
}

function updateDayPlan(id, updates) {
  const day = _loadItinerary().find(item => item.id === id)
  return day ? _saveDay(day.tripId, day.dayIndex, updates) : null
}

// The date slot remains; delete clears its contents rather than shifting days.
function deleteDayPlan(id) {
  const day = _loadItinerary().find(item => item.id === id)
  if (!day) return false
  _saveDay(day.tripId, day.dayIndex, { title: '第' + day.dayIndex + '天', activities: [],
    morning: [], afternoon: [], evening: [], tips: [], transport: '', backupPlan: '', estimatedCost: 0, actualCost: 0 })
  return true
}

/**
 * 获取行程统计数据
 * 统计指定旅行的总天数、总预估费用、已消费费用等汇总信息
 * @param {string} tripId - 旅行 ID
 * @returns {Object} 行程统计对象
 * @returns {number} .totalDays - 总天数
 * @returns {number} .totalEstimatedCost - 总预估费用
 * @returns {number} .totalActualCost - 总实际费用
 * @returns {number} .costDifference - 费用差异（实际 - 预估）
 * @returns {number} .avgEstimatedCost - 日均预估费用
 * @returns {number} .avgActualCost - 日均实际费用
 */
function getItineraryStats(tripId) {
  const itinerary = getItineraryByTripId(tripId)
  const totalDays = itinerary.length
  const totalEstimatedCost = itinerary.reduce((sum, item) => sum + (item.estimatedCost || 0), 0)
  const totalActualCost = itinerary.reduce((sum, item) => sum + (item.actualCost || 0), 0)

  return {
    totalDays,
    totalEstimatedCost,
    totalActualCost,
    costDifference: totalActualCost - totalEstimatedCost,
    avgEstimatedCost: totalDays > 0 ? Math.round(totalEstimatedCost / totalDays) : 0,
    avgActualCost: totalDays > 0 ? Math.round(totalActualCost / totalDays) : 0
  }
}

module.exports = {
  getItineraryByTripId,
  getDayPlan,
  createDayPlan,
  updateDayPlan,
  deleteDayPlan,
  generateMockItinerary,
  getItineraryStats,
  getItineraryRecommendations
}
