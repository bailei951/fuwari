// assets/charts.js
(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var good = style.getPropertyValue('--good').trim();
  var warn = style.getPropertyValue('--warn').trim();

  // --- Radar Chart: Core Major Assessment ---
  var radar = echarts.init(document.getElementById('chart-radar'), null, { renderer: 'svg' });
  radar.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true
    },
    legend: {
      data: ['铁道机车', '航海技术', '机电一体化', '建筑消防', '计算机技术', 'AI应用'],
      bottom: 10,
      textStyle: { fontSize: 11, color: muted }
    },
    radar: {
      indicator: [
        { name: '直接就业', max: 5 },
        { name: '专升本价值', max: 5 },
        { name: '参军价值', max: 5 },
        { name: '考编/国企', max: 5 },
        { name: '薪资水平', max: 5 },
        { name: '稳定性', max: 5 }
      ],
      shape: 'circle',
      splitArea: { show: true, areaStyle: { color: [bg2, '#fff'] } },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } },
      axisName: { color: ink, fontSize: 12 }
    },
    series: [{
      type: 'radar',
      data: [
        { value: [5, 1, 3, 5, 4, 5], name: '铁道机车', itemStyle: { color: accent } },
        { value: [5, 1, 5, 3, 5, 3], name: '航海技术', itemStyle: { color: accent2 } },
        { value: [4, 3, 5, 3, 3, 4], name: '机电一体化', itemStyle: { color: good } },
        { value: [4, 3, 3, 3, 3, 5], name: '建筑消防', itemStyle: { color: warn } },
        { value: [1, 5, 5, 1, 2, 2], name: '计算机技术', itemStyle: { color: '#8e44ad' } },
        { value: [1, 5, 3, 1, 2, 2], name: 'AI应用', itemStyle: { color: '#95a5a6' } }
      ]
    }]
  });
  window.addEventListener('resize', function() { radar.resize(); });

  // --- Scatter Chart: Stability vs Income Ceiling ---
  var scatter = echarts.init(document.getElementById('chart-scatter'), null, { renderer: 'svg' });
  scatter.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      formatter: function(p) {
        return '<b>' + p.name + '</b><br/>' +
          '稳定性：' + p.value[0] + '/5<br/>' +
          '收入天花板：' + (p.value[1] >= 15 ? '15万+/年' : p.value[1] + '万/年') + '<br/>' +
          '推荐等级：' + p.value[2];
      }
    },
    grid: { left: 60, right: 40, top: 40, bottom: 60 },
    xAxis: {
      name: '工作稳定性（1-5分）',
      nameLocation: 'center',
      nameGap: 40,
      min: 1, max: 5.5,
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      axisLabel: { color: muted }
    },
    yAxis: {
      name: '收入天花板（万元/年）',
      min: 3, max: 60,
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      axisLabel: { color: muted }
    },
    series: [{
      type: 'scatter',
      symbolSize: function(data) { return data[2] === '强烈推荐' ? 28 : data[2] === '推荐' ? 20 : 14; },
      data: [
        { value: [5, 14, '强烈推荐'], name: '铁道机车' },
        { value: [3, 50, '强烈推荐'], name: '航海技术/轮机' },
        { value: [4, 14, '强烈推荐'], name: '电梯工程' },
        { value: [4, 18, '强烈推荐'], name: '建筑消防' },
        { value: [4, 11, '推荐'], name: '机电一体化' },
        { value: [4, 12, '推荐'], name: '电气自动化' },
        { value: [4, 13, '推荐'], name: '工业机器人' },
        { value: [3, 11, '推荐'], name: '新能源汽车' },
        { value: [4, 12, '推荐'], name: '微电子技术' },
        { value: [5, 14, '推荐'], name: '飞机维修' },
        { value: [4, 12, '推荐'], name: '眼视光技术' },
        { value: [4, 8, '推荐'], name: '密码技术(参军)' },
        { value: [2, 14, '需升本'], name: '计算机技术' },
        { value: [2, 12, '需升本'], name: 'AI应用' }
      ],
      itemStyle: {
        color: function(p) {
          var v = p.value;
          if (v[2] === '强烈推荐') return accent;
          if (v[2] === '推荐') return good;
          return warn;
        },
        shadowBlur: 6,
        shadowColor: 'rgba(0,0,0,0.15)'
      },
      label: {
        show: true,
        formatter: '{b}',
        position: 'top',
        fontSize: 10,
        color: ink
      }
    }]
  });
  window.addEventListener('resize', function() { scatter.resize(); });

})();
