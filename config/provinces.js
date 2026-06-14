/**
 * Chinese provincial-level divisions and matching keywords.
 * Full province names are checked first to avoid Shanxi/Shaanxi confusion.
 */
export const CHINA_PROVINCES = [
  { name: '北京', keywords: ['北京', 'Beijing', 'Peking'] },
  { name: '天津', keywords: ['天津', 'Tianjin'] },
  { name: '上海', keywords: ['上海', 'Shanghai'] },
  { name: '重庆', keywords: ['重庆', 'Chongqing', 'Chungking'] },
  {
    name: '河北',
    keywords: ['河北', 'Hebei', 'Shijiazhuang', '石家庄', '唐山', 'Tangshan', '保定', 'Baoding', '邯郸', 'Handan'],
  },
  {
    name: '山西',
    keywords: ['山西', 'Shanxi', 'Taiyuan', '太原', '大同', 'Datong', '运城', 'Yuncheng'],
  },
  {
    name: '辽宁',
    keywords: ['辽宁', 'Liaoning', 'Shenyang', '沈阳', 'Dalian', '大连'],
  },
  {
    name: '吉林',
    keywords: ['吉林', 'Jilin', 'Changchun', '长春'],
  },
  {
    name: '黑龙江',
    keywords: ['黑龙江', 'Heilongjiang', 'Harbin', '哈尔滨'],
  },
  {
    name: '江苏',
    keywords: ['江苏', 'Jiangsu', 'Nanjing', '南京', 'Suzhou', '苏州', 'Wuxi', '无锡', '常州', 'Changzhou'],
  },
  {
    name: '浙江',
    keywords: ['浙江', 'Zhejiang', 'Hangzhou', '杭州', 'Ningbo', '宁波', 'Wenzhou', '温州'],
  },
  {
    name: '安徽',
    keywords: ['安徽', 'Anhui', 'Hefei', '合肥'],
  },
  {
    name: '福建',
    keywords: ['福建', 'Fujian', 'Fuzhou', '福州', 'Xiamen', '厦门', 'Quanzhou', '泉州'],
  },
  {
    name: '江西',
    keywords: ['江西', 'Jiangxi', 'Nanchang', '南昌'],
  },
  {
    name: '山东',
    keywords: ['山东', 'Shandong', 'Jinan', '济南', 'Qingdao', '青岛'],
  },
  {
    name: '河南',
    keywords: ['河南', 'Henan', 'Zhengzhou', '郑州', '洛阳', 'Luoyang', '开封', 'Kaifeng', '南阳', 'Nanyang'],
  },
  {
    name: '湖北',
    keywords: ['湖北', 'Hubei', 'Wuhan', '武汉'],
  },
  {
    name: '湖南',
    keywords: ['湖南', 'Hunan', 'Changsha', '长沙'],
  },
  {
    name: '广东',
    keywords: ['广东', 'Guangdong', 'Guangzhou', '广州', 'Shenzhen', '深圳', 'Dongguan', '东莞', 'Foshan', '佛山'],
  },
  {
    name: '海南',
    keywords: ['海南', 'Hainan', 'Haikou', '海口', 'Sanya', '三亚'],
  },
  {
    name: '四川',
    keywords: ['四川', 'Sichuan', 'Chengdu', '成都'],
  },
  {
    name: '贵州',
    keywords: ['贵州', 'Guizhou', 'Guiyang', '贵阳'],
  },
  {
    name: '云南',
    keywords: ['云南', 'Yunnan', 'Kunming', '昆明'],
  },
  {
    name: '陕西',
    keywords: ['陕西', 'Shaanxi', "Xi'an", 'Xian', '西安', '咸阳', 'Xianyang', '宝鸡', 'Baoji'],
  },
  {
    name: '甘肃',
    keywords: ['甘肃', 'Gansu', 'Lanzhou', '兰州'],
  },
  {
    name: '青海',
    keywords: ['青海', 'Qinghai', 'Xining', '西宁'],
  },
  {
    name: '台湾',
    keywords: ['台湾', 'Taiwan', 'Taipei', '台北'],
  },
  {
    name: '内蒙古',
    keywords: ['内蒙古', 'Inner Mongolia', 'Hohhot', '呼和浩特'],
  },
  {
    name: '广西',
    keywords: ['广西', 'Guangxi', 'Nanning', '南宁'],
  },
  {
    name: '西藏',
    keywords: ['西藏', 'Tibet', 'Lhasa', '拉萨'],
  },
  {
    name: '宁夏',
    keywords: ['宁夏', 'Ningxia', 'Yinchuan', '银川'],
  },
  {
    name: '新疆',
    keywords: ['新疆', 'Xinjiang', 'Urumqi', '乌鲁木齐'],
  },
  {
    name: '香港',
    keywords: ['香港', 'Hong Kong', 'Hongkong'],
  },
  {
    name: '澳门',
    keywords: ['澳门', 'Macau', 'Macao'],
  },
];

/** Default include-list provinces (legacy behaviour). */
export const TARGET_PROVINCES = CHINA_PROVINCES.filter((p) =>
  ['山西', '陕西', '河南', '河北'].includes(p.name)
);

export const TARGET_PROVINCE_NAMES = new Set(TARGET_PROVINCES.map((p) => p.name));
