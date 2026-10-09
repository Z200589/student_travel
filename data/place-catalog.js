// Curated offline suggestions. Coordinates are approximate area anchors,
// not verified entrances; durations are planning assumptions, not live facts.
const rows = [
  ['hz-lake', '杭州', '西湖湖滨', ['西湖', '湖滨'], 30.25, 120.15, 150, ['nature', 'photography', 'relaxation'], '适合湖边散步与拍照，以湖滨一带作为规划参考点。'],
  ['hz-bridge', '杭州', '断桥', ['断桥残雪'], 30.26, 120.15, 60, ['nature', 'photography'], '适合作为西湖北侧步行路线的一站。'],
  ['hz-leifeng', '杭州', '雷峰塔', [], 30.23, 120.15, 90, ['culture', 'photography'], '位于西湖南岸，可与南岸步行安排一起考虑。'],
  ['hz-lingyin', '杭州', '灵隐景区', ['灵隐寺', '灵隐'], 30.24, 120.10, 180, ['culture', 'nature'], '适合寺院文化与山林游览，建议留出较完整的半天。'],
  ['hz-hefang', '杭州', '河坊街', [], 30.24, 120.17, 90, ['food', 'shopping', 'culture'], '适合历史街区漫步，也可自行寻找沿街餐饮。'],
  ['hz-xixi', '杭州', '西溪湿地', ['西溪', '西溪国家湿地公园'], 30.27, 120.06, 240, ['nature', 'relaxation'], '适合湿地风景，面积较大，建议单独预留半天。'],
  ['bj-palace', '北京', '故宫博物院', ['故宫', '紫禁城'], 39.92, 116.40, 240, ['culture', 'photography'], '适合历史建筑与博物馆主题，建议预留半天。'],
  ['bj-jingshan', '北京', '景山公园', ['景山'], 39.93, 116.40, 90, ['nature', 'photography'], '可与故宫周边行程一起考虑，适合登高观景。'],
  ['bj-temple', '北京', '天坛公园', ['天坛'], 39.88, 116.41, 180, ['culture', 'nature'], '适合古建筑与园林步行。'],
  ['bj-summer', '北京', '颐和园', [], 40.00, 116.27, 240, ['nature', 'culture', 'photography'], '适合园林与湖景，距离中心城区较远，建议留足时间。'],
  ['cd-kuanzhai', '成都', '宽窄巷子', ['宽窄'], 30.67, 104.05, 120, ['culture', 'food', 'shopping'], '适合老街与院落漫步。'],
  ['cd-wuhou', '成都', '武侯祠', ['成都武侯祠博物馆'], 30.64, 104.05, 150, ['culture'], '适合三国历史主题，可与相邻锦里一起安排。'],
  ['cd-jinli', '成都', '锦里', ['锦里古街'], 30.645, 104.049, 90, ['food', 'shopping', 'photography'], '适合街区漫步，可与武侯祠安排在同一天。']
]
const places = rows.map(([id, city, name, aliases, latitude, longitude, visitMinutes, tags, reason]) =>
  ({ id, city, name, aliases, latitude, longitude, visitMinutes, tags, reason, coordinateQuality: 'approximate' }))
module.exports = { places, cities: ['杭州', '北京', '成都'] }
